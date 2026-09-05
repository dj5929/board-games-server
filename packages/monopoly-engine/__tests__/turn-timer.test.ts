import { describe, it, expect } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import type { IMonopolyState } from '../src/types';
import { playerId } from '@packages/engine-core';

const mockRng = { next: () => 0.5 };
const p1 = playerId('p1');
const p2 = playerId('p2');
const p3 = playerId('p3');

function initState(): IMonopolyState {
  return MonopolyEngine.getInitialState([p1, p2, p3], mockRng);
}

describe('MonopolyEngine - FORCE_END_TURN (turn timer)', () => {
  it('allows FORCE_END_TURN before rolling (unlike END_TURN)', () => {
    const state = initState();
    // END_TURN is rejected when the player has not rolled
    expect(MonopolyEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(false);
    // FORCE_END_TURN is allowed regardless of hasRolled
    expect(MonopolyEngine.isValidAction(state, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(true);
  });

  it('advances to the next active player and emits TURN_TIMED_OUT', () => {
    const state = initState();
    const result = MonopolyEngine.reduce(state, { type: 'FORCE_END_TURN', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.currentPlayerIndex).toBe(1);
    expect(result.data.events).toContainEqual({
      type: 'TURN_TIMED_OUT',
      playerId: p1,
      nextPlayerId: p2
    });
    expect(result.data.events.some(e => e.type === 'TURN_ENDED')).toBe(false);
  });

  it('resets the rolled state of the timed-out player', () => {
    const state = initState();
    // Force a roll so the current player has hasRolled === true
    const rolled = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;

    const result = MonopolyEngine.reduce(rolled.data.nextState, { type: 'FORCE_END_TURN', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextPlayer = result.data.nextState.players[0]!;
    expect(nextPlayer.hasRolled).toBe(false);
  });

  it('skips bankrupt players when advancing', () => {
    const state = initState();
    // Mark p2 bankrupt
    const modified: IMonopolyState = {
      ...state,
      players: state.players.map(p => p.id === p2 ? { ...p, status: 'BANKRUPT' } : p)
    };
    const result = MonopolyEngine.reduce(modified, { type: 'FORCE_END_TURN', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.currentPlayerIndex).toBe(2); // skips p2
    expect(result.data.events).toContainEqual({
      type: 'TURN_TIMED_OUT',
      playerId: p1,
      nextPlayerId: p3
    });
  });

  it('moves LOBBY → IN_PROGRESS on the first successful action (so the server turn timer runs)', () => {
    const state = initState();
    expect(MonopolyEngine.isValidAction(state, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(true);

    const result = MonopolyEngine.reduce(state, { type: 'FORCE_END_TURN', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.status).toBe('IN_PROGRESS');
  });

  it('returns to LOBBY on RESTART_GAME, then re-enters IN_PROGRESS on the next action', () => {
    const state = initState();
    const started = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
    expect(started.success).toBe(true);
    if (!started.success) return;
    expect(started.data.nextState.status).toBe('IN_PROGRESS');

    const restarted = MonopolyEngine.reduce(started.data.nextState, { type: 'RESTART_GAME', playerId: p1 }, mockRng);
    expect(restarted.success).toBe(true);
    if (!restarted.success) return;
    expect(restarted.data.nextState.status).toBe('LOBBY');

    const reStarted = MonopolyEngine.reduce(restarted.data.nextState, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
    expect(reStarted.success).toBe(true);
    if (!reStarted.success) return;
    expect(reStarted.data.nextState.status).toBe('IN_PROGRESS');
  });

  it('is rejected for a non-active player', () => {
    const state = initState();
    expect(MonopolyEngine.isValidAction(state, { type: 'FORCE_END_TURN', playerId: p2 })).toBe(false);
  });

  it('is rejected while the active player has an unresolved debt', () => {
    const state = initState();
    const modified: IMonopolyState = {
      ...state,
      players: state.players.map((p, i) => i === 0 ? {
        ...p,
        debt: { amount: 100, to: 'BANK', reason: 'TAX' }
      } : p)
    };
    expect(MonopolyEngine.isValidAction(modified, { type: 'FORCE_END_TURN', playerId: p1 })).toBe(false);
  });
});
