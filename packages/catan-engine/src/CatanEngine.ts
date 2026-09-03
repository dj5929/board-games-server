import { playerId, GAME_CONFIGS, type IGameEngine, type IRandomProvider, type Result, type IStateTransition, type PlayerId } from '@packages/engine-core';
import type { ICatanState, ICatanAction, ICatanEvent, CatanPlayer, ResourceType, Hex, Vertex, Edge, DevCardType } from './types';
import { generateBoard, boardGraph } from './board';

// Helper type to allow mutating the cloned state in reduce
type MutableCatanState = {
  -readonly [P in keyof ICatanState]:
    P extends 'players' ? CatanPlayer[] :
    P extends 'board' ? { hexes: Hex[]; vertices: Record<string, Vertex>; edges: Record<string, Edge> } :
    P extends 'pendingDiscards' ? Record<PlayerId, number> :
    P extends 'devCardDeck' ? DevCardType[] :
    ICatanState[P];
};

function calculateLongestRoad(playerId: PlayerId, board: ICatanState['board']): number {
  const playerEdges = Object.keys(board.edges).filter(eId => board.edges[eId]!.owner === playerId);
  if (playerEdges.length === 0) return 0;
  
  let maxLength = 0;
  const memo = new Map<string, number>();

  function dfs(vertexId: string, visitedEdges: ReadonlySet<string>): number {
    const memoKey = `${vertexId}|${Array.from(visitedEdges).sort().join(',')}`;
    if (memo.has(memoKey)) return memo.get(memoKey)!;

    const vertex = board.vertices[vertexId];
    if (vertex && vertex.building && vertex.owner !== playerId) {
      memo.set(memoKey, 0);
      return 0;
    }

    let maxSubPath = 0;
    const adjacentEdges = boardGraph.vertices[vertexId]!.adjacentEdges;
    
    for (const edgeId of adjacentEdges) {
      if (board.edges[edgeId]?.owner === playerId && !visitedEdges.has(edgeId)) {
        const newVisited = new Set(visitedEdges);
        newVisited.add(edgeId);
        
        const nextVertex = boardGraph.edges[edgeId]!.adjacentVertices.find(v => v !== vertexId)!;
        const subLength = 1 + dfs(nextVertex, newVisited);
        if (subLength > maxSubPath) {
          maxSubPath = subLength;
        }
      }
    }
    
    memo.set(memoKey, maxSubPath);
    return maxSubPath;
  }

  for (const edgeId of playerEdges) {
    const vertices = boardGraph.edges[edgeId]!.adjacentVertices;
    for (const vId of vertices) {
      const len = dfs(vId, new Set());
      if (len > maxLength) {
        maxLength = len;
      }
    }
  }
  
  return maxLength;
}

// Checks whether an edge is connected to an existing network owned by the player,
// optionally counting another edge (edgeId2) that is being placed in the same action
// as part of the network to allow chained placement (e.g. Road Building).
function isEdgeConnectedToNetwork(
  board: ICatanState['board'],
  edgeId: string,
  playerId: PlayerId,
  additionallyOwned: string[] = []
): boolean {
  const owned = new Set<string>(additionallyOwned);
  for (const vId of boardGraph.edges[edgeId]!.adjacentVertices) {
    const v = board.vertices[vId];
    if (v && v.owner === playerId) return true;
  }
  for (const vId of boardGraph.edges[edgeId]!.adjacentVertices) {
    for (const adjEdgeId of boardGraph.vertices[vId]!.adjacentEdges) {
      if (owned.has(adjEdgeId)) return true;
      if (board.edges[adjEdgeId]?.owner === playerId) return true;
    }
  }
  return false;
}

function checkWinConditionAndAwards(nextState: MutableCatanState, events: ICatanEvent[]) {
  if (nextState.status === 'FINISHED') return;

  // 1. Recalculate Longest Road
  let activeMaxRoad = 0;
  let candidates: PlayerId[] = [];
  for (const p of nextState.players) {
    const len = calculateLongestRoad(p.id, nextState.board);
    if (len > activeMaxRoad) {
      activeMaxRoad = len;
      candidates = [p.id];
    } else if (len === activeMaxRoad) {
      candidates.push(p.id);
    }
  }
  
  if (activeMaxRoad >= 5) {
    if (candidates.length === 1 && candidates[0] !== nextState.longestRoadOwner) {
      nextState.longestRoadOwner = candidates[0]!;
      nextState.longestRoadLength = activeMaxRoad;
      events.push({ type: 'LONGEST_ROAD_AWARDED', playerId: candidates[0]!, length: activeMaxRoad });
    } else if (candidates.length > 1 && !candidates.includes(nextState.longestRoadOwner!)) {
      if (nextState.longestRoadOwner !== null) {
         nextState.longestRoadOwner = null;
         nextState.longestRoadLength = 4;
      }
    } else if (candidates.includes(nextState.longestRoadOwner!)) {
      nextState.longestRoadLength = activeMaxRoad;
    }
  } else {
    nextState.longestRoadOwner = null;
    nextState.longestRoadLength = 4;
  }
  
  // 2. Largest Army
  let maxArmy = nextState.largestArmySize || 2;
  for (const p of nextState.players) {
    const knights = p.playedDevelopmentCards.filter(c => c === 'KNIGHT').length;
    if (knights > maxArmy) {
      maxArmy = knights;
      nextState.largestArmyOwner = p.id;
      nextState.largestArmySize = knights;
      events.push({ type: 'LARGEST_ARMY_AWARDED', playerId: p.id, size: knights });
    }
  }

  // 3. Victory Points Calculation
  for (const p of nextState.players) {
    let vp = 0;
    Object.values(nextState.board.vertices).forEach(v => {
      if (v.owner === p.id) {
        if (v.building === 'SETTLEMENT') vp += 1;
        if (v.building === 'CITY') vp += 2;
      }
    });
    
    if (nextState.longestRoadOwner === p.id) vp += 2;
    if (nextState.largestArmyOwner === p.id) vp += 2;
    
    vp += p.developmentCards.filter(c => c.type === 'VICTORY_POINT').length;
    vp += p.playedDevelopmentCards.filter(c => c === 'VICTORY_POINT').length;
    
    p.victoryPoints = vp;
    
    if (vp >= 10 && nextState.activePlayerId === p.id) {
      nextState.winner = p.id;
      nextState.status = 'FINISHED';
      events.push({ type: 'GAME_OVER', winnerId: p.id });
      break;
    }
  }
}

