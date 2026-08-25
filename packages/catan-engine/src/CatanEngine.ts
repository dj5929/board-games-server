import { IGameEngine, IRandomProvider, Result, IStateTransition, PlayerId, playerId } from '@packages/engine-core';
import { ICatanState, ICatanAction, ICatanEvent, CatanPlayer, ResourceType, Hex, Vertex, Edge } from './types';
import { generateBoard, boardGraph } from './board';

// Helper type to allow mutating the cloned state in reduce
type MutableCatanState = {
  -readonly [P in keyof ICatanState]:
    P extends 'players' ? CatanPlayer[] :
    P extends 'board' ? { hexes: Hex[]; vertices: Record<string, Vertex>; edges: Record<string, Edge> } :
    ICatanState[P];
};

export const CatanEngine: IGameEngine<ICatanState, ICatanAction, ICatanEvent> = {
  getInitialState(playerIds: PlayerId[], rng: IRandomProvider): ICatanState {
    const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706'];
    const players: CatanPlayer[] = playerIds.map((id, index) => ({
      id,
      color: colors[index % colors.length]!,
      resources: { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 },
      victoryPoints: 0
    }));

    return {
      status: 'IN_PROGRESS',
      players,
      board: generateBoard(rng),
      turnPhase: 'MAIN_TURN', // Start in main turn for simplicity right now
      activePlayerId: players[0]!.id,
      activeTrade: null
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
    const nextPlayers = currentState.players.map(p => ({ ...p, resources: { ...p.resources } }));
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
      activeTrade: currentState.activeTrade ? { ...currentState.activeTrade } : null
    };

    const events: ICatanEvent[] = [];

    switch (action.type) {
      case 'ROLL_DICE': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        
        const dice1 = Math.floor(rng.next() * 6) + 1;
        const dice2 = Math.floor(rng.next() * 6) + 1;
        const total = dice1 + dice2;
        events.push({ type: 'DICE_ROLLED', dice1, dice2, total });

        if (total !== 7) {
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

        return { success: true, data: { nextState, events } };
      }
      
      case 'BUILD_SETTLEMENT': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        
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
        activePlayer.victoryPoints += 1;

        events.push({ type: 'SETTLEMENT_BUILT', playerId: action.playerId, vertexId });
        return { success: true, data: { nextState, events } };
      }

      case 'BUILD_ROAD': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        
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

        const adjacentVertices = boardGraph.edges[edgeId]!.adjacentVertices;
        let isConnected = false;
        
        for (const vId of adjacentVertices) {
          const v = nextBoard.vertices[vId];
          if (v && v.owner === action.playerId) {
            isConnected = true;
            break;
          }
          if (!v || v.owner === null || v.owner === action.playerId) {
            const adjEdges = boardGraph.vertices[vId]!.adjacentEdges;
            if (adjEdges.some(adjE => nextBoard.edges[adjE]?.owner === action.playerId)) {
              isConnected = true;
              break;
            }
          }
        }
        
        const playerHasAnyBuildings = Object.values(nextBoard.vertices).some(v => v.owner === action.playerId);
        if (playerHasAnyBuildings && !isConnected) {
          return { success: false, error: 'Must build connected to a road or settlement' };
        }

        activePlayer.resources.WOOD -= 1;
        activePlayer.resources.BRICK -= 1;
        
        nextBoard.edges[edgeId] = { ...edge, owner: action.playerId };
        
        events.push({ type: 'ROAD_BUILT', playerId: action.playerId, edgeId });
        return { success: true, data: { nextState, events } };
      }

      case 'UPGRADE_CITY': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        
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
        activePlayer.victoryPoints += 1;

        events.push({ type: 'CITY_UPGRADED', playerId: action.playerId, vertexId });
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
          id: Math.random().toString(36).substring(7),
          fromPlayerId: action.playerId,
          toPlayerId: action.toPlayerId,
          offer: { ...action.offer },
          request: { ...action.request }
        };
        
        events.push({ type: 'TRADE_PROPOSED', trade: nextState.activeTrade });
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
        return { success: true, data: { nextState, events } };
      }

      case 'REJECT_TRADE': {
        if (!currentState.activeTrade) return { success: false, error: 'No active trade' };
        if (action.playerId !== currentState.activeTrade.toPlayerId) return { success: false, error: 'Not the recipient' };
        
        const tradeId = currentState.activeTrade.id;
        nextState.activeTrade = null;
        events.push({ type: 'TRADE_REJECTED', tradeId });
        return { success: true, data: { nextState, events } };
      }

      case 'CANCEL_TRADE': {
        if (!currentState.activeTrade) return { success: false, error: 'No active trade' };
        if (action.playerId !== currentState.activeTrade.fromPlayerId) return { success: false, error: 'Not the proposer' };
        
        const tradeId = currentState.activeTrade.id;
        nextState.activeTrade = null;
        events.push({ type: 'TRADE_CANCELLED', tradeId });
        return { success: true, data: { nextState, events } };
      }

      case 'END_TURN': {
        if (action.playerId !== currentState.activePlayerId) return { success: false, error: 'Not your turn' };
        const nextIndex = (activePlayerIndex + 1) % currentState.players.length;
        const nextPlayerId = currentState.players[nextIndex]!.id;
        
        if (nextState.activeTrade) {
           events.push({ type: 'TRADE_CANCELLED', tradeId: nextState.activeTrade.id });
           nextState.activeTrade = null;
        }

        nextState.activePlayerId = nextPlayerId;
        events.push({ type: 'TURN_ENDED', nextPlayerId });
        return { success: true, data: { nextState, events } };
      }

      default:
        return { success: false, error: 'Unknown action type' };
    }
  },

  isValidAction(currentState: Readonly<ICatanState>, action: Readonly<ICatanAction>): boolean {
    if (action.playerId !== currentState.activePlayerId) return false;
    return true;
  }
};
