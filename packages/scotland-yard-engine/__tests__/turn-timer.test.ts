import { describe, it, expect } from 'vitest';
import { ScotlandYardEngine } from '../src/ScotlandYardEngine';
import { playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { ScotlandYardState, ScotlandYardAction, TransportType, ScotlandYardPlayer } from '../src/types';

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

function setTickets(state: HelperState, id: string, tickets: Partial<Record<TransportType, number>> & { double?: number }): HelperState {
  Object.assign((player(state, id) as any).tickets, tickets);
  return state;
}

function setActive(state: HelperState, id: string): HelperState {
  (state as any).activePlayerId = id;
  return state;
}

function apply(state: HelperState, action: ScotlandYardAction): HelperState {
  const res = ScotlandYardEngine.reduce(state, action, new DeterministicRNG([0.5]));
  expect(res.success).toBe(true);
  if (!res.success) throw new Error(res.error);
  return res.data.nextState;
}

describe('ScotlandYardEngine - SKIP_TURN (turn timer)', () => {
  it('is valid only for the active player', () => {
    const state = newState(); // active = mrX
    expect(ScotlandYardEngine.isValidAction(state, { type: 'SKIP_TURN', playerId: mrX })).toBe(true);
    expect(ScotlandYardEngine.isValidAction(state, { type: 'SKIP_TURN', playerId: det1 })).toBe(false);
  });

  it('advances to the next player and emits TURN_SKIPPED without moving', () => {
    const state = newState();
    const mxPos = player(state, mrX).position;
    const result = ScotlandYardEngine.reduce(state, { type: 'SKIP_TURN', playerId: mrX }, new DeterministicRNG([0.5]));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.activePlayerId).toBe(det1);
    expect(result.data.nextState.players.find(p => p.id === mrX)!.position).toBe(mxPos); // no move
    expect(result.data.events).toContainEqual({
      type: 'TURN_SKIPPED',
      payload: { playerId: mrX, nextPlayerId: det1 }
    });
  });

  it('increments the current turn when wrapping from the last player past Mr. X', () => {
    let state = newState();
    state = setActive(state, det2); // last detective
    let next = apply(state, { type: 'SKIP_TURN', playerId: det2 });
    expect(next.currentTurn).toBe(2); // wrapped to mrX
    expect(next.activePlayerId).toBe(mrX);
  });

  it('skips a stuck detective to the next movable player', () => {
    let state = newState();
    state = setTickets(state, det1, { taxi: 0, bus: 0, underground: 0 });
    state = setActive(state, mrX);
    let next = apply(state, { type: 'SKIP_TURN', playerId: mrX });
    // det1 is stuck (0 tickets) so advancement lands on det2
    expect(next.activePlayerId).toBe(det2);
  });

  it('ends the game with an Mr X win if all detectives are stuck', () => {
    let state = newState();
    state = setTickets(state, det1, { taxi: 0, bus: 0, underground: 0 });
    state = setTickets(state, det2, { taxi: 0, bus: 0, underground: 0 });
    state = setActive(state, mrX);
    const result = ScotlandYardEngine.reduce(state, { type: 'SKIP_TURN', playerId: mrX }, new DeterministicRNG([0.5]));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.nextState.status).toBe('FINISHED');
    expect(result.data.nextState.winner).toBe('MR_X');
  });
});
