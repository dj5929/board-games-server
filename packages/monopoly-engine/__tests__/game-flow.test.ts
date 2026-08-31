import { describe, it, expect, beforeEach } from 'vitest';
import { MonopolyEngine } from '../src/MonopolyEngine';
import { playerId, propertyId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { MonopolyAction } from '../src/types';

const p1 = playerId('p1');
const p2 = playerId('p2');

// Dice math: Math.floor(rng.next() * 6) + 1, so a pair yields totals:
// [0.1,0.1]=2, [0.1,0.3]=3, [0.1,0.4]=4, [0.3,0.4]=5, [0.4,0.5]=7, [0.5,0.5]=8.
type HelperState = ReturnType<typeof MonopolyEngine.getInitialState>;

function apply(state: HelperState, action: MonopolyAction, rng: DeterministicRNG): HelperState {
  const res = MonopolyEngine.reduce(state, action, rng);
  expect(res.success).toBe(true);
  if (!res.success) throw new Error(res.error);
  return res.data.nextState;
}

// Neutralize the decks so rolls land on pure board spaces without card draws.
function clearDecks(state: HelperState): HelperState {
  (state as any).chanceDeck = [];
  (state as any).chestDeck = [];
  return state;
}

// Put a specific card on top of a deck so the next ROLL_DICE draws it.
function setupCard(state: HelperState, deck: 'chance' | 'chest', cardId: string): HelperState {
  const key = deck === 'chance' ? 'chanceDeck' : 'chestDeck';
  const list = (state as any)[key];
  (state as any)[key] = [cardId, ...list.filter((c: string) => c !== cardId)];
  return state;
}

let rng: DeterministicRNG;
let state: HelperState;

function freshState(): HelperState {
  return clearDecks(MonopolyEngine.getInitialState([p1, p2], new DeterministicRNG([0.5])));
}

describe('MonopolyEngine - Base Game Flow', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('moves, buys a property, collects GO on wrap, and ends the turn', () => {
    // p1 rolls 3 -> Baltic Avenue (price 60)
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.3]));
    expect(state.players[0]!.position).toBe(3);
    expect(state.players[0]!.money).toBe(1500);
    expect(state.players[0]!.hasRolled).toBe(true);

    state = apply(state, { type: 'BUY_PROPERTY', playerId: p1 }, rng);
    expect(state.ownership[propertyId('baltic')]).toBe(p1);
    expect(state.players[0]!.money).toBe(1440);

    // End turn -> it is p2's turn
    state = apply(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[0]!.hasRolled).toBe(false);

    // p2 wraps the board from space 35 and collects $200
    (state as any).players[1].position = 35;
    let res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p2 }, new DeterministicRNG([0.3, 0.4]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[1]!.position).toBe(0);
    expect(res.data.nextState.players[1]!.money).toBe(1700);
    expect(res.data.events.some(e => e.type === 'PASSED_GO')).toBe(true);
  });

  it('grants an extra roll on doubles and sends to jail on the third double', () => {
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.5, 0.5]));
    expect(state.players[0]!.position).toBe(8);
    expect(state.players[0]!.doublesCount).toBe(1);
    expect(state.players[0]!.hasRolled).toBe(false); // may roll again

    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.5, 0.5]));
    expect(state.players[0]!.position).toBe(16);
    expect(state.players[0]!.doublesCount).toBe(2);

    let res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.5, 0.5]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.doublesCount).toBe(0);
    expect(next.players[0]!.inJail).toBe(true);
    expect(next.players[0]!.position).toBe(10);
    expect(res.data.events.some(e => e.type === 'WENT_TO_JAIL' && e.reason === 'Speeding (3 Doubles)')).toBe(true);
  });

  it('blocks BUY_PROPERTY on non-purchasable, owned, and unaffordable spaces', () => {
    // NOT_PURCHASABLE (Chance space)
    (state as any).players[0].position = 22;
    let res = MonopolyEngine.reduce(state, { type: 'BUY_PROPERTY', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_PURCHASABLE');

    // ALREADY_OWNED
    (state as any).ownership[propertyId('baltic')] = p2;
    (state as any).players[0].position = 3;
    res = MonopolyEngine.reduce(state, { type: 'BUY_PROPERTY', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('ALREADY_OWNED');

    // INSUFFICIENT_FUNDS
    (state as any).players[0].position = 1;
    (state as any).players[0].money = 10;
    res = MonopolyEngine.reduce(state, { type: 'BUY_PROPERTY', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects actions from the wrong player and blocks the player in debt', () => {
    // Wrong player
    let res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p2 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_YOUR_TURN');

    // Player must resolve debt before any income-producing action
    (state as any).players[0].debt = { amount: 100, to: 'BANK', reason: 'Tax' };
    res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('MUST_RESOLVE_DEBT');
  });
});

describe('MonopolyEngine - Jail', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('lands on Go To Jail and is sent directly to jail', () => {
    (state as any).players[0].position = 28; // Water Works
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.inJail).toBe(true);
    expect(next.players[0]!.position).toBe(10);
    expect(next.players[0]!.hasRolled).toBe(true);
    expect(res.data.events.some(e => e.type === 'WENT_TO_JAIL' && e.reason === 'Landed on Go To Jail')).toBe(true);
  });

  it('escapes jail on doubles (no extra turn) and moves that many spaces', () => {
    (state as any).players[0].inJail = true;
    (state as any).players[0].position = 10;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.5, 0.5]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.jailTurns).toBe(0);
    expect(next.players[0]!.hasRolled).toBe(true); // no re-roll after escaping
    expect(next.players[0]!.position).toBe(18); // 10 + 8
    expect(next.players[0]!.money).toBe(1500);
  });

  it('forces the $50 fine on the third jail turn', () => {
    (state as any).players[0].inJail = true;
    (state as any).players[0].position = 10;
    (state as any).players[0].jailTurns = 2;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.4]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.jailTurns).toBe(0);
    expect(next.players[0]!.money).toBe(1450);
    expect(next.players[0]!.position).toBe(14);
  });

  it('incurs a debt instead of paying the jail fine when broke', () => {
    (state as any).players[0].inJail = true;
    (state as any).players[0].position = 10;
    (state as any).players[0].jailTurns = 2;
    (state as any).players[0].money = 40;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.4]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.money).toBe(40);
    expect(next.players[0]!.debt).toEqual({ amount: 50, to: 'BANK', reason: 'Jail Fine' });
    expect(res.data.events.some(e => e.type === 'DEBT_INCURRED' && e.amount === 50 && e.to === 'BANK')).toBe(true);
  });

  it('guards PAY_JAIL_FINE when not in jail, already rolled, or broke', () => {
    const run = (setup: (s: HelperState) => void): string | null => {
      const st = freshState();
      setup(st);
      const res = MonopolyEngine.reduce(st, { type: 'PAY_JAIL_FINE', playerId: p1 }, rng);
      expect(res.success).toBe(false);
      return res.success === false ? res.error : null;
    };

    expect(run(() => undefined)).toBe('NOT_IN_JAIL');
    expect(run(s => { (s as any).players[0].inJail = true; (s as any).players[0].hasRolled = true; })).toBe('ALREADY_ROLLED');
    expect(run(s => { (s as any).players[0].inJail = true; (s as any).players[0].money = 30; })).toBe('INSUFFICIENT_FUNDS');

    // Success path for completeness
    const st = freshState();
    (st as any).players[0].inJail = true;
    const next = apply(st, { type: 'PAY_JAIL_FINE', playerId: p1 }, rng);
    expect(next.players[0]!.inJail).toBe(false);
    expect(next.players[0]!.money).toBe(1450);
  });

  it('guards USE_JAIL_CARD when not in jail, without a card, or already rolled', () => {
    const run = (setup: (s: HelperState) => void): string | null => {
      const st = state;
      (st as any).players[0].inJail = false;
      (st as any).players[0].hasRolled = false;
      (st as any).players[0].getOutOfJailFreeCards = [];
      setup(st);
      const res = MonopolyEngine.reduce(st, { type: 'USE_JAIL_CARD', playerId: p1 }, rng);
      expect(res.success).toBe(false);
      return res.success === false ? res.error : null;
    };

    expect(run(() => undefined)).toBe('NOT_IN_JAIL');
    expect(run(s => { (s as any).players[0].inJail = true; })).toBe('NO_JAIL_CARD');
    expect(run(s => { (s as any).players[0].inJail = true; (s as any).players[0].hasRolled = true; (s as any).players[0].getOutOfJailFreeCards = ['chance_jail_free']; })).toBe('ALREADY_ROLLED');
  });

  it('stays in jail when a jailed player rolls non-doubles before the third turn', () => {
    const st = freshState();
    (st as any).players[0].inJail = true;
    (st as any).players[0].position = 10;
    (st as any).players[0].jailTurns = 1;
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.4]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.inJail).toBe(true);
    expect(next.players[0]!.position).toBe(10); // did not move
    expect(next.players[0]!.jailTurns).toBe(2);
    expect(next.players[0]!.hasRolled).toBe(true);
    expect(res.data.events.some(e => e.type === 'DICE_ROLLED')).toBe(true);
  });

  it('returns a Community Chest get-out-of-jail card to the chest deck', () => {
    const st = freshState();
    (st as any).players[0].inJail = true;
    (st as any).players[0].position = 10;
    (st as any).players[0].getOutOfJailFreeCards = ['chest_jail_free'];
    const res = MonopolyEngine.reduce(st, { type: 'USE_JAIL_CARD', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.inJail).toBe(false);
    expect(res.data.nextState.players[0]!.getOutOfJailFreeCards).toHaveLength(0);
    expect(res.data.nextState.chestDeck).toContain('chest_jail_free');
  });
});

