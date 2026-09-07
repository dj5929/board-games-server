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

function reduceHelper(state: ICatanState, action: ICatanAction, rng: { next: () => number }): any {
  const result = CatanEngine.reduce(state, action, rng);
  // allow callers to assert on result.success
  return result;
}

describe('CatanEngine - RESTART_GAME (Phase 41 rematch)', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('should reset the game to a fresh initial placement state (same players)', () => {
    const rng = new DeterministicRNG([0.1, 0.2, 0.3, 0.4, 0.5]);
    const state = initMainTurn([p1, p2, p3], rng);

    // Simulate an in-progress game: give p1 resources, roll, and move the turn on.
    (state as any).players[0]!.resources = { WOOD: 3, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    (state as any).hasRolled = true;
    (state as any).activePlayerId = p2;

    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: p2 }, rng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const next = result.data.nextState;
    // Players are preserved in the same order.
    expect(next.players.map(p => p.id)).toEqual([p1, p2, p3]);
    // Board & economy are fully reset.
    expect(next.players.every(p => p.resources.WOOD === 0 && p.resources.BRICK === 0 && p.resources.SHEEP === 0 && p.resources.WHEAT === 0 && p.resources.ORE === 0)).toBe(true);
    expect(next.players.every(p => p.victoryPoints === 0)).toBe(true);
    expect(next.turnPhase).toBe('INITIAL_PLACEMENT_1');
    expect(next.placementStep).toBe('SETTLEMENT');
    expect(next.placementIndex).toBe(0);
    expect(next.pendingRoadVertex).toBeNull();
    expect(next.hasRolled).toBe(false);
    expect(next.activePlayerId).toBe(p1);
    expect(next.winner).toBeNull();
    expect(next.devCardDeck.length).toBe(25);
    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].type).toBe('GAME_RESTARTED');
  });

  it('should allow RESTART_GAME from any player, not just the active one', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = CatanEngine.getInitialState([p1, p2, p3], rng);
    // activePlayerId is p1 (first in placement order).

    expect(CatanEngine.isValidAction(state, { type: 'RESTART_GAME', playerId: p2 })).toBe(true);
    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: p3 }, rng);
    expect(result.success).toBe(true);
  });

  it('should accept RESTART_GAME even after the game is over (FINISHED)', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = CatanEngine.getInitialState([p1, p2, p3], rng) as any;
    state.status = 'FINISHED';
    state.winner = p1;

    expect(CatanEngine.isValidAction(state, { type: 'RESTART_GAME', playerId: p1 })).toBe(true);
    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: p1 }, rng);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nextState.status).toBe('IN_PROGRESS');
    }
  });
});