import { describe, expect, it } from 'vitest';
import { playerId, PropertyId } from '@packages/engine-core';
import type { IMonopolyPlayer, IMonopolyState, MonopolyAction } from '@packages/monopoly-engine';
import { MonopolyEngine } from '@packages/monopoly-engine';
import { MonopolyBot } from '../src/MonopolyBot';

const bot = new MonopolyBot();

function makeRng() {
  let i = 0;
  const values = [0.1, 0.4];
  return { next: () => values[i++ % values.length]! };
}

function makePlayer(id: string, patch: Partial<IMonopolyPlayer> = {}): IMonopolyPlayer {
  return {
    id: playerId(id),
    status: 'ACTIVE',
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    hasRolled: false,
    doublesCount: 0,
    getOutOfJailFreeCards: [],
    debt: null,
    ...patch,
  };
}

function makeState(players: IMonopolyPlayer[], patch: Partial<IMonopolyState> = {}): IMonopolyState {
  const base = MonopolyEngine.getInitialState([playerId('p1'), playerId('p2')], makeRng());
  return {
    ...base,
    status: 'IN_PROGRESS',
    players,
    currentPlayerIndex: 0,
    ownership: {},
    mortgagedProperties: {},
    buildings: {},
    activeTrade: null,
    ...patch,
  };
}

/** p1 is the acting player; returns the action the bot chooses. */
function decideFor(state: IMonopolyState, player: string = 'p1'): MonopolyAction {
  return bot.decide(state, player, MonopolyEngine as any);
}

