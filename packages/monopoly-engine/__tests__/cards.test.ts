import { MonopolyEngine } from '../src/MonopolyEngine';
import { IMonopolyState } from '../src/types';
import { Result, IStateTransition, playerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Chance & Community Chest Cards', () => {
  let state: IMonopolyState;
  
  beforeEach(() => {
    // 0 = 0, so random choices for decks will just keep order
    const rng = new DeterministicRNG([0]);
    state = MonopolyEngine.getInitialState([playerId('player1'), playerId('player2')], rng);
  });

  it('initializes chanceDeck and chestDeck', () => {
    expect(state.chanceDeck).toBeDefined();
    expect(state.chanceDeck.length).toBe(16);
    expect(state.chestDeck).toBeDefined();
    expect(state.chestDeck.length).toBe(16);
  });

  it('draws a chance card and handles movement effect', () => {
    // Force player to space 7 (Chance)
    // Roll dice: 3 + 4 = 7
    // Math.floor(rng * 6) => we want 3 and 4 => we need rng to return 2/6 and 3/6
    const rng = new DeterministicRNG([2/6, 3/6]);
    
    // With rng always 0 during getInitialState, the chance array is un-shuffled (reversed? our shuffle loops backwards so actually it swaps i with 0, meaning it moves elements to front). 
    // Wait, let's just cheat and explicitly set the deck in the test.
    const customState: IMonopolyState = {
      ...structuredClone(state),
      chanceDeck: ['chance_advance_go', ...state.chanceDeck.filter((x: string) => x !== 'chance_advance_go')]
    };
    
    const res = MonopolyEngine.reduce(customState, { type: 'ROLL_DICE', playerId: playerId('player1') }, rng) as Extract<Result<IStateTransition<IMonopolyState, any>, string>, { success: true }>;
    
    expect(res.success).toBe(true);
    const nextState = res.data.nextState;
    // chance_advance_go should move to 0
    expect(nextState.players[0]!.position).toBe(0);
    expect(nextState.players[0]!.money).toBe(1500 + 200); // collected 200 for passing go
  });
});