describe('MonopolyEngine - Taxes', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('charges income tax ($200) when landing on it', () => {
    (state as any).players[0].position = 2;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.position).toBe(4);
    expect(res.data.nextState.players[0]!.money).toBe(1300);
    expect(res.data.events.some(e => e.type === 'TAX_PAID' && e.amount === 200)).toBe(true);
  });

  it('charges luxury tax ($100) when landing on it', () => {
    (state as any).players[0].position = 36;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.position).toBe(38);
    expect(res.data.nextState.players[0]!.money).toBe(1400);
    expect(res.data.events.some(e => e.type === 'TAX_PAID' && e.amount === 100)).toBe(true);
  });

  it('incurs a tax debt when the player cannot pay', () => {
    (state as any).players[0].position = 2;
    (state as any).players[0].money = 100;
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.money).toBe(100);
    expect(res.data.nextState.players[0]!.debt).toEqual({ amount: 200, to: 'BANK', reason: 'Income Tax' });
  });
});

describe('MonopolyEngine - Chance & Community Chest Cards', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  function drawCard(deck: 'chance' | 'chest', cardId: string): { state: HelperState; events: any[] } {
    const st = setupCard(state, deck, cardId);
    // Starting 5 and rolling 2 lands on Chance(7); starting 0 lands on Chest(2).
    (st as any).players[0].position = deck === 'chest' ? 0 : 5;
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);
    return { state: res.data.nextState, events: res.data.events };
  }

  it('COLLECT_MONEY card adds bank money', () => {
    const { state: s } = drawCard('chest', 'chest_bank_error');
    expect(s.players[0]!.money).toBe(1700);
    expect(s.players[0]!.position).toBe(2);
    expect(s.chestDeck).toContain('chest_bank_error'); // returned to the deck
  });

  it('PAY_MONEY card charges and incurs debt when broke', () => {
    let { state: s } = drawCard('chest', 'chest_doctors_fee');
    expect(s.players[0]!.money).toBe(1450);

    // Second draw from the top of the fresh deck on a broke player
    (s as any).players[0].position = 0;
    (s as any).players[0].money = 20;
    const res = MonopolyEngine.reduce(s, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.money).toBe(20);
    expect(res.data.nextState.players[0]!.debt).toEqual({ amount: 50, to: 'BANK', reason: 'Chance/Chest Card' });
  });

  it('GO_TO_JAIL card sends the player straight to jail without collecting GO', () => {
    const { state: s, events } = drawCard('chest', 'chest_go_to_jail');
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.position).toBe(10);
    expect(s.players[0]!.money).toBe(1500);
    expect(events.some((e: any) => e.type === 'PASSED_GO')).toBe(false);
    expect(events.some((e: any) => e.type === 'WENT_TO_JAIL')).toBe(true);
  });

  it('GET_OUT_OF_JAIL_FREE card is held by the player and not returned to the deck', () => {
    const { state: s } = drawCard('chest', 'chest_jail_free');
    expect(s.players[0]!.getOutOfJailFreeCards).toContain('chest_jail_free');
    expect(s.chestDeck).not.toContain('chest_jail_free'); // kept by the player
  });

  it('advance cards collect GO on wrap but not when moving forward only', () => {
    let { state: s, events } = drawCard('chance', 'chance_advance_go');
    expect(s.players[0]!.position).toBe(0);
    expect(s.players[0]!.money).toBe(1700);
    expect(events.some((e: any) => e.type === 'PASSED_GO')).toBe(true);

    s = setupCard(state, 'chance', 'chance_boardwalk'); // fresh roll
    const res = MonopolyEngine.reduce(s, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.position).toBe(39);
    expect(res.data.nextState.players[0]!.money).toBe(1500);
    expect(res.data.events.some(e => e.type === 'PASSED_GO')).toBe(false);
  });

  it('Go Back 3 card moves the token backwards', () => {
    const { state: s } = drawCard('chance', 'chance_back_3');
    expect(s.players[0]!.position).toBe(4);
  });

  it('advance to nearest Railroad pays double rent', () => {
    (state as any).ownership[propertyId('penn_rr')] = p2; // first railroad, base rent 25
    const { state: s, events } = drawCard('chance', 'chance_nearest_rr_1');
    expect(s.players[0]!.position).toBe(15);
    expect(s.players[0]!.money).toBe(1450); // 25 * 2
    expect(events.some((e: any) => e.type === 'RENT_PAID' && e.amount === 50)).toBe(true);
  });

  it('advance to nearest Utility forces 10x dice rent', () => {
    (state as any).ownership[propertyId('electric')] = p2;
    const { state: s } = drawCard('chance', 'chance_nearest_util');
    expect(s.players[0]!.position).toBe(12);
    expect(s.players[0]!.money).toBe(1480); // dice total 2 * 10
  });

  it('property repairs are billed per house and per hotel', () => {
    (state as any).ownership[propertyId('mediterranean')] = p1;
    (state as any).ownership[propertyId('baltic')] = p1;
    (state as any).buildings[propertyId('mediterranean')] = 1;
    (state as any).buildings[propertyId('baltic')] = 5; // hotel
    const { state: s } = drawCard('chance', 'chance_repairs');
    expect(s.players[0]!.money).toBe(1375); // 25 (house) + 100 (hotel) = 125
  });

  it('advance-to-nearest-railroad wraps past GO when no railroad lies ahead', () => {
    const st = setupCard(state, 'chance', 'chance_nearest_rr_2');
    (st as any).players[0].position = 31; // +5 = 36 (Chance)
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.5]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.position).toBe(5); // nearest railroad wraps to Reading
    expect(next.players[0]!.money).toBe(1700); // +$200 passing GO, no rent (unowned railroad)
    expect(res.data.events.some(e => e.type === 'PASSED_GO')).toBe(true);
  });

  it('advance-to-nearest-utility wraps past GO when no utility lies ahead', () => {
    const st = setupCard(state, 'chance', 'chance_nearest_util');
    (st as any).players[0].position = 31; // +5 = 36 (Chance)
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.5]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.position).toBe(12); // nearest utility wraps to Electric
    expect(next.players[0]!.money).toBe(1700); // +$200 passing GO, no rent (unowned utility)
    expect(res.data.events.some(e => e.type === 'PASSED_GO')).toBe(true);
  });

  it('pay-each-player card pays every other active player when affordable', () => {
    const st = setupCard(state, 'chance', 'chance_chairman');
    (st as any).players[0].position = 5; // roll 2 -> Chance(7)
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.money).toBe(1450); // paid $50
    expect(next.players[1]!.money).toBe(1550); // received $50
  });

  it('property repairs create a debt when the player cannot afford them', () => {
    const st = setupCard(state, 'chance', 'chance_repairs');
    (st as any).players[0].position = 5; // roll 2 -> Chance(7)
    (st as any).ownership[propertyId('mediterranean')] = p1;
    (st as any).ownership[propertyId('baltic')] = p1;
    (st as any).buildings[propertyId('mediterranean')] = 1; // $25
    (st as any).buildings[propertyId('baltic')] = 5; // hotel, $100
    (st as any).players[0].money = 100; // cannot afford $125
    const res = MonopolyEngine.reduce(st, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.1]));
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.money).toBe(100);
    expect(next.players[0]!.debt).toEqual({ amount: 125, to: 'BANK', reason: 'Property Repairs' });
    expect(res.data.events.some(e => e.type === 'DEBT_INCURRED')).toBe(true);
  });
});

