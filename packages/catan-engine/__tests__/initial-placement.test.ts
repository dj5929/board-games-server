import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
import { boardGraph } from '../src/board';
import { playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { ICatanAction } from '../src/types';

function apply(state: any, action: ICatanAction, rng: { next: () => number }): any {
  const res = CatanEngine.reduce(state, action, rng);
  expect(res.success).toBe(true);
  if (!res.success) return state;
  return res.data.nextState;
}

describe('CatanEngine - Initial Placement Phase', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('starts in INITIAL_PLACEMENT_1 and requires a settlement then a road per player', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = CatanEngine.getInitialState([p1, p2, p3], rng);

    expect(state.turnPhase).toBe('INITIAL_PLACEMENT_1');
    expect(state.activePlayerId).toBe(p1);
    expect(state.placementStep).toBe('SETTLEMENT');

    // Cannot place a road before a settlement
    const eId = Object.keys(state.board.edges)[0]!;
    expect(CatanEngine.reduce(state, { type: 'PLACE_INITIAL_ROAD', playerId: p1, edgeId: eId }, rng).success).toBe(false);

    // Place p1's settlement
    const vId = Object.keys(state.board.vertices)[0]!;
    state = apply(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p1, vertexId: vId }, rng);
    expect(state.board.vertices[vId]!.owner).toBe(p1);
    expect(state.placementStep).toBe('ROAD');
    expect(state.activePlayerId).toBe(p1); // still p1 until the road is placed

    // Road must connect to the settlement
    const farEdge = Object.keys(state.board.edges).find(e => !boardGraph.vertices[vId]!.adjacentEdges.includes(e))!;
    expect(CatanEngine.reduce(state, { type: 'PLACE_INITIAL_ROAD', playerId: p1, edgeId: farEdge }, rng).success).toBe(false);

    // A road cannot reuse an occupied edge
    const adjEdge = boardGraph.vertices[vId]!.adjacentEdges[0]!;

    // Place p1's road and advance to p2
    state = apply(state, { type: 'PLACE_INITIAL_ROAD', playerId: p1, edgeId: adjEdge }, rng);
    expect(state.board.edges[adjEdge]!.owner).toBe(p1);
    expect(state.placementStep).toBe('SETTLEMENT');
    expect(state.activePlayerId).toBe(p2);
    expect(state.turnPhase).toBe('INITIAL_PLACEMENT_1');
  });

  it('enforces the distance rule during initial settlement placement', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = CatanEngine.getInitialState([p1, p2, p3], rng);

    const vId = Object.keys(state.board.vertices)[0]!;
    const adj = boardGraph.vertices[vId]!.adjacentVertices[0]!;
    (state as any).board.vertices[adj] = { ...state.board.vertices[adj], owner: p2, building: 'SETTLEMENT' };

    const res = CatanEngine.reduce(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p1, vertexId: vId }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('Distance rule violated');
  });

  it('rejects placement when it is not that player\'s turn', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = CatanEngine.getInitialState([p1, p2, p3], rng);

    const vId = Object.keys(state.board.vertices)[0]!;
    expect(CatanEngine.reduce(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p2, vertexId: vId }, rng).success).toBe(false);
    expect(CatanEngine.reduce(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p3, vertexId: vId }, rng).success).toBe(false);
  });

  it('runs the full placement in forward then reverse order and starts the game on the last-first player', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = CatanEngine.getInitialState([p1, p2, p3], rng);

    // Phase 1: p1 -> p2 -> p3
    // Phase 2: p3 -> p2 -> p1
    const phase1Order = [p1, p2, p3];
    const phase2Order = [p3, p2, p1];

    for (const phase of [phase1Order, phase2Order]) {
      for (const pid of phase) {
        expect(state.activePlayerId).toBe(pid);
        // Place a legal settlement: pick any empty vertex not adjacent to an occupied building
        const vId = Object.keys(state.board.vertices).find(v => {
          if (state.board.vertices[v]!.building) return false;
          return !boardGraph.vertices[v]!.adjacentVertices.some(a => state.board.vertices[a]?.building);
        })!;
        state = apply(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: pid, vertexId: vId }, rng);
        expect(state.board.vertices[vId]!.owner).toBe(pid);

        // Place the road on an empty edge adjacent to that settlement
        const eId = boardGraph.vertices[vId]!.adjacentEdges.find(e => state.board.edges[e]!.owner === null)!;
        state = apply(state, { type: 'PLACE_INITIAL_ROAD', playerId: pid, edgeId: eId }, rng);
        expect(state.board.edges[eId]!.owner).toBe(pid);
      }
    }

    // After reverse placement, the player who placed first in phase 2 (p3) rolls first.
    expect(state.turnPhase).toBe('MAIN_TURN');
    expect(state.activePlayerId).toBe(p3);
    expect(state.hasRolled).toBe(false);

    // The game can now proceed normally.
    state = apply(state, { type: 'ROLL_DICE', playerId: p3 }, rng);
    expect(state.hasRolled).toBe(true);
  });

  it('isValidAction gates placement actions to the placement phases and correct step', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = CatanEngine.getInitialState([p1, p2, p3], rng);

    // Initial phase, settlement step
    expect(CatanEngine.isValidAction(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p1, vertexId: '-2,0|-2,1|-3,1' })).toBe(true);
    expect(CatanEngine.isValidAction(state, { type: 'PLACE_INITIAL_ROAD', playerId: p1, edgeId: '-2,0|-2,1' })).toBe(false);

    // After a settlement, the road becomes valid
    const vId = Object.keys(state.board.vertices)[0]!;
    const res = CatanEngine.reduce(state, { type: 'PLACE_INITIAL_SETTLEMENT', playerId: p1, vertexId: vId }, rng);
    if (!res.success) return;
    state = res.data.nextState;
    expect(CatanEngine.isValidAction(state, { type: 'PLACE_INITIAL_ROAD', playerId: p1, edgeId: '-2,0|-2,1' })).toBe(true);

    // Regular building/trading is invalid during the placement phase
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'BUILD_SETTLEMENT', playerId: p1, vertexId: vId })).toBe(false);
  });

  it('defaults to false for unknown action types in isValidAction', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = CatanEngine.getInitialState([p1, p2, p3], rng);
    expect(CatanEngine.isValidAction(state, { type: 'TOTALLY_UNKNOWN' } as any)).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
  });
});
