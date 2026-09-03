import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
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

function apply(state: any, action: ICatanAction, rng: { next: () => number }): any {
  const res = CatanEngine.reduce(state, action, rng);
  expect(res.success).toBe(true);
  if (!res.success) return state;
  return res.data.nextState;
}

describe('CatanEngine - FORCE_END_TURN (turn timer)', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('allows FORCE_END_TURN before rolling during MAIN_TURN (unlike END_TURN)', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = initMainTurn([p1, p2, p3], rng);

    expect(CatanEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(true);

    const result = CatanEngine.reduce(state, { type: 'FORCE_END_TURN', playerId: p1 }, rng);
    expect(result.success).toBe(true);
  });

  it('advances to the next player and emits TURN_TIMED_OUT', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = initMainTurn([p1, p2, p3], rng);

    const result = CatanEngine.reduce(state, { type: 'FORCE_END_TURN', playerId: p1 }, rng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.activePlayerId).toBe(p2);
    expect(result.data.events).toContainEqual({
      type: 'TURN_TIMED_OUT',
      playerId: p1,
      nextPlayerId: p2
    });
    expect(result.data.events.some(e => e.type === 'TURN_ENDED')).toBe(false);
  });

  it('is rejected during sub-phases (ROBBER_PLACEMENT) and initial placement', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = initMainTurn([p1, p2, p3], rng);

    const robberState: ICatanState = { ...state, turnPhase: 'ROBBER_PLACEMENT' };
    expect(CatanEngine.isValidAction(robberState, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(false);
    expect(CatanEngine.reduce(robberState, { type: 'FORCE_END_TURN', playerId: p1 }, rng).success).toBe(false);

    const placementState: ICatanState = { ...state, turnPhase: 'INITIAL_PLACEMENT_1' };
    expect(CatanEngine.isValidAction(placementState, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(false);
  });

  it('is rejected for a non-active player', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = initMainTurn([p1, p2, p3], rng);
    expect(CatanEngine.isValidAction(state, { type: 'FORCE_END_TURN', playerId: p2 })).toBe(false);
  });

  it('cancels an active trade when force-ending', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = initMainTurn([p1, p2, p3], rng);
    // Give the active player a resource so a trade proposal is valid
    const withResource: ICatanState = {
      ...state,
      players: state.players.map(p => p.id === p1
        ? { ...p, resources: { ...p.resources, WOOD: 1 } }
        : p)
    } as any;
    const proposed = apply(withResource, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { WOOD: 1, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 }, request: { WOOD: 0, BRICK: 1, SHEEP: 0, WHEAT: 0, ORE: 0 } }, rng);
    expect(proposed.activeTrade).toBeTruthy();

    const result = CatanEngine.reduce(proposed, { type: 'FORCE_END_TURN', playerId: p1 }, rng);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nextState.activeTrade).toBeNull();
      expect(result.data.events.some(e => e.type === 'TRADE_CANCELLED')).toBe(true);
    }
  });
});