describe('MonopolyEngine - Trading', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('proposes, accepts, rejects, and cancels trades', () => {
    (state as any).ownership[propertyId('mediterranean')] = p1;

    // Propose
    state = apply(state, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [propertyId('mediterranean')], requestedProperties: [],
      offeredMoney: 0, requestedMoney: 100
    }, rng);
    expect(state.activeTrade).not.toBeNull();

    // Accept (recipient can accept)
    let res = MonopolyEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.ownership[propertyId('mediterranean')]).toBe(p2);
    expect(res.data.nextState.players[0]!.money).toBe(1600);
    expect(res.data.nextState.players[1]!.money).toBe(1400);
    expect(res.data.events.some(e => e.type === 'TRADE_ACCEPTED')).toBe(true);

    // Reject
    state = apply(res.data.nextState, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [], offeredMoney: 0, requestedMoney: 0
    }, rng);
    res = MonopolyEngine.reduce(state, { type: 'REJECT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.activeTrade).toBeNull();
    expect(res.data.events.some(e => e.type === 'TRADE_REJECTED')).toBe(true);

    // Cancel (proposer can cancel)
    state = apply(res.data.nextState, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [], offeredMoney: 0, requestedMoney: 0
    }, rng);
    res = MonopolyEngine.reduce(state, { type: 'CANCEL_TRADE', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.activeTrade).toBeNull();
    expect(res.data.events.some(e => e.type === 'TRADE_CANCELLED')).toBe(true);
  });

  it('fails ACCEPT_TRADE when the proposer can no longer pay the offered money', () => {
    (state as any).players[0].money = 50;
    state = apply(state, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [], offeredMoney: 100, requestedMoney: 0
    }, rng);

    const res = MonopolyEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('PROPOSER_INSUFFICIENT_FUNDS');
  });

  it('fails ACCEPT_TRADE when the recipient cannot pay the requested money', () => {
    (state as any).players[1].money = 50;
    state = apply(state, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [], offeredMoney: 0, requestedMoney: 100
    }, rng);

    const res = MonopolyEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });

  it('charges the accepting player 10% interest on a mortgaged property', () => {
    (state as any).ownership[propertyId('boardwalk')] = p1;
    (state as any).mortgagedProperties[propertyId('boardwalk')] = true;

    state = apply(state, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [propertyId('boardwalk')], requestedProperties: [],
      offeredMoney: 0, requestedMoney: 0
    }, rng);

    const res = MonopolyEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.ownership[propertyId('boardwalk')]).toBe(p2);
    expect(res.data.nextState.mortgagedProperties[propertyId('boardwalk')]).toBe(true);
    expect(res.data.nextState.players[1]!.money).toBe(1480); // 1500 - 20 interest
  });

  it('charges the proposer 10% interest on a mortgaged property received in trade', () => {
    (state as any).ownership[propertyId('boardwalk')] = p2;
    (state as any).mortgagedProperties[propertyId('boardwalk')] = true;

    state = apply(state, {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [propertyId('boardwalk')],
      offeredMoney: 0, requestedMoney: 0
    }, rng);

    const res = MonopolyEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.ownership[propertyId('boardwalk')]).toBe(p1);
    expect(res.data.nextState.mortgagedProperties[propertyId('boardwalk')]).toBe(true);
    expect(res.data.nextState.players[0]!.money).toBe(1480); // 1500 - 20 interest
  });
});

