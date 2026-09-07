import { describe, it, expect } from 'vitest';
import { ScotlandYardEngine } from '../src/ScotlandYardEngine';
import { playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { ScotlandYardState, ScotlandYardAction, ScotlandYardPlayer } from '../src/types';

const mrX = playerId('mrX');
const det1 = playerId('det1');
const det2 = playerId('det2');

type HelperState = ScotlandYardState;

function newState(): HelperState {
  return ScotlandYardEngine.getInitialState([mrX, det1, det2], new DeterministicRNG([0.5]));
}

function player(state: HelperState, id: string): ScotlandYardPlayer {
  const p = state.players.find(pl => pl.id === id);
  if (!p) throw new Error(`missing player ${id}`);
  return p;
}

function reduceHelper(state: HelperState, action: ScotlandYardAction) {
  return ScotlandYardEngine.reduce(state, action, new DeterministicRNG([0.5]));
}

describe('ScotlandYardEngine - RESTART_GAME (Phase 41 rematch)', () => {
  it('should reset the game to a fresh round 1 state (same seat order)', () => {
    const state = newState();
    // Simulate a mid/late game: spend tickets, move positions, advance the turn
    // counter, and add some Mr. X sightings to the log.
    (player(state, mrX) as any).position = 42;
    (player(state, mrX) as any).tickets = { taxi: 6, bus: 4, underground: 3, secret: 1, double: 1 };
    (player(state, det1) as any).position = 77;
    (player(state, det1) as any).tickets = { taxi: 2, bus: 5, underground: 8, secret: 0, double: 0 };
    (player(state, det2) as any).tickets = { taxi: 0, bus: 3, underground: 9, secret: 0, double: 0 };
    (state as any).currentTurn = 19;
    (state as any).mrXLog = [42, 77];
    (state as any).startNode = 8;
    (state as any).skipReason = null;

    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: det1 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const next = result.data.nextState as ScotlandYardState;
    // Seat order preserved: Mr. X stays Mr. X.
    expect(next.playerOrder).toEqual([mrX, det1, det2]);
    expect(next.players.map(p => p.id)).toEqual([mrX, det1, det2]);
    expect(player(next, mrX).role).toBe('MR_X');
    expect(player(next, det1).role).toBe('DETECTIVE');
    // State fully reset to round 1.
    expect(next.currentTurn).toBe(1);
    expect(next.status).toBe('IN_PROGRESS');
    expect(next.mrXLog).toEqual([]);
    expect((next as any).winner).toBeUndefined();
    expect(player(next, mrX).tickets.taxi).toBe(4);
    expect(player(next, mrX).tickets.double).toBe(2);
    expect(player(next, det1).tickets.taxi).toBe(10);
    expect(next.activePlayerId).toBe(mrX);
    expect(result.data.events).toEqual([{ type: 'GAME_RESTARTED' }]);
  });

  it('should accept RESTART_GAME from any player, not just the active one', () => {
    const state = newState(); // active = mrX
    expect(ScotlandYardEngine.isValidAction(state, { type: 'RESTART_GAME', playerId: det2 })).toBe(true);
    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: det2 });
    expect(result.success).toBe(true);
  });

  it('should accept RESTART_GAME even after the game is over (FINISHED)', () => {
    const state = newState();
    (state as any).status = 'FINISHED';
    (state as any).winner = 'MR_X';

    expect(ScotlandYardEngine.isValidAction(state, { type: 'RESTART_GAME', playerId: det1 })).toBe(true);
    const result = reduceHelper(state, { type: 'RESTART_GAME', playerId: det1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.nextState as ScotlandYardState).status).toBe('IN_PROGRESS');
    }
  });
});