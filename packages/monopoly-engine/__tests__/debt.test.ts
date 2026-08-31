import { describe, it, expect, beforeEach } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import { playerId, propertyId } from '@packages/engine-core';

// Deterministic RNG for tests
const mockRng = {
  values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  index: 0,
  next() {
    const val = this.values[this.index];
    this.index = (this.index + 1) % this.values.length;
    return val!;
  }
};

describe('Bankruptcy & Debt System', () => {
  let state: any;
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  beforeEach(() => {
    mockRng.index = 0;
    state = MonopolyEngine.getInitialState([p1, p2, p3], mockRng);
  });

  it('player incurs debt when rent exceeds balance', () => {
    // Setup: p2 owns Boardwalk (rent 50), p1 lands on it but has only 10 money
    state.ownership[propertyId('boardwalk')] = p2;
    state.players[0].money = 10;
    state.players[0].position = 37; // Space before boardwalk (39)

    // Force dice roll to 2 (1 + 1) -> 39
    mockRng.values = [0, 0]; // 1, 1
    mockRng.index = 0;

    const result = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextState: any = result.data.nextState;
    const p1State = nextState.players[0];
    
    expect(p1State.money).toBe(10); // Money not deducted yet
    expect(p1State.debt).toEqual({ amount: 50, to: p2, reason: 'Rent' });
    expect(result.data.events.some(e => e.type === 'DEBT_INCURRED')).toBe(true);
  });

  it('blocks normal actions when in debt', () => {
    state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
    
    // Try to end turn
    const endTurnResult = MonopolyEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, mockRng);
    expect(endTurnResult.success).toBe(false);
    if (!endTurnResult.success) {
      expect(endTurnResult.error).toBe('MUST_RESOLVE_DEBT');
    }

    // Try to roll dice
    const rollResult = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
    expect(rollResult.success).toBe(false);
  });

  it('allows PAY_DEBT if player has enough money', () => {
    state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
    state.players[0].money = 150;
    const p2InitialMoney = state.players[1].money;

    const result = MonopolyEngine.reduce(state, { type: 'PAY_DEBT', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextState: any = result.data.nextState;
    expect(nextState.players[0].money).toBe(50);
    expect(nextState.players[1].money).toBe(p2InitialMoney + 100);
    expect(nextState.players[0].debt).toBeNull();
    expect(result.data.events.some(e => e.type === 'DEBT_CLEARED')).toBe(true);
  });

  it('allows selling/mortgaging to raise money for PAY_DEBT', () => {
    state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
    state.players[0].money = 10;
    
    state.ownership[propertyId('boardwalk')] = p1; // price 400, mortgage 200

    const mortgageResult = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('boardwalk') }, mockRng);
    expect(mortgageResult.success).toBe(true);
    if (!mortgageResult.success) return;

    const stateAfterMortgage: any = mortgageResult.data.nextState;
    expect(stateAfterMortgage.players[0].money).toBe(210);

    const payResult = MonopolyEngine.reduce(stateAfterMortgage, { type: 'PAY_DEBT', playerId: p1 }, mockRng);
    expect(payResult.success).toBe(true);
  });

  it('DECLARE_BANKRUPTCY transfers assets to creditor and eliminates player', () => {
    state.players[0].debt = { amount: 1000, to: p2, reason: 'Rent' };
    state.players[0].money = 50;
    state.ownership[propertyId('park_place')] = p1;
    state.players[0].getOutOfJailFreeCards.push('chance_jail');

    const result = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextState: any = result.data.nextState;
    const p1State = nextState.players[0];
    const p2State = nextState.players[1];

    expect(p1State.status).toBe('BANKRUPT');
    expect(p1State.money).toBe(0);
    expect(p1State.debt).toBeNull();

    // Assets transferred
    expect(p2State.money).toBe(1500 + 50); // Original + P1's remaining cash
    expect(nextState.ownership[propertyId('park_place')]).toBe(p2);
    expect(p2State.getOutOfJailFreeCards).toContain('chance_jail');

    // Turn auto-advances to p2
    expect(nextState.currentPlayerIndex).toBe(1);
    expect(result.data.events.some(e => e.type === 'BANKRUPTCY_DECLARED')).toBe(true);
  });

  it('DECLARE_BANKRUPTCY to BANK clears assets', () => {
    state.players[0].debt = { amount: 1000, to: 'BANK', reason: 'Tax' };
    state.players[0].money = 50;
    state.ownership[propertyId('park_place')] = p1;
    state.players[0].getOutOfJailFreeCards.push('chance_jail');

    const result = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextState: any = result.data.nextState;
    const p1State = nextState.players[0];

    expect(p1State.status).toBe('BANKRUPT');
    expect(p1State.money).toBe(0);
    expect(nextState.bankMoney).toBe(Infinity); // Infinity bank

    // Assets cleared
    expect(nextState.ownership[propertyId('park_place')]).toBeUndefined();
    expect(nextState.chanceDeck).toContain('chance_jail');
  });

  it('DECLARE_BANKRUPTCY to BANK returns Community Chest jail-free cards to the chest deck', () => {
    state.players[0].debt = { amount: 1000, to: 'BANK', reason: 'Tax' };
    state.players[0].money = 50;
    state.players[0].getOutOfJailFreeCards.push('chest_jail_free');

    const result = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextState: any = result.data.nextState;
    expect(nextState.players[0].status).toBe('BANKRUPT');
    expect(nextState.players[0].getOutOfJailFreeCards).toHaveLength(0);
    expect(nextState.chestDeck).toContain('chest_jail_free');
  });

  it('GAME_OVER is emitted when only 1 active player remains', () => {
    // p1 goes bankrupt
    state.players[0].debt = { amount: 1000, to: p3, reason: 'Rent' };
    let result = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;
    state = result.data.nextState;

    // Fast forward to p2's turn
    state.currentPlayerIndex = 1;

    // p2 goes bankrupt
    state.players[1].debt = { amount: 1000, to: p3, reason: 'Rent' };
    result = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p2 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    state = result.data.nextState;
    expect(state.status).toBe('FINISHED');
    expect(result.data.events.some(e => e.type === 'GAME_OVER')).toBe(true);
  });

  it('END_TURN skips bankrupt players', () => {
    // p2 is bankrupt
    state.players[1].status = 'BANKRUPT';
    
    // p1 ends turn
    const result = MonopolyEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, mockRng);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Turn should go to p3 (index 2)
    expect(result.data.nextState.currentPlayerIndex).toBe(2);
  });
});