describe('MonopolyEngine - Mortgage & Debt', () => {
  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('mortgages a property for half its price and guards misuse', () => {
    (state as any).ownership[propertyId('mediterranean')] = p1;

    let res = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.money).toBe(1530); // +30
    expect(res.data.nextState.mortgagedProperties[propertyId('mediterranean')]).toBe(true);

    // Already mortgaged
    res = MonopolyEngine.reduce(res.data.nextState, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('ALREADY_MORTGAGED');

    // Not the owner
    res = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('boardwalk') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_OWNER');
  });

  it('unmortgages for 110% of the mortgage value and guards misuse', () => {
    (state as any).ownership[propertyId('mediterranean')] = p1;
    (state as any).mortgagedProperties[propertyId('mediterranean')] = true;

    let res = MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.money).toBe(1467); // 1500 - ceil(30 * 1.1)
    expect(res.data.nextState.mortgagedProperties[propertyId('mediterranean')]).toBe(false);

    // Nothing mortgaged
    res = MonopolyEngine.reduce(res.data.nextState, { type: 'UNMORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_MORTGAGED');

    // Cannot afford
    (state as any).mortgagedProperties[propertyId('mediterranean')] = true;
    (state as any).players[0].money = 10;
    res = MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });

  it('PAY_DEBT clears a bank debt and errors with no debt', () => {
    (state as any).players[0].debt = { amount: 100, to: 'BANK', reason: 'Rent' };
    state = apply(state, { type: 'PAY_DEBT', playerId: p1 }, rng);
    expect(state.players[0]!.money).toBe(1400);
    expect(state.players[0]!.debt).toBeNull();

    let res = MonopolyEngine.reduce(state, { type: 'PAY_DEBT', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NO_DEBT');
  });

  it('declaring bankruptcy finishes the game with the survivor as winner', () => {
    (state as any).players[0].debt = { amount: 1000, to: 'BANK', reason: 'Rent' };
    (state as any).ownership[propertyId('mediterranean')] = p1;

    const res = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    const next = res.data.nextState;
    expect(next.players[0]!.status).toBe('BANKRUPT');
    expect(next.status).toBe('FINISHED');
    expect(res.data.events.some(e => e.type === 'GAME_OVER' && e.winnerId === p2)).toBe(true);
    expect(next.ownership[propertyId('mediterranean')]).toBeUndefined();
  });

  it('guards MORTGAGE_PROPERTY on a non-property space', () => {
    const res = MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('go') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_PURCHASABLE');
  });

  it('guards UNMORTGAGE_PROPERTY on a non-property space and a non-owner', () => {
    let res = MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('go') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_PURCHASABLE');

    (state as any).ownership[propertyId('boardwalk')] = p2;
    (state as any).mortgagedProperties[propertyId('boardwalk')] = true;
    res = MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('boardwalk') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_OWNER');
  });

  it('rejects PAY_DEBT when the player cannot cover the amount', () => {
    (state as any).players[0].debt = { amount: 1000, to: 'BANK', reason: 'Rent' };
    (state as any).players[0].money = 500;
    const res = MonopolyEngine.reduce(state, { type: 'PAY_DEBT', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });
});

describe('MonopolyEngine - isValidAction Coverage', () => {
  let rng: DeterministicRNG;
  let state: HelperState;

  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('validates a turn, jail, debt, and trade actions', () => {
    // Pre-roll
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p2 })).toBe(false);

    // Post-roll
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, new DeterministicRNG([0.1, 0.3]));
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(true);

    // Jail actions
    (state as any).players[0].inJail = true;
    (state as any).players[0].hasRolled = false;
    (state as any).players[0].getOutOfJailFreeCards = ['chance_jail_free'];
    expect(MonopolyEngine.isValidAction(state, { type: 'PAY_JAIL_FINE', playerId: p1 })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'USE_JAIL_CARD', playerId: p1 })).toBe(true);
    (state as any).players[0].getOutOfJailFreeCards = [];
    expect(MonopolyEngine.isValidAction(state, { type: 'USE_JAIL_CARD', playerId: p1 })).toBe(false);

    // Debt: only trade/bankruptcy/PAY_DEBT remain valid
    (state as any).players[0].inJail = false;
    (state as any).players[0].hasRolled = true;
    (state as any).players[0].debt = { amount: 50, to: 'BANK', reason: 'Tax' };
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'PAY_DEBT', playerId: p1 })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 })).toBe(true);

    // Trades
    (state as any).players[0].debt = null;
    const propose: MonopolyAction = {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [], requestedProperties: [], offeredMoney: 0, requestedMoney: 0
    };
    expect(MonopolyEngine.isValidAction(state, propose)).toBe(true);
    state = apply(state, propose, rng);
    expect(MonopolyEngine.isValidAction(state, propose)).toBe(false); // one active trade only
    expect(MonopolyEngine.isValidAction(state, { type: 'ACCEPT_TRADE', playerId: p2 })).toBe(true);

    // Mortgage non-owner is invalid
    expect(MonopolyEngine.isValidAction(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: propertyId('boardwalk') })).toBe(false);
  });

  it('returns false for everything after the game finishes', () => {
    (state as any).status = 'FINISHED';
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(false);
  });

  it('returns false when the current player index points to nothing', () => {
    (state as any).players = [];
    expect(MonopolyEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
  });

  it('validates BUY_HOUSE and SELL_HOUSE with build rules', () => {
    // Complete Brown monopoly with sufficient funds -> valid
    (state as any).ownership[propertyId('mediterranean')] = p1;
    (state as any).ownership[propertyId('baltic')] = p1;
    (state as any).players[0].money = 1000;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false); // no buildings

    // Railroad: no colorGroup -> invalid
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('penn_rr') })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('penn_rr') })).toBe(false);

    // Not owner -> invalid
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('boardwalk') })).toBe(false);

    // Partial monopoly -> invalid
    (state as any).ownership[propertyId('boardwalk')] = p1;
    (state as any).ownership[propertyId('park_place')] = p2;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('boardwalk') })).toBe(false);

    // Mortgaged group member -> invalid
    (state as any).mortgagedProperties[propertyId('baltic')] = true;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);
    (state as any).mortgagedProperties[propertyId('baltic')] = false;

    // Insufficient funds -> invalid
    (state as any).players[0].money = 10;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);
    (state as any).players[0].money = 1000;

    // Even-build rule: BUY_HOUSE rejected when property outruns the group minimum
    (state as any).buildings[propertyId('mediterranean')] = 2;
    (state as any).buildings[propertyId('baltic')] = 1;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);
    // Even-sell rule: SELL_HOUSE rejected when property falls below the group maximum
    expect(MonopolyEngine.isValidAction(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('baltic') })).toBe(false);
    expect(MonopolyEngine.isValidAction(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(true);

    // Max buildings on the property (>= 5) -> invalid
    (state as any).buildings[propertyId('mediterranean')] = 5;
    (state as any).buildings[propertyId('baltic')] = 5;
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);

    // Hotel supply limit (12 hotels) reached on 4 houses -> invalid
    (state as any).buildings[propertyId('mediterranean')] = 4;
    (state as any).buildings[propertyId('baltic')] = 4;
    const hotelProps = ['st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana', 'illinois', 'atlantic', 'ventnor', 'marvin'];
    hotelProps.forEach(pid => {
      (state as any).buildings[propertyId(pid)] = 5;
    });
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);

    // House supply limit (32 houses) reached -> invalid
    (state as any).buildings[propertyId('mediterranean')] = 0;
    (state as any).buildings[propertyId('baltic')] = 0;
    const houseProps = ['oriental', 'vermont', 'connecticut', 'st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana', 'illinois', 'atlantic', 'ventnor', 'marvin', 'pacific', 'north_carolina', 'pennsylvania'];
    houseProps.forEach(pid => {
      (state as any).buildings[propertyId(pid)] = 2; // 18 x 2 = 36 houses >= 32
    });
    expect(MonopolyEngine.isValidAction(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') })).toBe(false);
  });

  it('validates PROPOSE_TRADE building blocks and CANCEL_TRADE', () => {
    (state as any).ownership[propertyId('mediterranean')] = p1;
    (state as any).ownership[propertyId('baltic')] = p1;
    (state as any).buildings[propertyId('baltic')] = 1;

    const trade: MonopolyAction = {
      type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2,
      offeredProperties: [propertyId('mediterranean')], requestedProperties: [],
      offeredMoney: 0, requestedMoney: 0
    };
    expect(MonopolyEngine.isValidAction(state, trade)).toBe(false); // buildings in the group

    (state as any).buildings[propertyId('baltic')] = 0;
    const okTrade: MonopolyAction = { ...trade };
    expect(MonopolyEngine.isValidAction(state, okTrade)).toBe(true);

    state = apply(state, okTrade, rng);
    expect(MonopolyEngine.isValidAction(state, { type: 'CANCEL_TRADE', playerId: p1 })).toBe(true);
    expect(MonopolyEngine.isValidAction(state, { type: 'CANCEL_TRADE', playerId: p2 })).toBe(false);
  });
});

