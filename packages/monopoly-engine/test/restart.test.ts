import { playerId, propertyId } from '@packages/engine-core';
import { describe, it, expect } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import { IRandomProvider } from '@packages/engine-core';

import { DeterministicRNG } from '@packages/engine-core/test/helpers';

function reduceHelper(state: any, action: any, rng: any): any {
  const result = MonopolyEngine.reduce(state, action, rng);
  if (!result.success) throw new Error("Expected success, got " + result.error);
  return result.data;
}

describe('RESTART_GAME', () => {
  it('should reset the board to the initial state', () => {
    const rng = new DeterministicRNG([0.5, 0.5]);
    const initialState = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    // Make some changes
    initialState.players[0]!.money = 1000;
    initialState.players[0]!.position = 10;
    (initialState as any).currentPlayerIndex = 1;
    
    // Now dispatch RESTART_GAME using active player's ID
    const activePlayerId = initialState.players[initialState.currentPlayerIndex]!.id;
    const { nextState, events } = reduceHelper(initialState, { type: 'RESTART_GAME', playerId: activePlayerId }, rng);
    
    expect(nextState.players[0]!.money).toBe(1500);
    expect(nextState.players[0]!.position).toBe(0);
    expect(nextState.currentPlayerIndex).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('GAME_RESTARTED');
  });

  it('should allow RESTART_GAME from any player', () => {
    const rng = new DeterministicRNG([0.5, 0.5]);
    const initialState = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    (initialState as any).currentPlayerIndex = 1; // p2 is active
    
    // p1 tries to restart
    const result = MonopolyEngine.reduce(initialState, { type: 'RESTART_GAME', playerId: playerId('p1') }, rng);
    
    expect(result.success).toBe(true); 
  });
});
