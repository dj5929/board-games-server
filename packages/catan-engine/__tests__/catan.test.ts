import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
import { boardGraph } from '../src/board';
import { IRandomProvider, playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import { ICatanAction } from '../src/types';

describe('CatanEngine', () => {
  it('should initialize state and graph deterministically', () => {
    const rng = new DeterministicRNG([0.1, 0.5, 0.9]);
    const state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

    expect(state.players).toHaveLength(2);
    expect(state.board.hexes).toHaveLength(19);
    
    // Graph tests
    expect(Object.keys(state.board.vertices)).toHaveLength(54);
    expect(Object.keys(state.board.edges)).toHaveLength(72);
  });

  it('should handle basic building mechanics and resource costs', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

    // Initial resources from getInitialState are 10 of each
    expect(state.players[0]!.resources.WOOD).toBe(10);

    const vertexId = Object.keys(state.board.vertices)[0]!;
    
    // Build Settlement
    const buildSettlementAction: ICatanAction = { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId };
    const res1 = CatanEngine.reduce(state, buildSettlementAction, rng);
    
    expect(res1.success).toBe(true);
    if (!res1.success) return;
    
    state = res1.data.nextState;
    expect(state.players[0]!.resources.WOOD).toBe(9); // cost deducted
    expect(state.board.vertices[vertexId]!.owner).toBe(playerId('p1'));
    expect(state.board.vertices[vertexId]!.building).toBe('SETTLEMENT');
    expect(state.players[0]!.victoryPoints).toBe(1);

    // Try building adjacent (Distance Rule)
    const adjacentVertexId = boardGraph.vertices[vertexId]!.adjacentVertices[0]!;
    
    const buildAdjacentAction: ICatanAction = { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId: adjacentVertexId };
    const res2 = CatanEngine.reduce(state, buildAdjacentAction, rng);
    expect(res2.success).toBe(false); // Should fail distance rule

    // Build Road connected to settlement
    const adjacentEdgeId = boardGraph.vertices[vertexId]!.adjacentEdges[0]!;
    const buildRoadAction: ICatanAction = { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId: adjacentEdgeId };
    const res3 = CatanEngine.reduce(state, buildRoadAction, rng);
    expect(res3.success).toBe(true);
    if (!res3.success) return;
    state = res3.data.nextState;
    expect(state.board.edges[adjacentEdgeId]!.owner).toBe(playerId('p1'));

    // Upgrade City
    const upgradeCityAction: ICatanAction = { type: 'UPGRADE_CITY', playerId: playerId('p1'), vertexId };
    const res4 = CatanEngine.reduce(state, upgradeCityAction, rng);
    expect(res4.success).toBe(true);
    if (!res4.success) return;
    state = res4.data.nextState;
    expect(state.board.vertices[vertexId]!.building).toBe('CITY');
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it('should generate resources on dice roll', () => {
    const rng = new DeterministicRNG([0.5, 0.5]); // rolls 8 (4+4)
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

    // Find a hex that will produce 8
    const hex8 = state.board.hexes.find(h => h.numberToken === 8)!;
    
    // Find a vertex adjacent to this hex
    const vertexId = Object.keys(boardGraph.vertices).find(vId => boardGraph.vertices[vId]!.adjacentHexes.includes(hex8.id))!;
    
    // Give player a settlement there
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: playerId('p1'), building: 'SETTLEMENT' };
    
    const initialResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;

    const rollAction: ICatanAction = { type: 'ROLL_DICE', playerId: playerId('p1') };
    const res = CatanEngine.reduce(state, rollAction, rng);
    
    expect(res.success).toBe(true);
    if (!res.success) return;

    state = res.data.nextState;
    const finalResourceCount = state.players[0]!.resources[hex8.resource as keyof typeof state.players[0]['resources']] || 0;
    
    expect(finalResourceCount).toBe(initialResourceCount + 1);
  });

  it('should reject invalid actions and enforce resource constraints', () => {
    const rng = new DeterministicRNG([0.1]);
    let state = CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    // Clear resources to test constraints
    (state as any).players[0].resources = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    
    const vertexId = Object.keys(state.board.vertices)[0]!;
    const edgeId = Object.keys(state.board.edges)[0]!;
    
    // Fail settlement (no resources)
    const res1 = CatanEngine.reduce(state, { type: 'BUILD_SETTLEMENT', playerId: playerId('p1'), vertexId }, rng);
    expect(res1.success).toBe(false);
    expect(res1.success === false && res1.error).toBe('Not enough resources');
    
    // Fail road (no resources)
    const res2 = CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId }, rng);
    expect(res2.success).toBe(false);
    
    // Fail city (no resources)
    const res3 = CatanEngine.reduce(state, { type: 'UPGRADE_CITY', playerId: playerId('p1'), vertexId }, rng);
    expect(res3.success).toBe(false);
    
    // Give resources back
    (state as any).players[0].resources = { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 };
    
    // Fail city (no settlement)
    const res4 = CatanEngine.reduce(state, { type: 'UPGRADE_CITY', playerId: playerId('p1'), vertexId }, rng);
    expect(res4.success).toBe(false);
    
    // Fail road (not connected)
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: playerId('p1'), building: 'SETTLEMENT' };
    const farEdgeId = Object.keys(state.board.edges).find(e => !boardGraph.edges[e]!.adjacentVertices.includes(vertexId))!;
    const res5 = CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: playerId('p1'), edgeId: farEdgeId }, rng);
    expect(res5.success).toBe(false);

    // Fail turn for wrong player
    const res6 = CatanEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p2') }, rng);
    expect(res6.success).toBe(false);
    
    // Unknown action
    const res7 = CatanEngine.reduce(state, { type: 'UNKNOWN' } as any, rng);
    expect(res7.success).toBe(false);
    
    // isValidAction
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: playerId('p2') })).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: playerId('p1') })).toBe(true);

    // END_TURN
    const res8 = CatanEngine.reduce(state, { type: 'END_TURN', playerId: playerId('p1') }, rng);
    expect(res8.success).toBe(true);
    if (res8.success) {
      expect(res8.data.nextState.activePlayerId).toBe(playerId('p2'));
    }
  });
});
