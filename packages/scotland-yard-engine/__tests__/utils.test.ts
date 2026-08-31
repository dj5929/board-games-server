import { describe, it, expect } from 'vitest';
import { playerId } from '@packages/engine-core';
import { deduceTicketForMove } from '../src/utils';
import type { ScotlandYardState, ScotlandYardPlayer } from '../src/types';

describe('deduceTicketForMove', () => {
  const mockState: ScotlandYardState = {
    players: [
      { id: playerId('mrx'), role: 'MR_X', position: 13, tickets: { taxi: 4, bus: 3, underground: 3, secret: 2, double: 1 } },
      { id: playerId('det1'), role: 'DETECTIVE', position: 14, tickets: { taxi: 10, bus: 8, underground: 4, secret: 0, double: 0 } },
      { id: playerId('det2'), role: 'DETECTIVE', position: 29, tickets: { taxi: 10, bus: 8, underground: 4, secret: 0, double: 0 } }
    ],
    playerOrder: [playerId('mrx'), playerId('det1'), playerId('det2')],
    activePlayerId: playerId('mrx'),
    currentTurn: 1,
    mrXLog: [],
    mrXRevealedTurns: [3],
    status: 'IN_PROGRESS'
  };

  it('returns null if the current position is invalid', () => {
    const player = mockState.players[0]!;
    expect(deduceTicketForMove(mockState, player, 999, 14)).toBeNull();
  });

  it('deduces taxi ticket if available and target is reachable via taxi', () => {
    const player = mockState.players[0]!;
    // node 13 is connected to 14 via taxi
    expect(deduceTicketForMove(mockState, player, 13, 14)).toBe('taxi');
  });

  it('deduces bus ticket if available and target is reachable via bus', () => {
    const player = mockState.players[0]!;
    // node 13 is connected to 52 via bus
    expect(deduceTicketForMove(mockState, player, 13, 52)).toBe('bus');
  });

  it('deduces underground ticket if available and target is reachable via underground', () => {
    const player = mockState.players[0]!;
    // node 13 is connected to 46 via underground
    expect(deduceTicketForMove(mockState, player, 13, 46)).toBe('underground');
  });

  it('deduces secret ticket for Mr X if target is reachable but normal tickets are depleted', () => {
    const player: ScotlandYardPlayer = { 
      ...mockState.players[0]!, 
      tickets: { taxi: 0, bus: 0, underground: 0, secret: 1, double: 0 } 
    };
    // node 13 to 14 is a taxi route. since taxi is 0, but secret > 0, should use secret.
    expect(deduceTicketForMove(mockState, player, 13, 14)).toBe('secret');
  });

  it('returns null if no tickets are available for a valid path', () => {
    const player: ScotlandYardPlayer = { 
      ...mockState.players[0]!, 
      tickets: { taxi: 0, bus: 0, underground: 0, secret: 0, double: 0 } 
    };
    expect(deduceTicketForMove(mockState, player, 13, 14)).toBeNull();
  });

  it('returns null if target is not reachable', () => {
    const player = mockState.players[0]!;
    expect(deduceTicketForMove(mockState, player, 13, 99)).toBeNull();
  });

  it('returns null for detectives moving to a node occupied by another detective', () => {
    const player = mockState.players[1]!; // det1 at 14
    // det2 is at 29. Node 14 is connected to 15, 15 is connected to 29?
    // Let's use an actual connection. node 15 connects to 29.
    // If det1 is at 15 and det2 at 29.
    const state = {
      ...mockState,
      players: [
        mockState.players[0]!,
        { ...player, position: 15 },
        mockState.players[2]!
      ]
    };
    const det1 = state.players[1]!;
    // node 15 to 29 is a taxi/bus route. but det2 is at 29.
    expect(deduceTicketForMove(state, det1, 15, 29)).toBeNull();
  });
  
  it('allows Mr X to move to a node occupied by a detective', () => {
    const player = mockState.players[0]!; // mrx at 13
    // det1 is at 14. 13 to 14 is taxi.
    expect(deduceTicketForMove(mockState, player, 13, 14)).toBe('taxi');
  });
});
