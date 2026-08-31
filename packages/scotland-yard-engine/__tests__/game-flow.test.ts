import { describe, it, expect, beforeEach } from 'vitest';
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

function place(state: HelperState, id: string, position: number): HelperState {
  (player(state, id) as any).position = position;
  return state;
}

function setTickets(state: HelperState, id: string, tickets: Partial<Record<TransportType, number>> & { double?: number }): HelperState {
  Object.assign((player(state, id) as any).tickets, tickets);
  return state;
}

function apply(state: HelperState, action: ScotlandYardAction): HelperState {
  const res = ScotlandYardEngine.reduce(state, action, new DeterministicRNG([0.5]));
  expect(res.success).toBe(true);
  if (!res.success) throw new Error(res.error);
  return res.data.nextState;
}

function moveMrX(state: HelperState, targetNode: number, ticketType: TransportType): HelperState {
  return apply(state, { type: 'MOVE', playerId: mrX, payload: { targetNode, ticketType } });
}

describe('ScotlandYardEngine - Game Flow', () => {
  let state: HelperState;
  const rng = new DeterministicRNG([0.5]);

  beforeEach(() => {
    state = newState();
    place(state, mrX, 13);
    place(state, det1, 29);
    place(state, det2, 26);
  });

  it('rejects invalid player counts on initialization', () => {
    expect(() => ScotlandYardEngine.getInitialState([mrX, det1], rng)).toThrow('Scotland Yard requires 3 to 6 players.');
    expect(() => ScotlandYardEngine.getInitialState([
      mrX, det1, det2, playerId('d4'), playerId('d5'), playerId('d6'), playerId('d7')
    ], rng)).toThrow('Scotland Yard requires 3 to 6 players.');
  });

  it('assigns roles and starting tickets', () => {
    const st = newState();
    expect(st.playerOrder).toEqual([mrX, det1, det2]);
    expect(st.activePlayerId).toBe(mrX);
    expect(st.currentTurn).toBe(1);
    expect(st.status).toBe('IN_PROGRESS');
    const x = player(st, mrX);
    expect(x.role).toBe('MR_X');
    expect(x.tickets).toMatchObject({ taxi: 4, bus: 3, underground: 3, secret: 2, double: 2 });
    for (const did of [det1, det2]) {
      const d = player(st, did);
      expect(d.role).toBe('DETECTIVE');
      expect(d.tickets).toMatchObject({ taxi: 10, bus: 8, underground: 4, secret: 0, double: 0 });
    }
  });

  it('rotates turns and increments the round after a full cycle', () => {
    state = moveMrX(state, 46, 'underground');
    expect(state.activePlayerId).toBe(det1);
    expect(state.currentTurn).toBe(1);

    state = apply(state, { type: 'MOVE', playerId: det1, payload: { targetNode: 41, ticketType: 'taxi' } });
    expect(state.activePlayerId).toBe(det2);

    state = apply(state, { type: 'MOVE', playerId: det2, payload: { targetNode: 27, ticketType: 'taxi' } });
    expect(state.activePlayerId).toBe(mrX);
    expect(state.currentTurn).toBe(2);
  });

  it.each([3, 8, 13, 18])('reveals Mr X position after %i moves', (turn: number) => {
    (state as any).mrXLog = Array(turn - 1).fill('taxi');
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const moveEvent = res.data.events.find(e => e.type === 'PLAYER_MOVED')!;
    expect(moveEvent.payload.targetNode).toBe(46);
    expect(res.data.nextState.mrXLog).toHaveLength(turn);
  });

  it('keeps Mr X position hidden on non-reveal turns', () => {
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const moveEvent = res.data.events.find(e => e.type === 'PLAYER_MOVED')!;
    expect(moveEvent.payload.targetNode).toBeUndefined();
    expect(res.data.nextState.players.find(p => p.id === mrX)!.position).toBe(46);
  });

  it('ends the game when Mr X moves onto a detective', () => {
    place(state, det1, 46);
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.nextState.winner).toBe('DETECTIVE');
    expect(res.data.events).toContainEqual({ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'Mr. X moved to a detective!' } });
  });

  it('ends the game when a detective moves onto Mr X', () => {
    place(state, det1, 26);
    place(state, mrX, 27);
    state.activePlayerId = det1;
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: det1, payload: { targetNode: 27, ticketType: 'taxi' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.nextState.winner).toBe('DETECTIVE');
    expect(res.data.events).toContainEqual({ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'Mr. X was caught!' } });
  });

  it('lets Mr X win after surviving 24 moves', () => {
    (state as any).mrXLog = Array(23).fill('taxi');
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.nextState.winner).toBe('MR_X');
    expect(res.data.events).toContainEqual({ type: 'GAME_OVER', payload: { winner: 'MR_X', reason: 'Mr. X survived 24 rounds!' } });
  });

  it('awards Mr X the win when all detectives are stuck', () => {
    setTickets(state, det1, { taxi: 0, bus: 0, underground: 0 });
    setTickets(state, det2, { taxi: 0, bus: 0, underground: 0 });
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.nextState.winner).toBe('MR_X');
    expect(res.data.events).toContainEqual({ type: 'GAME_OVER', payload: { winner: 'MR_X', reason: 'All detectives are stuck!' } });
  });

  it('skips a detective with no tickets and continues to the next', () => {
    setTickets(state, det1, { taxi: 0, bus: 0, underground: 0 });
    state = moveMrX(state, 46, 'underground');
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.activePlayerId).toBe(det2);
  });

  it('blocks a detective from moving onto another detective', () => {
    state.activePlayerId = det1;
    place(state, det1, 26);
    place(state, det2, 27);

    const blocked: ScotlandYardAction = { type: 'MOVE', playerId: det1, payload: { targetNode: 27, ticketType: 'taxi' } };
    expect(ScotlandYardEngine.isValidAction(state, blocked)).toBe(false);
    const res = ScotlandYardEngine.reduce(state, blocked, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Invalid action.');

    const ok = apply(state, { type: 'MOVE', playerId: det1, payload: { targetNode: 15, ticketType: 'taxi' } });
    expect(ok.players.find(p => p.id === det1)!.position).toBe(15);
  });

  it('lets Mr X use a secret ticket along any route', () => {
    expect(ScotlandYardEngine.isValidAction(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 52, ticketType: 'secret' } // bus-only route from 13
    })).toBe(true);

    state = apply(state, { type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'secret' } });
    expect(state.players.find(p => p.id === mrX)!.position).toBe(46);
    expect(state.players.find(p => p.id === mrX)!.tickets.secret).toBe(1);
    expect(state.mrXLog).toEqual(['secret']);
  });

  it('rejects invalid moves, missing tickets, and unknown actions', () => {
    const noEdge: ScotlandYardAction = { type: 'MOVE', playerId: mrX, payload: { targetNode: 2, ticketType: 'taxi' } };
    expect(ScotlandYardEngine.isValidAction(state, noEdge)).toBe(false);
    expect(ScotlandYardEngine.isValidAction(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    })).toBe(true);

    setTickets(state, mrX, { taxi: 0 });
    const noTicket: ScotlandYardAction = { type: 'MOVE', playerId: mrX, payload: { targetNode: 14, ticketType: 'taxi' } };
    expect(ScotlandYardEngine.isValidAction(state, noTicket)).toBe(false);
    const res = ScotlandYardEngine.reduce(state, noTicket, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Invalid action.');

    expect(ScotlandYardEngine.isValidAction(state, { type: 'TELEPORT' } as any)).toBe(false);
  });

  it('rejects all actions after the game has ended', () => {
    (state as any).status = 'FINISHED';
    const action: ScotlandYardAction = { type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' } };
    expect(ScotlandYardEngine.isValidAction(state, action)).toBe(false);
    const res = ScotlandYardEngine.reduce(state, action, rng);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error).toBe('Game is over.');
  });

  it('performs a DOUBLE_MOVE across two different ticket types', () => {
    const res = ScotlandYardEngine.reduce(state, {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 46, ticketType: 'underground' }, move2: { targetNode: 47, ticketType: 'taxi' } }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const { nextState, events } = res.data;
    expect(nextState.players.find(p => p.id === mrX)!.position).toBe(47);
    expect(nextState.players.find(p => p.id === mrX)!.tickets.underground).toBe(2);
    expect(nextState.players.find(p => p.id === mrX)!.tickets.taxi).toBe(3);
    expect(nextState.players.find(p => p.id === mrX)!.tickets.double).toBe(1);
    expect(nextState.mrXLog).toEqual(['underground', 'taxi']);
    expect(events.filter(e => e.type === 'PLAYER_MOVED')).toHaveLength(2);
    expect(nextState.activePlayerId).toBe(det1);
  });

  it('rejects illegal DOUBLE_MOVEs', () => {
    const illegal: ScotlandYardAction = {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 46, ticketType: 'underground' }, move2: { targetNode: 74, ticketType: 'underground' } }
    };

    // Detective cannot double-move
    const detState = newState();
    detState.activePlayerId = det1;
    place(detState, det1, 26);
    place(detState, mrX, 13);
    place(detState, det2, 29);
    expect(ScotlandYardEngine.isValidAction(detState, illegal)).toBe(false);

    // No double tokens
    const noDouble = newState();
    place(noDouble, mrX, 13); place(noDouble, det1, 29); place(noDouble, det2, 26);
    setTickets(noDouble, mrX, { double: 0 });
    expect(ScotlandYardEngine.isValidAction(noDouble, illegal)).toBe(false);

    // Same ticket twice without enough of that ticket (needs 2 underground)
    const short = newState();
    place(short, mrX, 13); place(short, det1, 29); place(short, det2, 26);
    setTickets(short, mrX, { underground: 1 });
    expect(ScotlandYardEngine.isValidAction(short, illegal)).toBe(false);

    // Invalid first leg
    const badFirst = newState();
    place(badFirst, mrX, 13); place(badFirst, det1, 29); place(badFirst, det2, 26);
    expect(ScotlandYardEngine.isValidAction(badFirst, {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 2, ticketType: 'taxi' }, move2: { targetNode: 46, ticketType: 'underground' } }
    })).toBe(false);

    // First leg ticket unavailable
    const noFirstTicket = newState();
    place(noFirstTicket, mrX, 13); place(noFirstTicket, det1, 29); place(noFirstTicket, det2, 26);
    setTickets(noFirstTicket, mrX, { taxi: 0 });
    expect(ScotlandYardEngine.isValidAction(noFirstTicket, {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 14, ticketType: 'taxi' }, move2: { targetNode: 46, ticketType: 'underground' } }
    })).toBe(false);

    // Invalid second leg
    const badSecond = newState();
    place(badSecond, mrX, 13); place(badSecond, det1, 29); place(badSecond, det2, 26);
    expect(ScotlandYardEngine.isValidAction(badSecond, {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 14, ticketType: 'taxi' }, move2: { targetNode: 2, ticketType: 'taxi' } }
    })).toBe(false);
  });

  it('rejects actions when the active player is not in the game', () => {
    (state as any).activePlayerId = playerId('ghost');
    expect(ScotlandYardEngine.isValidAction(state, {
      type: 'MOVE', playerId: mrX, payload: { targetNode: 46, ticketType: 'underground' }
    })).toBe(false);
  });

  it('rejects moves where the action.playerId is not the active player (MED-7)', () => {
    // active player is mrX; a detective impersonating cannot move
    const res = ScotlandYardEngine.reduce(state, {
      type: 'MOVE', playerId: det1, payload: { targetNode: 27, ticketType: 'taxi' }
    }, rng);
    expect(res.success).toBe(false);
    expect(ScotlandYardEngine.isValidAction(state, {
      type: 'MOVE', playerId: det1, payload: { targetNode: 27, ticketType: 'taxi' }
    })).toBe(false);
  });

  it('ends the game when a DOUBLE_MOVE lands on a detective on the first leg', () => {
    place(state, det1, 46);
    const res = ScotlandYardEngine.reduce(state, {
      type: 'DOUBLE_MOVE', playerId: mrX,
      payload: { move1: { targetNode: 46, ticketType: 'underground' }, move2: { targetNode: 74, ticketType: 'underground' } }
    }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const { nextState, events } = res.data;
    expect(nextState.status).toBe('FINISHED');
    expect(nextState.winner).toBe('DETECTIVE');
    expect(events.filter(e => e.type === 'PLAYER_MOVED')).toHaveLength(1);
    expect(nextState.mrXLog).toEqual(['underground']);
    const x = nextState.players.find(p => p.id === mrX)!;
    expect(x.tickets.double).toBe(1);
    expect(x.tickets.underground).toBe(2); // second leg never processed
  });

  it('hands a detectives used ticket to Mr X for detective moves', () => {
    state.activePlayerId = det1;
    place(state, det1, 26);
    const mrXTaxiBefore = player(state, mrX)!.tickets.taxi;
    state = apply(state, { type: 'MOVE', playerId: det1, payload: { targetNode: 27, ticketType: 'taxi' } });
    expect(player(state, det1)!.tickets.taxi).toBe(9);
    expect(player(state, mrX)!.tickets.taxi).toBe(mrXTaxiBefore + 1);
    expect(state.mrXLog).toHaveLength(0);
  });
});

