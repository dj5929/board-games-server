import { playerId, propertyId } from '@packages/engine-core';
import { describe, it, expect } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import { BOARD_SPACES } from '../src/board';

function reduceHelper(state: any, action: any, rng: any): any {
  const result = MonopolyEngine.reduce(state, action, rng);
  if (!result.success) throw new Error("Expected success, got " + result.error);
  return result.data;
}

describe('MonopolyEngine Core Mechanics', () => {
  it('should generate initial state correctly', () => {
    const rng = new DeterministicRNG([]);
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    expect(state.players).toHaveLength(2);
    expect(state.players[0]!.money).toBe(1500);
    expect(state.players[0]!.position).toBe(0);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('should handle ROLL_DICE correctly', () => {
    const initialState = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    const rng = new DeterministicRNG([0.5, 0.75]); // yields 4 and 5
    
    const { nextState, events } = reduceHelper(initialState, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    
    expect(nextState.players[0]!.position).toBe(9);
    expect(events.some((e: any) => e.type === 'DICE_ROLLED')).toBe(true);
  });
  
  it('should ignore actions from non-active players', () => {
    const initialState = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    const rng = new DeterministicRNG([0.5, 0.75]);
    
    const result = MonopolyEngine.reduce(initialState, { type: 'ROLL_DICE', playerId: playerId('p2') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('NOT_YOUR_TURN');
    }
  });
});

describe('MonopolyEngine Phase 5: Property & Rent', () => {
  it('should allow player to buy an unowned property they are standing on', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    // Move player 1 to Mediterranean Ave (Index 1)
    state.players[0]!.position = 1;

    const medPrice = BOARD_SPACES[1]!.price!; // 60
    
    const { nextState, events } = reduceHelper(state, { type: 'BUY_PROPERTY', playerId: playerId('p1') }, rng);
    
    // Player 1 should lose 60
    expect(nextState.players[0]!.money).toBe(1500 - medPrice);
    // Bank gains 60
    expect(nextState.bankMoney).toBe(state.bankMoney + medPrice);
    // Ownership is registered
    expect((nextState as any).ownership[propertyId('mediterranean')]).toBe(playerId('p1'));
    
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('PROPERTY_BOUGHT');
    if (events[0].type === 'PROPERTY_BOUGHT') {
       expect(events[0].price).toBe(medPrice);
    }
  });

  it('should not allow buying an already owned property', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    state.players[0]!.position = 1;
    (state as any).ownership[propertyId('mediterranean')] = 'p2'; // p2 already owns it

    const result = MonopolyEngine.reduce(state, { type: 'BUY_PROPERTY', playerId: playerId('p1') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('ALREADY_OWNED');
  });

  it('should auto-deduct rent when landing on an owned property', () => {
    const rng = new DeterministicRNG([0, 0]); // yields 1 and 1 -> position 2 (Community Chest). Wait, let's force position 1 (Mediterranean)
    // To land on 1, we need 0 dice roll, but minimum is 1+1=2. 
    // Let's start player at 39, roll 2 -> position 1.
    // 39 + 1 + 1 = 41 -> 41 % 40 = 1.
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    state.players[0]!.position = 39;
    
    // Give p2 ownership of Mediterranean
    (state as any).ownership[propertyId('mediterranean')] = 'p2';
    const rent = BOARD_SPACES[1]!.baseRent!; // 2

    // p1 rolls and lands on 1
    const { nextState, events } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    
    expect(nextState.players[0]!.position).toBe(1);
    expect(nextState.players[0]!.money).toBe(1500 + 200 - rent); // Passed GO (+200)
    expect(nextState.players[1]!.money).toBe(1500 + rent);

    expect(events.some((e: any) => e.type === 'RENT_PAID')).toBe(true);
    const rentEvent = events.find((e: any) => e.type === 'RENT_PAID');
    if (rentEvent && rentEvent.type === 'RENT_PAID') {
      expect(rentEvent.amount).toBe(rent);
      expect(rentEvent.fromPlayerId).toBe(playerId('p1'));
      expect(rentEvent.toPlayerId).toBe(playerId('p2'));
    }
  });
});

describe('MonopolyEngine Phase 8: Economy & Trading', () => {
  it('should mortgage an unmortgaged property and receive half price', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    
    // Mediterranean price is 60, half is 30
    const { nextState, events } = reduceHelper(state, { type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    
    expect((nextState as any).mortgagedProperties[propertyId('mediterranean')]).toBe(true);
    expect(nextState.players[0]!.money).toBe(1530);
    expect(nextState.bankMoney).toBe(state.bankMoney - 30);
    expect(events.some((e: any) => e.type === 'PROPERTY_MORTGAGED')).toBe(true);
  });

  it('should yield 0 rent if the landed property is mortgaged', () => {
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    const rng = new DeterministicRNG([0, 0]); // yields 1 and 1
    state.players[0]!.position = 39;
    
    // Give p2 ownership of Mediterranean and mortgage it
    (state as any).ownership[propertyId('mediterranean')] = 'p2';
    (state as any).mortgagedProperties[propertyId('mediterranean')] = true;

    // p1 rolls and lands on 1
    const { nextState, events } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    
    // Money should be unchanged from rent, but passed go (+200)
    expect(nextState.players[0]!.money).toBe(1700);
    expect(nextState.players[1]!.money).toBe(1500); // No rent paid
    expect(events.some((e: any) => e.type === 'RENT_PAID')).toBe(false);
  });

  it('should unmortgage a mortgaged property and pay half price + 10%', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    (state as any).mortgagedProperties[propertyId('mediterranean')] = true;
    
    // Mediterranean price is 60. Half is 30. +10% is 33.
    const { nextState, events } = reduceHelper(state, { type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    
    expect(!!(nextState as any).mortgagedProperties[propertyId('mediterranean')]).toBe(false);
    expect(nextState.players[0]!.money).toBe(1500 - 33);
    expect(nextState.bankMoney).toBe(state.bankMoney + 33);
    expect(events.some((e: any) => e.type === 'PROPERTY_UNMORTGAGED')).toBe(true);
  });

  it('should double base rent if player owns all properties in the color group', () => {
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    const rng = new DeterministicRNG([0, 0]); 
    state.players[0]!.position = 39;
    
    // Give p2 ownership of Mediterranean and Baltic (Brown group)
    (state as any).ownership[propertyId('mediterranean')] = 'p2';
    (state as any).ownership[propertyId('baltic')] = 'p2';
    
    const baseRent = BOARD_SPACES[1]!.baseRent!; // 2 for med

    // p1 rolls and lands on 1 (mediterranean)
    const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    
    // passing go +200, rent is doubled: 2 * 2 = 4
    expect(nextState.players[0]!.money).toBe(1500 + 200 - (baseRent * 2));
    expect(nextState.players[1]!.money).toBe(1500 + (baseRent * 2));
  });

  it('should ignore MORTGAGE_PROPERTY if player does not own the property', () => {
    const rng = new DeterministicRNG([]);
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    // Mediterranean owned by p2, but p1 tries to mortgage it
    (state as any).ownership[propertyId('mediterranean')] = 'p2';
    
    const result = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('NOT_OWNER');
  });

  it('should ignore UNMORTGAGE_PROPERTY if player does not have enough money', () => {
    const rng = new DeterministicRNG([]);
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    // Give p1 an expensive property and mortgage it
    (state as any).ownership[propertyId('boardwalk')] = 'p1';
    (state as any).mortgagedProperties[propertyId('boardwalk')] = true;
    
    // Bankrupt p1
    state.players[0]!.money = 10;
    
    // Cost to unmortgage boardwalk is 200 + 10% = 220
    const result = MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('boardwalk') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('INSUFFICIENT_FUNDS');
  });

  it('isValidAction should return correct booleans for mortgage actions', () => {
    const rng = new DeterministicRNG([]);
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    
    expect(MonopolyEngine.isValidAction(state, { type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') })).toBe(false); // not mortgaged
    
    (state as any).mortgagedProperties[propertyId('mediterranean')] = true;
    
    expect(MonopolyEngine.isValidAction(state, { type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') })).toBe(false); // already mortgaged
    expect(MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') })).toBe(true);
    
    // Insufficient funds
    state.players[0]!.money = 0;
    expect(MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('mediterranean') })).toBe(false);
  });
});

describe('MonopolyEngine Phase 8: Houses & Hotels', () => {
  it('should not allow buying a house if player does not own full color group', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    // p1 does not own baltic
    
    const result = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('NOT_MONOPOLY');
  });

  it('should allow buying a house and deduct housePrice', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    (state as any).ownership[propertyId('baltic')] = 'p1';
    
    const housePrice = BOARD_SPACES[1]!.housePrice!; // 50
    const { nextState, events } = reduceHelper(state, { type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    
    expect((nextState as any).buildings[propertyId('mediterranean')]).toBe(1);
    expect(nextState.players[0]!.money).toBe(1500 - housePrice);
    expect(events.some((e: any) => e.type === 'HOUSE_BOUGHT')).toBe(true);
  });

  it('should enforce even building rule when buying houses', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    (state as any).ownership[propertyId('baltic')] = 'p1';
    
    // Give Mediterranean 1 house
    (state as any).buildings[propertyId('mediterranean')] = 1;
    
    // Trying to buy a 2nd house on Mediterranean should fail because Baltic has 0
    const result = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('EVEN_BUILD_RULE');
  });

  it('should calculate rent correctly based on number of houses', () => {
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    const rng = new DeterministicRNG([0, 0]); 
    state.players[0]!.position = 39;
    
    // Give p2 ownership of Brown group and 2 houses on Mediterranean
    (state as any).ownership[propertyId('mediterranean')] = 'p2';
    (state as any).ownership[propertyId('baltic')] = 'p2';
    (state as any).buildings[propertyId('mediterranean')] = 2;
    (state as any).buildings[propertyId('baltic')] = 1;
    
    const expectedRent = BOARD_SPACES[1]!.rentWithHouses![1]; // 2 houses = index 1 -> 30 rent

    // p1 rolls and lands on Mediterranean (pos 1)
    const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    
    // passing go +200, rent deducted
    expect(nextState.players[0]!.money).toBe(1500 + 200 - expectedRent!);
    expect(nextState.players[1]!.money).toBe(1500 + expectedRent!);
  });

  it('should allow selling a house for half price and enforce even building rule', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    (state as any).ownership[propertyId('baltic')] = 'p1';
    
    // Give Mediterranean 2 houses and Baltic 2 houses
    (state as any).buildings[propertyId('mediterranean')] = 2;
    (state as any).buildings[propertyId('baltic')] = 2;
    
    const housePrice = BOARD_SPACES[1]!.housePrice!; // 50
    
    // Sell 1 from Mediterranean
    let transition = reduceHelper(state, { type: 'SELL_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    
    expect((transition.nextState as any).buildings[propertyId('mediterranean')]).toBe(1);
    expect(transition.nextState.players[0]!.money).toBe(1500 + (housePrice / 2)); // +25
    expect(transition.events.some((e: any) => e.type === 'HOUSE_SOLD')).toBe(true);

    // Now Mediterranean has 1, Baltic has 2. Try to sell Mediterranean again (should fail due to even building)
    const failResult = MonopolyEngine.reduce(transition.nextState, { type: 'SELL_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') }, rng);
    expect(failResult.success).toBe(false);
    if (!failResult.success) expect(failResult.error).toBe('EVEN_BUILD_RULE');
  });
});

describe('MonopolyEngine Phase 5/8: Missing Game Logic Fixes', () => {
  it('should scale Railroad rent based on number of railroads owned', () => {
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    state.players[0]!.position = 39;
    
    // Give p2 ownership of 2 railroads (Reading and Penn)
    (state as any).ownership[propertyId('reading')] = 'p2';
    (state as any).ownership[propertyId('penn_rr')] = 'p2';
    
    // p1 rolls and lands on reading (pos 5)
    // Needs a roll of 6 to get from 39 to 5
    const rrRng = new DeterministicRNG([1/6, 3/6]); // yields 2 and 4 = 6. 39 + 6 = 45 -> 45 % 40 = 5 (Reading)
    
    const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rrRng);
    
    expect(nextState.players[0]!.position).toBe(5);
    // Rent for 2 railroads is 50. 
    // Player 1 passing go: +200, rent: -50
    expect(nextState.players[0]!.money).toBe(1500 + 200 - 50);
    expect(nextState.players[1]!.money).toBe(1500 + 50);
  });

  it('should calculate Utility rent as 4x or 10x the dice roll', () => {
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], new DeterministicRNG([]));
    state.players[0]!.position = 7; 
    
    // Give p2 ownership of Electric Company
    (state as any).ownership[propertyId('electric')] = 'p2';
    
    // Roll 5 (lands on Electric Company, pos 12)
    const utilRng = new DeterministicRNG([1/6, 2/6]); // yields 2 and 3 = 5
    
    const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, utilRng);
    
    expect(nextState.players[0]!.position).toBe(12);
    // 1 utility = 4x dice roll. Dice roll is 5. Rent = 20.
    expect(nextState.players[0]!.money).toBe(1500 - 20);
    expect(nextState.players[1]!.money).toBe(1500 + 20);
    
    // Now p2 owns both utilities
    (nextState as any).ownership[propertyId('water')] = 'p2';
    nextState.players[0]!.position = 22; // Start closer to Water Works (pos 28)
    // Simulate a fresh turn (MED-8: a player cannot roll twice on the same turn)
    nextState.players[0]!.hasRolled = false;
    const util2rng = new DeterministicRNG([2/6, 2/6]); // yields 3 and 3 = 6
    // wait, if we yield doubles, they go to jail? 
    // No, only 3 doubles. But rolling doubles doesn't end turn. That's fine.
    
    const util2State = reduceHelper(nextState, { type: 'ROLL_DICE', playerId: playerId('p1') }, util2rng).nextState;
    expect(util2State.players[0]!.position).toBe(28);
    // 2 utilities = 10x dice roll. Dice roll is 6. Rent = 60.
    expect(util2State.players[0]!.money).toBe(1500 - 20 - 60);
  });

  it('should not allow mortgaging a property if there are buildings in the color group', () => {
    const rng = new DeterministicRNG([]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    (state as any).ownership[propertyId('mediterranean')] = 'p1';
    (state as any).ownership[propertyId('baltic')] = 'p1';
    (state as any).buildings[propertyId('mediterranean')] = 1; // 1 house in the group
    
    const result = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: propertyId('baltic') }, rng);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('HAS_BUILDINGS');
  });

  it('should reject ROLL_DICE when the player has already rolled (MED-8)', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    // Simulate a player who has already rolled this turn
    (state as any).players[0].hasRolled = true;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('ALREADY_ROLLED');
  });

  it('should hide the ordered chance and chest decks via getStateForPlayer (CRITICAL-2/3)', () => {
    const rng = new DeterministicRNG([0.5]);
    const state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    const projected = MonopolyEngine.getStateForPlayer!(state, playerId('p1'));
    // Decks keep their length but contents are hidden
    expect(projected.chanceDeck).toHaveLength(state.chanceDeck.length);
    expect(projected.chestDeck).toHaveLength(state.chestDeck.length);
    expect(projected.chanceDeck).not.toEqual(state.chanceDeck);
    expect(projected.chanceDeck.every(c => c === 'HIDDEN')).toBe(true);
    expect(projected.chestDeck.every(c => c === 'HIDDEN')).toBe(true);
  });
});