describe('MonopolyBot', () => {
  it('rolls the dice when it is its turn, unrolled and not in jail', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2')]);
    expect(decideFor(state)).toEqual({ type: 'ROLL_DICE', playerId: playerId('p1') });
  });

  it('pays the jail fine to leave jail when it can afford it', () => {
    const state = makeState([makePlayer('p1', { inJail: true }), makePlayer('p2')]);
    expect(decideFor(state)).toEqual({ type: 'PAY_JAIL_FINE', playerId: playerId('p1') });
  });

  it('uses a get-out-of-jail card before paying the fine', () => {
    const state = makeState(
      [makePlayer('p1', { inJail: true, getOutOfJailFreeCards: ['chance'] }), makePlayer('p2')]
    );
    expect(decideFor(state)).toEqual({ type: 'USE_JAIL_CARD', playerId: playerId('p1') });
  });

  it('rolls in jail when it cannot afford the fine', () => {
    const state = makeState([makePlayer('p1', { inJail: true, money: 10 }), makePlayer('p2')]);
    expect(decideFor(state)).toEqual({ type: 'ROLL_DICE', playerId: playerId('p1') });
  });

  it('buys an affordable unowned property it is standing on', () => {
    const state = makeState(
      [makePlayer('p1', { hasRolled: true, position: 1 }), makePlayer('p2')],
      { ownership: {} }
    );
    expect(decideFor(state)).toEqual({ type: 'BUY_PROPERTY', playerId: playerId('p1') });
  });

  it('does not buy a property it cannot afford and ends its turn', () => {
    // Boardwalk (price 400) with only 399 in hand: too rich an appetite.
    const state = makeState(
      [makePlayer('p1', { hasRolled: true, position: 39, money: 399 }), makePlayer('p2')],
      { ownership: {} }
    );
    expect(decideFor(state)).toEqual({ type: 'END_TURN', playerId: playerId('p1') });
  });

  it('pays off an existing debt when it has the cash', () => {
    const state = makeState(
      [makePlayer('p1', { hasRolled: false, debt: { amount: 100, to: 'BANK', reason: 'Luxury Tax' } }), makePlayer('p2')]
    );
    expect(decideFor(state)).toEqual({ type: 'PAY_DEBT', playerId: playerId('p1') });
  });

  it('sells a house to service an unaffordable debt', () => {
    const med = 'mediterranean' as PropertyId;
    const baltic = 'baltic' as PropertyId;
    const state = makeState(
      [makePlayer('p1', { debt: { amount: 1000, to: 'BANK', reason: 'Rent' }, money: 100 }), makePlayer('p2')],
      {
        ownership: { [med]: playerId('p1'), [baltic]: playerId('p1') },
        buildings: { [med]: 2, [baltic]: 0 },
      }
    );
    // Sells from the most-developed deed first (mediterranean, 2 houses).
    expect(decideFor(state)).toEqual({ type: 'SELL_HOUSE', playerId: playerId('p1'), propertyId: med });
  });

  it('mortgages a property when it cannot pay or sell', () => {
    const med = 'mediterranean' as PropertyId;
    const state = makeState(
      [makePlayer('p1', { debt: { amount: 2000, to: 'BANK', reason: 'Rent' } }), makePlayer('p2')],
      { ownership: { [med]: playerId('p1') }, buildings: {} }
    );
    expect(decideFor(state)).toEqual({ type: 'MORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: med });
  });

  it('declares bankruptcy when it has no cash, houses or deeds left', () => {
    const state = makeState(
      [makePlayer('p1', { debt: { amount: 1000, to: 'BANK', reason: 'Rent' }, money: 0 }), makePlayer('p2')],
      { ownership: {}, buildings: {} }
    );
    expect(decideFor(state)).toEqual({ type: 'DECLARE_BANKRUPTCY', playerId: playerId('p1') });
  });

  it('builds a house on a fully-owned color group after rolling', () => {
    const med = 'mediterranean' as PropertyId;
    const baltic = 'baltic' as PropertyId;
    const state = makeState(
      [makePlayer('p1', { hasRolled: true }), makePlayer('p2')],
      { ownership: { [med]: playerId('p1'), [baltic]: playerId('p1') }, buildings: {} }
    );
    expect(decideFor(state)).toEqual({ type: 'BUY_HOUSE', playerId: playerId('p1'), propertyId: med });
  });

  it('unmortgages a deed once flush with cash', () => {
    const med = 'mediterranean' as PropertyId;
    const state = makeState(
      [makePlayer('p1', { hasRolled: true }), makePlayer('p2')],
      { ownership: { [med]: playerId('p1') }, mortgagedProperties: { [med]: true } }
    );
    expect(decideFor(state)).toEqual({ type: 'UNMORTGAGE_PROPERTY', playerId: playerId('p1'), propertyId: med });
  });

  it('accepts a favorable trade offered to it', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2')], {
      activeTrade: {
        id: 't1',
        fromPlayerId: playerId('p2'),
        toPlayerId: playerId('p1'),
        offeredProperties: ['boardwalk' as PropertyId], // 400
        requestedProperties: ['mediterranean' as PropertyId], // 60
        offeredMoney: 0,
        requestedMoney: 0,
      },
    });
    expect(decideFor(state)).toEqual({ type: 'ACCEPT_TRADE', playerId: playerId('p1') });
  });

  it('rejects an unfavorable trade offered to it', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2')], {
      activeTrade: {
        id: 't2',
        fromPlayerId: playerId('p2'),
        toPlayerId: playerId('p1'),
        offeredProperties: ['mediterranean' as PropertyId], // 60
        requestedProperties: ['boardwalk' as PropertyId], // 400
        offeredMoney: 0,
        requestedMoney: 0,
      },
    });
    expect(decideFor(state)).toEqual({ type: 'REJECT_TRADE', playerId: playerId('p1') });
  });

  it('cancels a stale trade it proposed itself', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2')], {
      activeTrade: {
        id: 't3',
        fromPlayerId: playerId('p1'),
        toPlayerId: playerId('p2'),
        offeredProperties: [],
        requestedProperties: [],
        offeredMoney: 100,
        requestedMoney: 0,
      },
    });
    expect(decideFor(state)).toEqual({ type: 'CANCEL_TRADE', playerId: playerId('p1') });
  });
});