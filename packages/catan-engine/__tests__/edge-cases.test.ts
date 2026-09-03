import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
import { boardGraph } from '../src/board';
import { playerId, type PlayerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { ICatanAction, ICatanState } from '../src/types';

function initMainTurn(ids: PlayerId[], rng: { next: () => number }): ICatanState {
  const state = CatanEngine.getInitialState(ids, rng);
  return {
    ...state,
    turnPhase: 'MAIN_TURN',
    placementStep: 'SETTLEMENT',
    placementIndex: 0,
    pendingRoadVertex: null
  };
}

describe('CatanEngine - Edge Cases & Phase E Features', () => {

  it('should allow city to produce 2 resources on dice roll', () => {
    const rng = new DeterministicRNG([0.5, 0.5]); // rolls 8 (4+4)
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    const hex8 = state.board.hexes.find(h => h.numberToken === 8)!;
    const vertexId = Object.keys(boardGraph.vertices).find(vId => boardGraph.vertices[vId]!.adjacentHexes.includes(hex8.id))!;
    
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: playerId('p1'), building: 'CITY' };
    
    const initialResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;

    const rollAction: ICatanAction = { type: 'ROLL_DICE', playerId: playerId('p1') };
    const res = CatanEngine.reduce(state, rollAction, rng);
    
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    const finalResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;
    expect(finalResourceCount).toBe(initialResourceCount + 2); // City produces 2!
  });

  it('should block production if Robber is on hex', () => {
    const rng = new DeterministicRNG([0.5, 0.5]); // rolls 8
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    const hex8 = state.board.hexes.find(h => h.numberToken === 8)!;
    const vertexId = Object.keys(boardGraph.vertices).find(vId => boardGraph.vertices[vId]!.adjacentHexes.includes(hex8.id))!;
    
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: playerId('p1'), building: 'SETTLEMENT' };
    
    // Move robber to hex8
    const hex8Index = state.board.hexes.findIndex(h => h.id === hex8.id);
    (state as any).board.hexes[hex8Index].hasRobber = true;
    // Remove robber from desert
    const desertIndex = state.board.hexes.findIndex(h => h.resource === 'DESERT');
    if (desertIndex >= 0) (state as any).board.hexes[desertIndex].hasRobber = false;
    
    const initialResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;

    const rollAction: ICatanAction = { type: 'ROLL_DICE', playerId: playerId('p1') };
    const res = CatanEngine.reduce(state, rollAction, rng);
    
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    const finalResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;
    expect(finalResourceCount).toBe(initialResourceCount); // Blocked!
  });

  it('should fail building on occupied edge/vertex and duplicate builds', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    (state as any).players[0].resources = { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 };
    
    const vertexId = Object.keys(state.board.vertices)[0]!;
    const edgeId = boardGraph.vertices[vertexId]!.adjacentEdges[0]!;

    // P2 occupies the vertex and edge
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: playerId('p2'), building: 'SETTLEMENT' };
    (state as any).board.edges[edgeId] = { ...state.board.edges[edgeId], owner: playerId('p2') };

    // P1 tries to build on it
    const buildSettlementAction: ICatanAction = { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId };
    const res1 = CatanEngine.reduce(state, buildSettlementAction, rng);
    expect(res1.success).toBe(false);
    expect(res1.success === false && res1.error).toBe('Vertex is already occupied');

    const buildRoadAction: ICatanAction = { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId };
    const res2 = CatanEngine.reduce(state, buildRoadAction, rng);
    expect(res2.success).toBe(false);
    expect(res2.success === false && res2.error).toBe('Edge already occupied');
  });

  it('should enforce piece limits (5 settlements, 4 cities, 15 roads)', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Give player infinite resources
    (state as any).players[0].resources = { WOOD: 100, BRICK: 100, SHEEP: 100, WHEAT: 100, ORE: 100 };

    // Setup 5 settlements for p1
    const vIds = Object.keys(state.board.vertices).slice(0, 5);
    vIds.forEach(vId => {
      (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: playerId('p1'), building: 'SETTLEMENT' };
    });

    const vId6 = Object.keys(state.board.vertices)[5]!;
    // Bypass distance rule for testing piece limits by just manually giving them an adjacent road
    const edgeId6 = boardGraph.vertices[vId6]!.adjacentEdges[0]!;
    (state as any).board.edges[edgeId6] = { ...state.board.edges[edgeId6], owner: playerId('p1') };

    const buildSettlementAction: ICatanAction = { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId: vId6 };
    let res = CatanEngine.reduce(state, buildSettlementAction, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Maximum settlements reached');

    // Upgrade 4 settlements to cities
    for (let i = 0; i < 4; i++) {
      (state as any).board.vertices[vIds[i]!] = { ...state.board.vertices[vIds[i]!], owner: playerId('p1'), building: 'CITY' };
    }

    // Try upgrading the 5th settlement to city
    const buildCityAction: ICatanAction = { type: 'UPGRADE_CITY', playerId: playerId('p1'), vertexId: vIds[4]! };
    res = CatanEngine.reduce(state, buildCityAction, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Maximum cities reached');

    // Setup 15 roads for p1
    const eIds = Object.keys(state.board.edges).slice(0, 15);
    eIds.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p1') };
    });

    // We can't build road 16 because of the limit
    const eId16 = Object.keys(state.board.edges)[16]!;
    // Fake adjacent vertex owned by p1 to satisfy connection rule
    const adjV = boardGraph.edges[eId16]!.adjacentVertices[0]!;
    (state as any).board.vertices[adjV] = { ...state.board.vertices[adjV], owner: playerId('p1'), building: 'SETTLEMENT' };
    
    const buildRoadAction: ICatanAction = { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId: eId16 };
    res = CatanEngine.reduce(state, buildRoadAction, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Maximum roads reached');
  });

  it('should calculate best trade rate from ports', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Give player resources
    (state as any).players[0].resources = { WOOD: 10, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    
    // Without any ports, rate is 4:1
    let tradeAction: ICatanAction = { type: 'TRADE_BANK', playerId: playerId('p1'), offerResource: 'WOOD', requestResource: 'BRICK', amount: 1 };
    let res = CatanEngine.reduce(state, tradeAction, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.resources.WOOD).toBe(6);
    expect(state.players[0]!.resources.BRICK).toBe(1);

    // Setup 3:1 port
    const vId1 = Object.keys(state.board.vertices)[0]!;
    const eId1 = boardGraph.vertices[vId1]!.adjacentEdges[0]!;
    (state as any).board.vertices[vId1] = { ...state.board.vertices[vId1], owner: playerId('p1'), building: 'SETTLEMENT' };
    (state as any).board.edges[eId1] = { ...state.board.edges[eId1], port: '3:1' };

    tradeAction = { type: 'TRADE_BANK', playerId: playerId('p1'), offerResource: 'WOOD', requestResource: 'BRICK', amount: 1 };
    res = CatanEngine.reduce(state, tradeAction, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.resources.WOOD).toBe(3); // 6 - 3
    expect(state.players[0]!.resources.BRICK).toBe(2);

    // Setup 2:1 port
    const vId2 = Object.keys(state.board.vertices)[1]!;
    const eId2 = boardGraph.vertices[vId2]!.adjacentEdges[0]!;
    (state as any).board.vertices[vId2] = { ...state.board.vertices[vId2], owner: playerId('p1'), building: 'CITY' };
    (state as any).board.edges[eId2] = { ...state.board.edges[eId2], port: 'WOOD' };

    tradeAction = { type: 'TRADE_BANK', playerId: playerId('p1'), offerResource: 'WOOD', requestResource: 'BRICK', amount: 1 };
    res = CatanEngine.reduce(state, tradeAction, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.resources.WOOD).toBe(1); // 3 - 2
    expect(state.players[0]!.resources.BRICK).toBe(3);
  });

  it('should enforce discard on 7 roll for players with > 7 cards', () => {
    const rng = new DeterministicRNG([0.1, 0.5]); 
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Give p1 8 cards, p2 7 cards
    (state as any).players[0].resources = { WOOD: 8, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    (state as any).players[1].resources = { WOOD: 7, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    
    const rng7 = new DeterministicRNG([0.34, 0.51]); // 3 + 4 = 7
    let res = CatanEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng7);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.turnPhase).toBe('DISCARD_PHASE');
    expect(state.pendingDiscards[playerId('p1')]).toBe(4);
    expect(state.pendingDiscards[playerId('p2')]).toBeUndefined();

    // Discard incorrect amount
    res = CatanEngine.reduce(state, { type: 'DISCARD_RESOURCES', playerId: playerId('p1'), resources: { WOOD: 3, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 } }, rng);
    expect(res.success).toBe(false);

    // Discard correct amount
    res = CatanEngine.reduce(state, { type: 'DISCARD_RESOURCES', playerId: playerId('p1'), resources: { WOOD: 4, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 } }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.players[0]!.resources.WOOD).toBe(4);
    expect(state.turnPhase).toBe('ROBBER_PLACEMENT');
  });

  it('should steal a resource when moving robber', () => {
    const rng = new DeterministicRNG([0.34, 0.51, 0.9]); // 7 roll, then 0.9 for stealing random card
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Setup settlements for p2
    const vId = Object.keys(state.board.vertices)[0]!;
    (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: playerId('p2'), building: 'SETTLEMENT' };
    const adjHexId = boardGraph.vertices[vId]!.adjacentHexes[0]!;

    // Give p2 some resources
    (state as any).players[1].resources = { WOOD: 1, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    (state as any).players[0].resources = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };

    // Move to robber placement phase directly to bypass diceroll discard logic
    (state as any).turnPhase = 'ROBBER_PLACEMENT';

    // Move robber and steal
    let res = CatanEngine.reduce(state, { type: 'MOVE_ROBBER', playerId: playerId('p1'), hexId: adjHexId, targetPlayerId: playerId('p2') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.turnPhase).toBe('MAIN_TURN');
    expect(state.players[1]!.resources.WOOD).toBe(0); // Stolen
    expect(state.players[0]!.resources.WOOD).toBe(1); // Received
  });

  it('should enforce dev card play rules (1 per turn, not on bought turn)', () => {
    const rng = new DeterministicRNG([0.1]); 
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Give player cards directly
    (state as any).players[0].developmentCards = [
      { id: '1', type: 'KNIGHT', boughtThisTurn: true },
      { id: '2', type: 'YEAR_OF_PLENTY', boughtThisTurn: false },
      { id: '3', type: 'MONOPOLY', boughtThisTurn: false },
    ];

    // Try playing card bought this turn
    let res = CatanEngine.reduce(state, { type: 'PLAY_KNIGHT', playerId: playerId('p1'), hexId: '0,0' }, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('No playable Knight card');

    // Play first valid card
    res = CatanEngine.reduce(state, { type: 'PLAY_YEAR_OF_PLENTY', playerId: playerId('p1'), resource1: 'WOOD', resource2: 'BRICK' }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.playedDevCardThisTurn).toBe(true);

    // Try playing second card in same turn
    res = CatanEngine.reduce(state, { type: 'PLAY_MONOPOLY', playerId: playerId('p1'), resource: 'ORE' }, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Already played a development card this turn');
  });

  it('should allow VP cards to bypass dev card play limits', () => {
    const rng = new DeterministicRNG([0.1]); 
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Give player VP cards and a normal card
    (state as any).players[0].developmentCards = [
      { id: '1', type: 'VICTORY_POINT', boughtThisTurn: true },
      { id: '2', type: 'VICTORY_POINT', boughtThisTurn: true },
    ];

    // VP cards are counted implicitly without an action. 
    // We just verify they add to the score even if bought this turn, 
    // and multiple count.
    
    // Just end turn to trigger checkWinConditionAndAwards
    (state as any).hasRolled = true;
    let res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    // Check VP is incremented properly
    // p1 has 0 base VPs (no settlements placed in this test state technically) + 2 from VP cards. 
    // Actually getInitialState has 0 settlements, so VP = 2.
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it('should award Longest Road (2 VPs) for 5+ roads', () => {
    const rng = new DeterministicRNG([0.1]); 
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    // Find all edges around hex "0,0". There are 6 edges forming a cycle.
    // Taking 5 of them gives a continuous path of length 5.
    const edgesAroundHex = Object.keys(boardGraph.edges).filter(eId => boardGraph.edges[eId]!.adjacentHexes.includes('0,0'));
    
    // Take exactly 5 edges
    for (let i = 0; i < 5; i++) {
      const eId = edgesAroundHex[i]!;
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p1') };
    }

    (state as any).hasRolled = true;
    let res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.longestRoadOwner).toBe(playerId('p1'));
    expect(state.longestRoadLength).toBe(5);
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it('should award Largest Army (2 VPs) for 3+ knights', () => {
    const rng = new DeterministicRNG([0.1]); 
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    
    (state as any).players[0].playedDevelopmentCards = ['KNIGHT', 'KNIGHT', 'KNIGHT'];

    (state as any).hasRolled = true;
    let res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    expect(state.largestArmyOwner).toBe(playerId('p1'));
    expect(state.largestArmySize).toBe(3);
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it('should revoke Longest Road when two players tie and the holder is out of the race', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    // Two disjoint 5-road chains: p1 and p2 both reach 5 (tie)
    const chain1 = ['-2,0|-2,1', '-1,0|-2,0', '-1,-1|-1,0', '-1,0|0,-1', '0,-1|0,0'];
    const chain2 = ['-2,1|-2,2', '-1,1|-2,1', '-1,0|-1,1', '-1,1|0,0', '0,0|0,1'];
    chain1.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p1') };
    });
    chain2.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p2') };
    });

    // p3 currently holds Longest Road but is not among the tied candidates
    (state as any).longestRoadOwner = playerId('p3');
    (state as any).longestRoadLength = 6;
    (state as any).hasRolled = true;

    const res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.longestRoadOwner).toBeNull();
    expect(res.data.nextState.longestRoadLength).toBe(4);
  });

  it('should keep Longest Road and refresh its length when the holder is inside the tie', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    const chain1 = ['-2,0|-2,1', '-1,0|-2,0', '-1,-1|-1,0', '-1,0|0,-1', '0,-1|0,0'];
    const chain2 = ['-2,1|-2,2', '-1,1|-2,1', '-1,0|-1,1', '-1,1|0,0', '0,0|0,1'];
    chain1.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p1') };
    });
    chain2.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: playerId('p2') };
    });

    // p1 already holds Longest Road with a stale length of 4
    (state as any).longestRoadOwner = playerId('p1');
    (state as any).longestRoadLength = 4;
    (state as any).hasRolled = true;

    const res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.longestRoadOwner).toBe(playerId('p1'));
    expect(res.data.nextState.longestRoadLength).toBe(5);
  });

  it('should build a road connected through an empty vertex adjacent to an own road', () => {
    const rng = new DeterministicRNG([0.5]); // rolls 8
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    (state as any).players[0].resources = { WOOD: 3, BRICK: 3, SHEEP: 1, WHEAT: 1, ORE: 0 };

    // vA holds a settlement; e1 connects vA--vB; e2 connects vB--vC with vB/vC empty.
    const vA = '-2,0|-2,1|-3,1';
    const e1 = '-2,0|-2,1';
    const e2 = '-1,0|-2,0';

    let res = CatanEngine.reduce(state, { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId: vA }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    res = CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId: e1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;

    // e2 only touches own road e1 through empty vertex vB (no settlement on it)
    res = CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId: e2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.board.edges[e2]!.owner).toBe(playerId('p1'));
  });

  it('isValidAction should accept build/trade actions in MAIN_TURN and reject placement actions there', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    // build/trade actions are valid during MAIN_TURN
    expect(CatanEngine.isValidAction(state, { type: 'TRADE_BANK', playerId: playerId('p1'), offerResource: 'WOOD', requestResource: 'BRICK', amount: 1 })).toBe(true);
    expect(CatanEngine.isValidAction(state, { type: 'PROPOSE_TRADE', playerId: playerId('p1'), toPlayerId: playerId('p2'), offer: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 }, request: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 } })).toBe(true);

    // Initial placement actions are only valid during the placement phases
    expect(CatanEngine.isValidAction(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: playerId('p1'), vertexId: '-2,0|-2,1|-3,1' })).toBe(false);

    // BUILD actions fail validation outside MAIN_TURN
    (state as any).turnPhase = 'ROBBER_PLACEMENT';
    expect(CatanEngine.isValidAction(state, { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId: '-2,0|-2,1|-3,1' })).toBe(false);
  });

  it('should guard END_TURN against the wrong player and a missing roll', () => {
    const rng = new DeterministicRNG([0.1]);
    const state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);

    // Wrong player cannot end the turn
    let res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p2') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('Not your turn');

    // Must roll before ending the turn
    res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('Must roll dice before ending turn');
  });

  it('should skip the award re-check after the game already finished', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([playerId('p1'), playerId('p2'), playerId('p3')], rng);
    (state as any).players[0].resources = { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 };

    // Give p1 five cities = 10 points -> finishing on a VP-affecting action
    const vIds = Object.keys(state.board.vertices).slice(0, 5);
    vIds.forEach(vId => {
      (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: playerId('p1'), building: 'CITY' };
    });

    let res = CatanEngine.reduce(state, { type: 'BUY_DEV_CARD', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');

    // A further action must not re-award long road / largest army
    const finished = res.data.nextState;
    (finished as any).longestRoadOwner = playerId('p2');
    res = CatanEngine.reduce(finished, { type: 'BUY_DEV_CARD', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.longestRoadOwner).toBe(playerId('p2'));
    expect(res.data.events.filter(e => e.type === 'LONGEST_ROAD_AWARDED')).toHaveLength(0);
  });

});