describe('ScotlandYardEngine - Per-Player State Projection', () => {
  let state: HelperState;

  beforeEach(() => {
    state = newState();
    place(state, mrX, 46);
    place(state, det1, 14);
    place(state, det2, 29);
  });

  it('returns the full state for Mr X (the owner of the hidden position)', () => {
    const projected = ScotlandYardEngine.getStateForPlayer!(state, mrX);
    expect(projected).toBe(state);
    expect(projected.players.find(p => p.id === mrX)!.position).toBe(46);
  });

  it('scrubs Mr X position for detectives on non-reveal turns', () => {
    expect(state.mrXLog).toHaveLength(0); // not a reveal turn
    const projected = ScotlandYardEngine.getStateForPlayer!(state, det1);
    expect(projected).not.toBe(state);
    expect(projected.players.find(p => p.id === mrX)!.position).toBe(0);
    // Other players' positions are preserved
    expect(projected.players.find(p => p.id === det1)!.position).toBe(14);
    expect(projected.players.find(p => p.id === det2)!.position).toBe(29);
  });

  it('does not scrub Mr X position for detectives on reveal turns', () => {
    (state as any).mrXLog = Array(3).fill('taxi'); // length 3 is a reveal turn
    const projected = ScotlandYardEngine.getStateForPlayer!(state, det1);
    expect(projected.players.find(p => p.id === mrX)!.position).toBe(46);
  });

  it('does not scrub Mr X position once the game is over', () => {
    (state as any).status = 'FINISHED';
    (state as any).winner = 'DETECTIVE';
    const projected = ScotlandYardEngine.getStateForPlayer!(state, det2);
    expect(projected.players.find(p => p.id === mrX)!.position).toBe(46);
  });
});