describe('MonopolyEngine - Reduce Guards', () => {
  let rng: DeterministicRNG;
  let state: HelperState;

  beforeEach(() => {
    rng = new DeterministicRNG([0.5]);
    state = clearDecks(MonopolyEngine.getInitialState([p1, p2], rng));
  });

  it('finishes the game when END_TURN leaves a single active player', () => {
    (state as any).players[1].status = 'BANKRUPT';
    (state as any).players[0].hasRolled = true;
    const res = MonopolyEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.events.some(e => e.type === 'GAME_OVER' && e.winnerId === p1)).toBe(true);
  });

  it('errors when the current player index points outside the players array', () => {
    (state as any).players = [];
    const res = MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('PLAYER_NOT_FOUND');
  });

  it('returns INVALID_ACTION_TYPE for an unknown action', () => {
    const res = MonopolyEngine.reduce(state, { type: 'NOT_A_REAL_ACTION', playerId: p1 } as unknown as MonopolyAction, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INVALID_ACTION_TYPE');
  });

  it('silently succeeds on DECLARE_BANKRUPTCY when there is no debt', () => {
    const res = MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.players[0]!.status).toBe('ACTIVE');
    expect(res.data.events.filter(e => e.type === 'BANKRUPTCY_DECLARED')).toHaveLength(0);
  });

  it('guards BUY_HOUSE for non-purchasable spaces, non-owners, and insufficient funds', () => {
    // Railroad: not purchasable for houses
    let res = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('penn_rr') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_PURCHASABLE');

    // Owned by another player
    (state as any).ownership[propertyId('mediterranean')] = p2;
    res = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_OWNER');

    // Insufficient funds (valid Brown monopoly, 0 houses, but broke)
    (state as any).ownership[propertyId('mediterranean')] = p1;
    (state as any).ownership[propertyId('baltic')] = p1;
    (state as any).mortgagedProperties[propertyId('mediterranean')] = false;
    (state as any).mortgagedProperties[propertyId('baltic')] = false;
    (state as any).players[0].money = 10;
    res = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('INSUFFICIENT_FUNDS');

    // Already at 5 buildings
    (state as any).players[0].money = 1000;
    (state as any).buildings[propertyId('mediterranean')] = 5;
    (state as any).buildings[propertyId('baltic')] = 5;
    res = MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('MAX_BUILDINGS');
  });

  it('guards SELL_HOUSE for non-purchasable spaces, non-owners, and no buildings', () => {
    // Railroad: not purchasable for selling
    let res = MonopolyEngine.reduce(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('penn_rr') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_PURCHASABLE');

    // Owned by another player
    (state as any).ownership[propertyId('mediterranean')] = p2;
    res = MonopolyEngine.reduce(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NOT_OWNER');

    // No buildings
    (state as any).ownership[propertyId('mediterranean')] = p1;
    res = MonopolyEngine.reduce(state, { type: 'SELL_HOUSE', playerId: p1, propertyId: propertyId('mediterranean') }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('NO_BUILDINGS');
  });
});

describe('MonopolyEngine - Player Count Validation', () => {
  it('rejects fewer than 2 players', () => {
    expect(() => MonopolyEngine.getInitialState([p1], new DeterministicRNG([0.5]))).toThrow('Monopoly requires 2 to 8 players.');
  });

  it('rejects more than 8 players', () => {
    const many = Array.from({ length: 9 }, (_, i) => playerId(`p${i + 1}`));
    expect(() => MonopolyEngine.getInitialState(many, new DeterministicRNG([0.5]))).toThrow('Monopoly requires 2 to 8 players.');
  });

  it('accepts 2 and 8 players', () => {
    expect(MonopolyEngine.getInitialState([p1, p2], new DeterministicRNG([0.5])).players).toHaveLength(2);
    const many = Array.from({ length: 8 }, (_, i) => playerId(`p${i + 1}`));
    expect(MonopolyEngine.getInitialState(many, new DeterministicRNG([0.5])).players).toHaveLength(8);
  });
});