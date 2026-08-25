import { describe, it, expect } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import { playerId, propertyId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import { MonopolyAction } from '../src/types';

describe('MonopolyEngine - Edge Cases & Phase E Features', () => {

  it('should enforce house and hotel supply limits (32 houses, 12 hotels)', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);

    ['mediterranean', 'baltic'].forEach(prop => {
      (state as any).ownership[propertyId(prop)] = playerId('p1');
    });

    const fakeProperties = ['st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana'];
    fakeProperties.forEach(prop => {
      (state as any).buildings[propertyId(prop)] = 4;
    });

    const buyHouseAction: MonopolyAction = { type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') };
    const res1 = MonopolyEngine.reduce(state, buyHouseAction, rng);
    expect(res1.success).toBe(false);
    expect(res1.success === false && res1.error).toBe('MAX_BUILDINGS');

    fakeProperties.forEach(prop => { delete (state as any).buildings[propertyId(prop)]; });
    
    const hotelProperties = ['st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana', 'illinois', 'atlantic', 'ventnor', 'marvin_gardens'];
    hotelProperties.forEach(prop => { (state as any).buildings[propertyId(prop)] = 5; });

    (state as any).buildings[propertyId('mediterranean')] = 4;
    (state as any).buildings[propertyId('baltic')] = 4;

    const buyHotelAction: MonopolyAction = { type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: propertyId('mediterranean') };
    const res2 = MonopolyEngine.reduce(state, buyHotelAction, rng);
    expect(res2.success).toBe(false);
    expect(res2.success === false && res2.error).toBe('MAX_BUILDINGS');
  });

  it('should handle COLLECT_FROM_PLAYERS with bankrupt/poor players', () => {
    const rng = new DeterministicRNG([0.1, 0.1]); // Roll 1+1 = 2 (Community Chest)
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    (state as any).chestDeck = ['chest_opera', ...state.chestDeck.filter(c => c !== 'chest_opera')];
    (state as any).players[1].money = 10;
    
    const rollAction: MonopolyAction = { type: 'ROLL_DICE', playerId: playerId('p1') };
    const res = MonopolyEngine.reduce(state, rollAction, rng);
    
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    
    expect(state.players[1]!.debt).not.toBeNull();
    expect(state.players[1]!.debt?.amount).toBe(50);
    expect(state.players[1]!.debt?.to).toBe(playerId('p1'));
  });

  it('should handle PAY_PLAYERS with insufficient funds', () => {
    const rngChance = new DeterministicRNG([0.4, 0.5]); // 3+4 = 7 (Chance)
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2'), playerId('p3')], rngChance);
    
    (state as any).chanceDeck = ['chance_chairman', ...state.chanceDeck.filter(c => c !== 'chance_chairman')];
    (state as any).players[0].money = 20; // Needs to pay $50 to each of the 2 other players ($100 total)
    
    const rollAction: MonopolyAction = { type: 'ROLL_DICE', playerId: playerId('p1') };
    const res = MonopolyEngine.reduce(state, rollAction, rngChance);
    
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    
    expect(state.players[0]!.debt).not.toBeNull();
    expect(state.players[0]!.debt?.amount).toBe(100);
    expect(state.players[0]!.debt?.to).toBe('BANK');
  });

  it('should allow CANCEL_TRADE', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    const proposeAction: MonopolyAction = { 
      type: 'PROPOSE_TRADE', playerId: playerId('p1'), toPlayerId: playerId('p2'), 
      offeredProperties: [], requestedProperties: [], offeredMoney: 100, requestedMoney: 0 
    };
    
    let res = MonopolyEngine.reduce(state, proposeAction, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    
    expect(state.activeTrade).not.toBeNull();
    
    const cancelAction: MonopolyAction = { type: 'CANCEL_TRADE', playerId: playerId('p1') };
    res = MonopolyEngine.reduce(state, cancelAction, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    
    expect(state.activeTrade).toBeNull();
  });

  it('should send player to jail on 3 consecutive doubles', () => {
    const rng = new DeterministicRNG([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]); // 1+1 = 2 (chest), 1+1 = 2 (tax), 1+1 = 2
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    // First double
    let res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.doublesCount).toBe(1);
    expect(state.players[0]!.inJail).toBe(false);

    // Second double
    res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.doublesCount).toBe(2);
    expect(state.players[0]!.inJail).toBe(false);

    // Third double (Speeding!)
    res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: playerId('p1') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    expect(state.players[0]!.doublesCount).toBe(0);
    expect(state.players[0]!.inJail).toBe(true);
    expect(state.players[0]!.position).toBe(10);
  });

  it('should allow USE_JAIL_CARD and return it to the correct deck', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], rng);
    
    (state as any).players[0].inJail = true;
    (state as any).players[0].position = 10;
    (state as any).players[0].getOutOfJailFreeCards = ['chance_jail_free'];
    
    const initialChanceDeckLength = state.chanceDeck.length;
    
    const useCardAction: MonopolyAction = { type: 'USE_JAIL_CARD', playerId: playerId('p1') };
    const res = MonopolyEngine.reduce(state, useCardAction, rng);
    
    expect(res.success).toBe(true);
    if (!res.success) return;
    state = res.data.nextState;
    
    expect(state.players[0]!.inJail).toBe(false);
    expect(state.players[0]!.getOutOfJailFreeCards).toHaveLength(0);
    expect(state.chanceDeck).toHaveLength(initialChanceDeckLength + 1);
    expect(state.chanceDeck[state.chanceDeck.length - 1]).toBe('chance_jail_free');
  });

});
