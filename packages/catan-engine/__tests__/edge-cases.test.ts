import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
import { boardGraph } from '../src/board';
import { playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import { ICatanAction } from '../src/types';

describe('CatanEngine - Edge Cases & Phase E Features', () => {

  it('should allow city to produce 2 resources on dice roll', () => {
    const rng = new DeterministicRNG([0.5, 0.5]); // rolls 8 (4+4)
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

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
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

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
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
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
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
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

});