export const CatanEngine: IGameEngine<ICatanState, ICatanAction, ICatanEvent> = {
  getInitialState(playerIds: PlayerId[], rng: IRandomProvider): ICatanState {
    if (playerIds.length < GAME_CONFIGS['catan'].minPlayers || playerIds.length > GAME_CONFIGS['catan'].maxPlayers) {
      throw new Error(`Catan requires ${GAME_CONFIGS['catan'].minPlayers} to ${GAME_CONFIGS['catan'].maxPlayers} players.`);
    }

    const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706'];
    const players: CatanPlayer[] = playerIds.map((id, index) => ({
      id,
      color: colors[index % colors.length]!,
      resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 },
      victoryPoints: 0,
      developmentCards: [],
      playedDevelopmentCards: []
    }));

    // Generate Dev Card Deck
    const devCardDeck: DevCardType[] = [
      ...Array(14).fill('KNIGHT'),
      ...Array(5).fill('VICTORY_POINT'),
      ...Array(2).fill('ROAD_BUILDING'),
      ...Array(2).fill('YEAR_OF_PLENTY'),
      ...Array(2).fill('MONOPOLY')
    ];
    
    // Fisher-Yates shuffle with RNG
    for (let i = devCardDeck.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [devCardDeck[i], devCardDeck[j]] = [devCardDeck[j]!, devCardDeck[i]!];
    }

    const placementOrder = players.map(p => p.id);

    return {
      status: 'IN_PROGRESS',
      players,
      board: generateBoard(rng),
      turnPhase: 'INITIAL_PLACEMENT_1',
      hasRolled: false,
      pendingDiscards: {},
      devCardDeck,
      activePlayerId: placementOrder[0]!,
      activeTrade: null,
      longestRoadOwner: null,
      longestRoadLength: 4,
      largestArmyOwner: null,
      largestArmySize: 2,
      winner: null,
      playedDevCardThisTurn: false,
      placementOrder,
      placementIndex: 0,
      placementStep: 'SETTLEMENT',
      pendingRoadVertex: null
    };
  },

  reduce(
    currentState: Readonly<ICatanState>,
    action: Readonly<ICatanAction>,
    rng: IRandomProvider
  ): Result<IStateTransition<ICatanState, ICatanEvent>, string> {
    const activePlayerIndex = currentState.players.findIndex(p => p.id === currentState.activePlayerId);
    if (activePlayerIndex === -1) return { success: false, error: 'Invalid active player' };
    
    // Deep clone players and board for mutations
    const nextPlayers = currentState.players.map(p => ({ 
      ...p, 
      resources: { ...p.resources },
      developmentCards: p.developmentCards.map(c => ({ ...c })),
      playedDevelopmentCards: [...p.playedDevelopmentCards]
    }));
    const activePlayer = nextPlayers[activePlayerIndex]!;
    const nextBoard = { 
      hexes: [...currentState.board.hexes], 
      vertices: { ...currentState.board.vertices }, 
      edges: { ...currentState.board.edges } 
    };

    const nextState: MutableCatanState = {
      ...currentState,
      players: nextPlayers,
      board: nextBoard,
      pendingDiscards: { ...currentState.pendingDiscards },
      devCardDeck: [...currentState.devCardDeck],
      activeTrade: currentState.activeTrade ? { ...currentState.activeTrade } : null
    };

    const events: ICatanEvent[] = [];

    switch (action.type) {
      case 'ROLL_DICE': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot roll now' };
        if (currentState.hasRolled) return { success: false, error: 'Already rolled this turn' };
        nextState.hasRolled = true;
        
        const dice1 = Math.floor(rng.next() * 6) + 1;
        const dice2 = Math.floor(rng.next() * 6) + 1;
        const total = dice1 + dice2;
        events.push({ type: 'DICE_ROLLED', dice1, dice2, total });

        if (total === 7) {
          // Check for discards
          let needsDiscard = false;
          nextPlayers.forEach(p => {
            const totalCards = Object.values(p.resources).reduce((sum, count) => sum + count, 0);
            if (totalCards > 7) {
              nextState.pendingDiscards[p.id] = Math.floor(totalCards / 2);
              needsDiscard = true;
            }
          });
          
          if (needsDiscard) {
            nextState.turnPhase = 'DISCARD_PHASE';
          } else {
            nextState.turnPhase = 'ROBBER_PLACEMENT';
          }
        } else {
          const resourceGains: Record<PlayerId, Record<Exclude<ResourceType, 'DESERT'>, number>> = {};
          
          nextBoard.hexes.forEach(hex => {
            if (hex.numberToken === total && !hex.hasRobber && hex.resource !== 'DESERT') {
              const hexId = hex.id;
              Object.values(nextBoard.vertices).forEach(vertex => {
                if (vertex.building && boardGraph.vertices[vertex.id]!.adjacentHexes.includes(hexId)) {
                  const ownerId = vertex.owner!;
                  const amount = vertex.building === 'CITY' ? 2 : 1;
                  
                  if (!resourceGains[ownerId]) {
                    resourceGains[ownerId] = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
                  }
                  resourceGains[ownerId][hex.resource as Exclude<ResourceType, 'DESERT'>] += amount;
                }
              });
            }
          });

          Object.entries(resourceGains).forEach(([pId, gains]) => {
            const player = nextPlayers.find(p => p.id === pId);
            if (player) {
              let gainedAnything = false;
              (Object.keys(gains) as (keyof typeof gains)[]).forEach(res => {
                if (gains[res] > 0) {
                  player.resources[res] += gains[res];
                  gainedAnything = true;
                }
              });
              
              if (gainedAnything) {
                events.push({ type: 'RESOURCES_RECEIVED', playerId: playerId(pId), resources: gains });
              }
            }
          });
        }

        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLACE_INITIAL_SETTLEMENT': {
        if (currentState.turnPhase !== 'INITIAL_PLACEMENT_1' && currentState.turnPhase !== 'INITIAL_PLACEMENT_2') {
          return { success: false, error: 'Not in initial placement' };
        }
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.placementStep !== 'SETTLEMENT') return { success: false, error: 'Must place a road first' };

        const vertexId = action.vertexId;
        const vertex = nextBoard.vertices[vertexId];
        if (!vertex) return { success: false, error: 'Invalid vertex' };
        if (vertex.building) return { success: false, error: 'Vertex is already occupied' };

        const adjacentVertices = boardGraph.vertices[vertexId]!.adjacentVertices;
        for (const adj of adjacentVertices) {
          if (nextBoard.vertices[adj]?.building) {
            return { success: false, error: 'Distance rule violated' };
          }
        }

        nextBoard.vertices[vertexId] = { ...vertex, owner: action.playerId, building: 'SETTLEMENT' };
        nextState.placementStep = 'ROAD';
        nextState.pendingRoadVertex = vertexId;

        events.push({ type: 'SETTLEMENT_BUILT', playerId: action.playerId, vertexId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLACE_INITIAL_ROAD': {
        if (currentState.turnPhase !== 'INITIAL_PLACEMENT_1' && currentState.turnPhase !== 'INITIAL_PLACEMENT_2') {
          return { success: false, error: 'Not in initial placement' };
        }
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.placementStep !== 'ROAD') return { success: false, error: 'Must place a settlement first' };

        const edgeId = action.edgeId;
        const edge = nextBoard.edges[edgeId];
        if (!edge) return { success: false, error: 'Invalid edge' };
        if (edge.owner) return { success: false, error: 'Edge already occupied' };

        const pendingVertexId = currentState.pendingRoadVertex;
        if (!pendingVertexId) return { success: false, error: 'No settlement to attach road to' };
        if (!boardGraph.vertices[pendingVertexId]!.adjacentEdges.includes(edgeId)) {
          return { success: false, error: 'Road must connect to your settlement' };
        }

        nextBoard.edges[edgeId] = { ...edge, owner: action.playerId };

        const order = [...currentState.placementOrder];
        const nextIndex = currentState.placementIndex + 1;
        let nextOrder = order;
        let nextPlacementIndex = nextIndex;
        let nextPlayerId: PlayerId;
        let pendingRoadVertex: string | null = null;

        if (nextIndex < order.length) {
          nextPlayerId = order[nextIndex]!;
        } else if (currentState.turnPhase === 'INITIAL_PLACEMENT_1') {
          nextOrder = [...order].reverse();
          nextPlacementIndex = 0;
          nextPlayerId = nextOrder[0]!;
          nextState.turnPhase = 'INITIAL_PLACEMENT_2';
        } else {
          nextPlacementIndex = 0;
          nextPlayerId = order[0]!;
          nextState.turnPhase = 'MAIN_TURN';
        }

        nextState.placementOrder = nextOrder;
        nextState.placementIndex = nextPlacementIndex;
        nextState.placementStep = 'SETTLEMENT';
        nextState.pendingRoadVertex = pendingRoadVertex;
        nextState.activePlayerId = nextPlayerId;

        events.push({ type: 'ROAD_BUILT', playerId: action.playerId, edgeId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'DISCARD_RESOURCES': {
        if (currentState.turnPhase !== 'DISCARD_PHASE') return { success: false, error: 'Not in discard phase' };
        
        const requiredAmount = currentState.pendingDiscards[action.playerId];
        if (!requiredAmount) return { success: false, error: 'You do not need to discard' };
        
        const discardAmount = Object.values(action.resources).reduce((sum, count) => sum + count, 0);
        if (discardAmount !== requiredAmount) return { success: false, error: `Must discard exactly ${requiredAmount} resources` };
        
        const playerIndex = nextPlayers.findIndex(p => p.id === action.playerId);
        if (playerIndex === -1) return { success: false, error: 'Invalid player' };
        const player = nextPlayers[playerIndex]!;
        
        for (const res of Object.keys(action.resources) as (keyof typeof action.resources)[]) {
          if (player.resources[res] < action.resources[res]) {
            return { success: false, error: `Not enough ${res} to discard` };
          }
          player.resources[res] -= action.resources[res];
        }
        
        delete nextState.pendingDiscards[action.playerId];
        events.push({ type: 'RESOURCES_DISCARDED', playerId: action.playerId, amount: discardAmount });
        
        if (Object.keys(nextState.pendingDiscards).length === 0) {
          nextState.turnPhase = 'ROBBER_PLACEMENT';
        }
        
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'MOVE_ROBBER': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.turnPhase !== 'ROBBER_PLACEMENT') return { success: false, error: 'Not in robber placement phase' };
        
        const targetHexIndex = nextBoard.hexes.findIndex(h => h.id === action.hexId);
        if (targetHexIndex === -1) return { success: false, error: 'Invalid hex' };
        if (nextBoard.hexes[targetHexIndex]!.hasRobber) return { success: false, error: 'Robber must move to a new hex' };
        
        // Remove from old hex
        const oldHexIndex = nextBoard.hexes.findIndex(h => h.hasRobber);
        if (oldHexIndex !== -1) {
          nextBoard.hexes[oldHexIndex] = { ...nextBoard.hexes[oldHexIndex]!, hasRobber: false };
        }
        
        // Place on new hex
        nextBoard.hexes[targetHexIndex] = { ...nextBoard.hexes[targetHexIndex]!, hasRobber: true };
        
        events.push({ type: 'ROBBER_MOVED', playerId: action.playerId, hexId: action.hexId });

        if (action.targetPlayerId) {
          if (action.targetPlayerId === action.playerId) return { success: false, error: 'Cannot steal from yourself' };
          const victim = nextPlayers.find(p => p.id === action.targetPlayerId);
          if (!victim) return { success: false, error: 'Invalid victim' };
          
          // Validate victim is adjacent
          const adjacentVertices = Object.keys(boardGraph.vertices).filter(vId => boardGraph.vertices[vId]!.adjacentHexes.includes(action.hexId));
          const hasVictimBuilding = adjacentVertices.some(vId => nextBoard.vertices[vId]?.owner === action.targetPlayerId);
          
          if (!hasVictimBuilding) return { success: false, error: 'Victim is not adjacent to hex' };
          
          const stealableResources: (keyof typeof victim.resources)[] = [];
          for (const res of Object.keys(victim.resources) as (keyof typeof victim.resources)[]) {
            for (let i = 0; i < victim.resources[res]; i++) {
              stealableResources.push(res);
            }
          }
          
          if (stealableResources.length > 0) {
            const stolenIndex = Math.floor(rng.next() * stealableResources.length);
            const stolenResource = stealableResources[stolenIndex]!;
            
            victim.resources[stolenResource] -= 1;
            activePlayer.resources[stolenResource] += 1;
            events.push({ type: 'STOLEN_RESOURCE', thiefId: action.playerId, victimId: action.targetPlayerId, resource: stolenResource as Exclude<ResourceType, 'DESERT'> });
          }
        }
        
        nextState.turnPhase = 'MAIN_TURN';
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }
      
      case 'BUILD_SETTLEMENT': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot build now' };
        
        if (activePlayer.resources.WOOD < 1 || activePlayer.resources.BRICK < 1 || 
            activePlayer.resources.SHEEP < 1 || activePlayer.resources.WHEAT < 1) {
          return { success: false, error: 'Not enough resources' };
        }

        const playerSettlements = Object.values(nextBoard.vertices).filter(v => v.owner === action.playerId && v.building === 'SETTLEMENT').length;
        if (playerSettlements >= 5) {
          return { success: false, error: 'Maximum settlements reached' };
        }

        const vertexId = action.vertexId;
        const vertex = nextBoard.vertices[vertexId];
        if (!vertex) return { success: false, error: 'Invalid vertex' };
        if (vertex.building) return { success: false, error: 'Vertex is already occupied' };

        const adjacentVertices = boardGraph.vertices[vertexId]!.adjacentVertices;
        for (const adj of adjacentVertices) {
          if (nextBoard.vertices[adj]?.building) {
            return { success: false, error: 'Distance rule violated' };
          }
        }
        
        const adjacentEdges = boardGraph.vertices[vertexId]!.adjacentEdges;
        const hasConnectedRoad = adjacentEdges.some(edgeId => nextBoard.edges[edgeId]?.owner === action.playerId);
        
        const playerHasAnyRoads = Object.values(nextBoard.edges).some(e => e.owner === action.playerId);
        if (playerHasAnyRoads && !hasConnectedRoad) {
          return { success: false, error: 'Must build connected to a road' };
        }

        activePlayer.resources.WOOD -= 1;
        activePlayer.resources.BRICK -= 1;
        activePlayer.resources.SHEEP -= 1;
        activePlayer.resources.WHEAT -= 1;
        
        nextBoard.vertices[vertexId] = { ...vertex, owner: action.playerId, building: 'SETTLEMENT' };

        events.push({ type: 'SETTLEMENT_BUILT', playerId: action.playerId, vertexId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'BUILD_ROAD': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot build now' };
        
        if (activePlayer.resources.WOOD < 1 || activePlayer.resources.BRICK < 1) {
          return { success: false, error: 'Not enough resources' };
        }

        const playerRoads = Object.values(nextBoard.edges).filter(e => e.owner === action.playerId).length;
        if (playerRoads >= 15) {
          return { success: false, error: 'Maximum roads reached' };
        }

        const edgeId = action.edgeId;
        const edge = nextBoard.edges[edgeId];
        if (!edge) return { success: false, error: 'Invalid edge' };
        if (edge.owner) return { success: false, error: 'Edge already occupied' };

        const isConnected = isEdgeConnectedToNetwork(nextBoard, edgeId, action.playerId);
        
        const playerHasAnyBuildings = Object.values(nextBoard.vertices).some(v => v.owner === action.playerId);
        if (playerHasAnyBuildings && !isConnected) {
          return { success: false, error: 'Must build connected to a road or settlement' };
        }

        activePlayer.resources.WOOD -= 1;
        activePlayer.resources.BRICK -= 1;
        
        nextBoard.edges[edgeId] = { ...edge, owner: action.playerId };
        
        events.push({ type: 'ROAD_BUILT', playerId: action.playerId, edgeId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'UPGRADE_CITY': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot build now' };
        
        if (activePlayer.resources.ORE < 3 || activePlayer.resources.WHEAT < 2) {
          return { success: false, error: 'Not enough resources' };
        }

        const playerCities = Object.values(nextBoard.vertices).filter(v => v.owner === action.playerId && v.building === 'CITY').length;
        if (playerCities >= 4) {
          return { success: false, error: 'Maximum cities reached' };
        }

        const vertexId = action.vertexId;
        const vertex = nextBoard.vertices[vertexId];
        if (!vertex) return { success: false, error: 'Invalid vertex' };
        if (vertex.owner !== action.playerId || vertex.building !== 'SETTLEMENT') {
          return { success: false, error: 'Must have a settlement to upgrade' };
        }

        activePlayer.resources.ORE -= 3;
        activePlayer.resources.WHEAT -= 2;
        
        nextBoard.vertices[vertexId] = { ...vertex, building: 'CITY' };

        events.push({ type: 'CITY_UPGRADED', playerId: action.playerId, vertexId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'TRADE_BANK': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        
        const { offerResource, requestResource, amount } = action;
        if (amount <= 0) return { success: false, error: 'Invalid amount' };
        if (offerResource === 'DESERT' || requestResource === 'DESERT') return { success: false, error: 'Cannot trade desert' };
        
        // Find best exchange rate for offerResource
        let bestRate = 4;
        
        // Check ports owned by player
        Object.values(nextBoard.vertices).forEach(vertex => {
          if (vertex.owner === action.playerId && vertex.building) {
            // Check adjacent edges for ports
            const adjacentEdges = boardGraph.vertices[vertex.id]!.adjacentEdges;
            adjacentEdges.forEach(eId => {
              const edge = nextBoard.edges[eId];
              if (edge && edge.port) {
                if (edge.port === '3:1') {
                  bestRate = Math.min(bestRate, 3);
                } else if (edge.port === offerResource) {
                  bestRate = Math.min(bestRate, 2);
                }
              }
            });
          }
        });
        
        const totalCost = bestRate * amount;
        if (activePlayer.resources[offerResource as keyof typeof activePlayer.resources] < totalCost) {
          return { success: false, error: 'Not enough resources' };
        }
        
        activePlayer.resources[offerResource as keyof typeof activePlayer.resources] -= totalCost;
        activePlayer.resources[requestResource as keyof typeof activePlayer.resources] += amount;
        
        events.push({ type: 'BANK_TRADE', playerId: action.playerId, offerResource, requestResource, amount, cost: totalCost });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PROPOSE_TRADE': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (action.playerId === action.toPlayerId) return { success: false, error: 'Cannot trade with yourself' };
        
        // Validate offer
        for (const res of Object.keys(action.offer) as (keyof typeof action.offer)[]) {
          if (activePlayer.resources[res] < action.offer[res]) {
            return { success: false, error: `Not enough ${res}` };
          }
        }
        
        nextState.activeTrade = {
          id: rng.next().toString(36).substring(2, 9),
          fromPlayerId: action.playerId,
          toPlayerId: action.toPlayerId,
          offer: { ...action.offer },
          request: { ...action.request }
        };
        
        events.push({ type: 'TRADE_PROPOSED', trade: nextState.activeTrade });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'ACCEPT_TRADE': {
        if (!currentState.activeTrade) return { success: false, error: 'No active trade' };
        if (action.playerId !== currentState.activeTrade.toPlayerId) return { success: false, error: 'Not the recipient' };
        
        const trade = currentState.activeTrade;
        const fromPlayer = nextPlayers.find(p => p.id === trade.fromPlayerId);
        const toPlayer = nextPlayers.find(p => p.id === trade.toPlayerId);
        
        if (!fromPlayer || !toPlayer) return { success: false, error: 'Invalid players' };
        
        // Double check resources for both
        for (const res of Object.keys(trade.offer) as (keyof typeof trade.offer)[]) {
          if (fromPlayer.resources[res] < trade.offer[res]) return { success: false, error: `Proposer does not have enough ${res}` };
        }
        for (const res of Object.keys(trade.request) as (keyof typeof trade.request)[]) {
          if (toPlayer.resources[res] < trade.request[res]) return { success: false, error: `You do not have enough ${res}` };
        }
        
        // Execute trade
        for (const res of Object.keys(trade.offer) as (keyof typeof trade.offer)[]) {
          fromPlayer.resources[res] -= trade.offer[res];
          toPlayer.resources[res] += trade.offer[res];
        }
        for (const res of Object.keys(trade.request) as (keyof typeof trade.request)[]) {
          fromPlayer.resources[res] += trade.request[res];
          toPlayer.resources[res] -= trade.request[res];
        }
        
        const tradeId = trade.id;
        nextState.activeTrade = null;
        events.push({ type: 'TRADE_ACCEPTED', tradeId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'REJECT_TRADE': {
        if (!currentState.activeTrade) return { success: false, error: 'No active trade' };
        if (action.playerId !== currentState.activeTrade.toPlayerId) return { success: false, error: 'Not the recipient' };
        
        const tradeId = currentState.activeTrade.id;
        nextState.activeTrade = null;
        events.push({ type: 'TRADE_REJECTED', tradeId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'BUY_DEV_CARD': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (activePlayer.resources.ORE < 1 || activePlayer.resources.WHEAT < 1 || activePlayer.resources.SHEEP < 1) {
          return { success: false, error: 'Not enough resources' };
        }
        if (nextState.devCardDeck.length === 0) {
          return { success: false, error: 'Development card deck is empty' };
        }

        activePlayer.resources.ORE -= 1;
        activePlayer.resources.WHEAT -= 1;
        activePlayer.resources.SHEEP -= 1;

        const cardType = nextState.devCardDeck.pop()!;
        activePlayer.developmentCards.push({
          id: rng.next().toString(36).substring(2, 9),
          type: cardType,
          boughtThisTurn: true
        });

        events.push({ type: 'DEV_CARD_BOUGHT', playerId: action.playerId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLAY_KNIGHT': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.playedDevCardThisTurn) return { success: false, error: 'Already played a development card this turn' };
        const cardIndex = activePlayer.developmentCards.findIndex(c => c.type === 'KNIGHT' && !c.boughtThisTurn);
        if (cardIndex === -1) return { success: false, error: 'No playable Knight card' };

        activePlayer.developmentCards.splice(cardIndex, 1);
        activePlayer.playedDevelopmentCards.push('KNIGHT');
        nextState.playedDevCardThisTurn = true;
        
        events.push({ type: 'DEV_CARD_PLAYED', playerId: action.playerId, cardType: 'KNIGHT' });
        
        // Similar to MOVE_ROBBER but we need to put it into ROBBER_PLACEMENT phase first,
        // Wait, the action requires the hexId and targetPlayerId immediately.
        // Let's implement it like MOVE_ROBBER inline.
        const targetHexIndex = nextBoard.hexes.findIndex(h => h.id === action.hexId);
        if (targetHexIndex === -1) return { success: false, error: 'Invalid hex' };
        if (nextBoard.hexes[targetHexIndex]!.hasRobber) return { success: false, error: 'Robber already there' };

        // Remove old robber
        const oldHexIndex = nextBoard.hexes.findIndex(h => h.hasRobber);
        if (oldHexIndex !== -1) {
          nextBoard.hexes[oldHexIndex] = { ...nextBoard.hexes[oldHexIndex]!, hasRobber: false };
        }

        nextBoard.hexes[targetHexIndex] = { ...nextBoard.hexes[targetHexIndex]!, hasRobber: true };
        
        events.push({ type: 'ROBBER_MOVED', playerId: action.playerId, hexId: action.hexId });

        if (action.targetPlayerId) {
          if (action.targetPlayerId === action.playerId) return { success: false, error: 'Cannot steal from yourself' };
          const victim = nextPlayers.find(p => p.id === action.targetPlayerId);
          if (!victim) return { success: false, error: 'Invalid victim' };
          
          const adjacentVertices = Object.keys(boardGraph.vertices).filter(vId => boardGraph.vertices[vId]!.adjacentHexes.includes(action.hexId));
          const hasVictimBuilding = adjacentVertices.some(vId => nextBoard.vertices[vId]?.owner === action.targetPlayerId);
          
          if (!hasVictimBuilding) return { success: false, error: 'Victim is not adjacent to hex' };
          
          const stealableResources: (keyof typeof victim.resources)[] = [];
          for (const res of Object.keys(victim.resources) as (keyof typeof victim.resources)[]) {
            for (let i = 0; i < victim.resources[res]; i++) {
              stealableResources.push(res);
            }
          }
          
          if (stealableResources.length > 0) {
            const stolenIndex = Math.floor(rng.next() * stealableResources.length);
            const stolenResource = stealableResources[stolenIndex]!;
            
            victim.resources[stolenResource] -= 1;
            activePlayer.resources[stolenResource] += 1;
            events.push({ type: 'STOLEN_RESOURCE', thiefId: action.playerId, victimId: action.targetPlayerId, resource: stolenResource as Exclude<ResourceType, 'DESERT'> });
          }
        }
        
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLAY_YEAR_OF_PLENTY': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.playedDevCardThisTurn) return { success: false, error: 'Already played a development card this turn' };
        const cardIndex = activePlayer.developmentCards.findIndex(c => c.type === 'YEAR_OF_PLENTY' && !c.boughtThisTurn);
        if (cardIndex === -1) return { success: false, error: 'No playable Year of Plenty card' };

        activePlayer.developmentCards.splice(cardIndex, 1);
        activePlayer.playedDevelopmentCards.push('YEAR_OF_PLENTY');
        nextState.playedDevCardThisTurn = true;
        
        activePlayer.resources[action.resource1] += 1;
        activePlayer.resources[action.resource2] += 1;

        events.push({ type: 'DEV_CARD_PLAYED', playerId: action.playerId, cardType: 'YEAR_OF_PLENTY' });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLAY_MONOPOLY': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.playedDevCardThisTurn) return { success: false, error: 'Already played a development card this turn' };
        const cardIndex = activePlayer.developmentCards.findIndex(c => c.type === 'MONOPOLY' && !c.boughtThisTurn);
        if (cardIndex === -1) return { success: false, error: 'No playable Monopoly card' };

        activePlayer.developmentCards.splice(cardIndex, 1);
        activePlayer.playedDevelopmentCards.push('MONOPOLY');
        nextState.playedDevCardThisTurn = true;
        
        let stolenCount = 0;
        nextPlayers.forEach(p => {
          if (p.id !== action.playerId) {
            const count = p.resources[action.resource];
            if (count > 0) {
              p.resources[action.resource] = 0;
              stolenCount += count;
            }
          }
        });
        
        activePlayer.resources[action.resource] += stolenCount;

        events.push({ type: 'DEV_CARD_PLAYED', playerId: action.playerId, cardType: 'MONOPOLY' });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'PLAY_ROAD_BUILDING': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (currentState.playedDevCardThisTurn) return { success: false, error: 'Already played a development card this turn' };
        const cardIndex = activePlayer.developmentCards.findIndex(c => c.type === 'ROAD_BUILDING' && !c.boughtThisTurn);
        if (cardIndex === -1) return { success: false, error: 'No playable Road Building card' };

        // For simplicity we will handle logic by just pretending they have resources to build 2 roads, 
        // wait, we should just assign the edges if valid. 
        // Re-using logic from BUILD_ROAD could be complex without resources.
        // Let's implement simple check.
        const playerRoads = Object.values(nextBoard.edges).filter(e => e.owner === action.playerId).length;
        const edges = [action.edgeId1];
        if (action.edgeId2) edges.push(action.edgeId2);

        // Validate uniqueness, existence and ownership
        if (new Set(edges).size !== edges.length) {
          return { success: false, error: 'Duplicate road placement' };
        }
        for (const edgeId of edges) {
          const edge = nextBoard.edges[edgeId];
          if (!edge) return { success: false, error: `Invalid edge ${edgeId}` };
          if (edge.owner) return { success: false, error: `Edge ${edgeId} already occupied` };
        }

        // CRITICAL-4: enforce connectivity. The first road must connect to the
        // player's existing network; the second may connect to the network OR
        // to the just-placed first road.
        const playerHasAnyRoads = Object.values(nextBoard.edges).some(e => e.owner === action.playerId);
        const playerHasAnyBuildings = Object.values(nextBoard.vertices).some(v => v.owner === action.playerId);
        if (playerHasAnyRoads || playerHasAnyBuildings) {
          if (!isEdgeConnectedToNetwork(nextBoard, edges[0]!, action.playerId)) {
            return { success: false, error: 'First road must connect to your network' };
          }
          if (edges.length === 2 && !isEdgeConnectedToNetwork(nextBoard, edges[1]!, action.playerId, [edges[0]!])) {
            return { success: false, error: 'Second road must connect to your network or the first road' };
          }
        }

        // Enforce 15-road limit
        if (playerRoads + edges.length > 15) {
          return { success: false, error: 'Maximum roads reached' };
        }
        
        activePlayer.developmentCards.splice(cardIndex, 1);
        activePlayer.playedDevelopmentCards.push('ROAD_BUILDING');
        nextState.playedDevCardThisTurn = true;
        
        for (const edgeId of edges) {
          nextBoard.edges[edgeId] = { ...nextBoard.edges[edgeId]!, owner: action.playerId };
          events.push({ type: 'ROAD_BUILT', playerId: action.playerId, edgeId });
        }
        
        events.push({ type: 'DEV_CARD_PLAYED', playerId: action.playerId, cardType: 'ROAD_BUILDING' });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'CANCEL_TRADE': {
        if (!currentState.activeTrade) return { success: false, error: 'No active trade' };
        if (action.playerId !== currentState.activeTrade.fromPlayerId) return { success: false, error: 'Not the proposer' };
        
        const tradeId = currentState.activeTrade.id;
        nextState.activeTrade = null;
        events.push({ type: 'TRADE_CANCELLED', tradeId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      case 'END_TURN': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        if (!currentState.hasRolled) return { success: false, error: 'Must roll dice before ending turn' };
        nextState.hasRolled = false;
        const nextIndex = (activePlayerIndex + 1) % currentState.players.length;
        const nextPlayerId = currentState.players[nextIndex]!.id;
        
        // Reset boughtThisTurn for active player's cards
        activePlayer.developmentCards.forEach(c => {
          c.boughtThisTurn = false;
        });

        if (nextState.activeTrade) {
           events.push({ type: 'TRADE_CANCELLED', tradeId: nextState.activeTrade.id });
           nextState.activeTrade = null;
        }

        nextState.playedDevCardThisTurn = false;
        nextState.activePlayerId = nextPlayerId;
        events.push({ type: 'TURN_ENDED', nextPlayerId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      // System-initiated timeout during MAIN_TURN. Unlike END_TURN it does not
      // require the player to have rolled, so an AFK / stalled player advances.
      // It is intentionally NOT valid during DISCARD_PHASE / ROBBER_PLACEMENT
      // (mandatory sub-phases) or the initial placement phases.
      case 'FORCE_END_TURN': {
        if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot force end turn now' };
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        nextState.hasRolled = false;
        const nextIndex = (activePlayerIndex + 1) % currentState.players.length;
        const nextPlayerId = currentState.players[nextIndex]!.id;

        activePlayer.developmentCards.forEach(c => {
          c.boughtThisTurn = false;
        });

        if (nextState.activeTrade) {
          events.push({ type: 'TRADE_CANCELLED', tradeId: nextState.activeTrade.id });
          nextState.activeTrade = null;
        }

        nextState.playedDevCardThisTurn = false;
        nextState.activePlayerId = nextPlayerId;
        events.push({ type: 'TURN_TIMED_OUT', playerId: action.playerId, nextPlayerId });
        checkWinConditionAndAwards(nextState, events);
        return { success: true, data: { nextState, events } };
      }

      default:
        return { success: false, error: 'Unknown action type' };
    }
  },

  isValidAction(currentState: Readonly<ICatanState>, action: Readonly<ICatanAction>): boolean {
    if (currentState.status === 'FINISHED') return false;
    
    // DISCARD_RESOURCES can be sent by any player who needs to discard
    if (action.type === 'DISCARD_RESOURCES') {
      return !!currentState.pendingDiscards[action.playerId];
    }
    
    // ACCEPT_TRADE / REJECT_TRADE can be sent by the trade recipient
    if (action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE') {
      return !!currentState.activeTrade && currentState.activeTrade.toPlayerId === action.playerId;
    }
    
    // All other actions require being the active player
    if (action.playerId !== currentState.activePlayerId) return false;
    
    switch (action.type) {
      case 'ROLL_DICE':
        return currentState.turnPhase === 'MAIN_TURN' && !currentState.hasRolled;
      case 'MOVE_ROBBER':
        return currentState.turnPhase === 'ROBBER_PLACEMENT';
      case 'PLACE_INITIAL_SETTLEMENT':
        return (currentState.turnPhase === 'INITIAL_PLACEMENT_1' || currentState.turnPhase === 'INITIAL_PLACEMENT_2')
          && currentState.placementStep === 'SETTLEMENT';
      case 'PLACE_INITIAL_ROAD':
        return (currentState.turnPhase === 'INITIAL_PLACEMENT_1' || currentState.turnPhase === 'INITIAL_PLACEMENT_2')
          && currentState.placementStep === 'ROAD'
          && !!currentState.pendingRoadVertex;
      case 'BUILD_SETTLEMENT':
      case 'BUILD_ROAD':
      case 'UPGRADE_CITY':
      case 'TRADE_BANK':
      case 'BUY_DEV_CARD':
      case 'PROPOSE_TRADE':
      case 'CANCEL_TRADE':
        return currentState.turnPhase === 'MAIN_TURN';
      case 'PLAY_KNIGHT':
      case 'PLAY_YEAR_OF_PLENTY':
      case 'PLAY_MONOPOLY':
      case 'PLAY_ROAD_BUILDING':
        return currentState.turnPhase === 'MAIN_TURN' && !currentState.playedDevCardThisTurn;
      case 'END_TURN':
        return currentState.turnPhase === 'MAIN_TURN' && currentState.hasRolled;
      case 'FORCE_END_TURN':
        // System timeout: valid during MAIN_TURN regardless of hasRolled so an
        // AFK player advances. Not valid during sub-phases or initial placement.
        return currentState.turnPhase === 'MAIN_TURN';
      default:
        return false;
    }
  },

  getStateForPlayer(currentState: Readonly<ICatanState>, playerId: PlayerId): ICatanState {
    // CRITICAL-2/3: hide hidden information for each player.
    // - opp's development cards: expose only the count (not id/type/boughtThisTurn)
    // - devCardDeck: expose only the remaining count (not the ordered contents)
    return {
      ...currentState,
      devCardDeck: Array.from({ length: currentState.devCardDeck.length }, () => 'HIDDEN' as DevCardType),
      players: currentState.players.map(p =>
        p.id === playerId
          ? p
          : { ...p, developmentCards: p.developmentCards.map(() => ({ id: 'HIDDEN', type: 'KNIGHT' as DevCardType, boughtThisTurn: false })) }
      )
    };
  }
};
