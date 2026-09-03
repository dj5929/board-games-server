import { describe, it, expect } from 'vitest';
import { monopolyActionSchema, catanActionSchema, scotlandYardActionSchema, actionSchemaByGame } from '../src/schemas';

const base = { playerId: 'p1' };

describe('monopolyActionSchema', () => {
  it('parses every supported monopoly action', () => {
    const validActions = [
      { type: 'ROLL_DICE' },
      { type: 'END_TURN' },
      { type: 'FORCE_END_TURN' },
      { type: 'BUY_PROPERTY' },
      { type: 'PAY_JAIL_FINE' },
      { type: 'USE_JAIL_CARD' },
      { type: 'PAY_DEBT' },
      { type: 'DECLARE_BANKRUPTCY' },
      { type: 'RESTART_GAME' },
      { type: 'MORTGAGE_PROPERTY', propertyId: 'boardwalk' },
      { type: 'UNMORTGAGE_PROPERTY', propertyId: 'boardwalk' },
      { type: 'BUY_HOUSE', propertyId: 'boardwalk' },
      { type: 'SELL_HOUSE', propertyId: 'boardwalk' },
      { type: 'ACCEPT_TRADE' },
      { type: 'REJECT_TRADE' },
      { type: 'CANCEL_TRADE' },
      { type: 'PROPOSE_TRADE', toPlayerId: 'p2', offeredProperties: [], requestedProperties: [], offeredMoney: 100, requestedMoney: 50 },
    ];

    for (const action of validActions) {
      const parsed = monopolyActionSchema.parse({ ...base, ...action });
      expect(parsed.type).toBe(action.type);
      expect(parsed.playerId).toBe('p1');
    }
  });

  it('rejects missing required trade fields', () => {
    expect(() => monopolyActionSchema.parse({ type: 'PROPOSE_TRADE', playerId: 'p1' })).toThrow();
    expect(() => monopolyActionSchema.parse({ type: 'MORTGAGE_PROPERTY', playerId: 'p1' })).toThrow();
  });

  it('rejects non-integer / negative trade money (LOW-1)', () => {
    expect(() => monopolyActionSchema.parse({
      type: 'PROPOSE_TRADE', playerId: 'p1', toPlayerId: 'p2',
      offeredProperties: [], requestedProperties: [], offeredMoney: 1.5, requestedMoney: 0
    })).toThrow();
    expect(() => monopolyActionSchema.parse({
      type: 'PROPOSE_TRADE', playerId: 'p1', toPlayerId: 'p2',
      offeredProperties: [], requestedProperties: [], offeredMoney: -1, requestedMoney: 0
    })).toThrow();
  });

  it('rejects actions from other games', () => {
    expect(() => monopolyActionSchema.parse({ ...base, type: 'MOVE', payload: { targetNode: 5, ticketType: 'taxi' } })).toThrow();
    expect(() => monopolyActionSchema.parse({ ...base, type: 'BUILD_ROAD', edgeId: 'e1' })).toThrow();
  });
});

describe('catanActionSchema', () => {
  it('parses every supported catan action', () => {
    const validActions = [
      { type: 'ROLL_DICE' },
      { type: 'END_TURN' },
      { type: 'FORCE_END_TURN' },
      { type: 'BUILD_SETTLEMENT', vertexId: 'v1' },
      { type: 'BUILD_ROAD', edgeId: 'e1' },
      { type: 'UPGRADE_CITY', vertexId: 'v1' },
      { type: 'PLACE_INITIAL_SETTLEMENT', vertexId: 'v1' },
      { type: 'PLACE_INITIAL_ROAD', edgeId: 'e1' },
      { type: 'DISCARD_RESOURCES', resources: { WOOD: 1 } },
      { type: 'MOVE_ROBBER', hexId: 'h1' },
      { type: 'MOVE_ROBBER', hexId: 'h1', targetPlayerId: 'p2' },
      { type: 'BUY_DEV_CARD' },
      { type: 'PLAY_KNIGHT', hexId: 'h1' },
      { type: 'PLAY_YEAR_OF_PLENTY', resource1: 'WOOD', resource2: 'BRICK' },
      { type: 'PLAY_MONOPOLY', resource: 'WOOD' },
      { type: 'PLAY_ROAD_BUILDING', edgeId1: 'e1' },
      { type: 'PLAY_ROAD_BUILDING', edgeId1: 'e1', edgeId2: 'e2' },
      { type: 'TRADE_BANK', offerResource: 'WOOD', requestResource: 'BRICK', amount: 2 },
      { type: 'PROPOSE_TRADE', toPlayerId: 'p2', offer: { WOOD: 1 }, request: { BRICK: 1 } },
      { type: 'ACCEPT_TRADE' },
      { type: 'REJECT_TRADE' },
      { type: 'CANCEL_TRADE' },
    ];

    for (const action of validActions) {
      const parsed = catanActionSchema.parse({ ...base, ...action });
      expect(parsed.type).toBe(action.type);
      expect(parsed.playerId).toBe('p1');
    }
  });

  it('rejects negative DISCARD_RESOURCES values (LOW-1)', () => {
    expect(() => catanActionSchema.parse({ ...base, type: 'DISCARD_RESOURCES', resources: { WOOD: -1 } })).toThrow();
  });

  it('rejects float / non-positive TRADE_BANK amounts (LOW-1)', () => {
    expect(() => catanActionSchema.parse({ ...base, type: 'TRADE_BANK', offerResource: 'WOOD', requestResource: 'BRICK', amount: 1.5 })).toThrow();
    expect(() => catanActionSchema.parse({ ...base, type: 'TRADE_BANK', offerResource: 'WOOD', requestResource: 'BRICK', amount: 0 })).toThrow();
    expect(() => catanActionSchema.parse({ ...base, type: 'TRADE_BANK', offerResource: 'WOOD', requestResource: 'BRICK', amount: -2 })).toThrow();
  });

  it('rejects actions from other games', () => {
    expect(() => catanActionSchema.parse({ ...base, type: 'MOVE', payload: { targetNode: 5, ticketType: 'taxi' } })).toThrow();
    expect(() => catanActionSchema.parse({ ...base, type: 'ROLL_DICE' })).not.toThrow();
  });
});

describe('scotlandYardActionSchema', () => {
  it('parses valid moves', () => {
    const parsed = scotlandYardActionSchema.parse({ ...base, type: 'MOVE', payload: { targetNode: 5, ticketType: 'taxi' } });
    expect(parsed.type).toBe('MOVE');
  });

  it('parses valid double moves', () => {
    const parsed = scotlandYardActionSchema.parse({
      ...base, type: 'DOUBLE_MOVE',
      payload: { move1: { targetNode: 5, ticketType: 'taxi' }, move2: { targetNode: 7, ticketType: 'bus' } }
    });
    expect(parsed.type).toBe('DOUBLE_MOVE');
  });

  it('parses a valid skip turn action', () => {
    const parsed = scotlandYardActionSchema.parse({ ...base, type: 'SKIP_TURN' });
    expect(parsed.type).toBe('SKIP_TURN');
  });

  it('rejects malformed payloads', () => {
    expect(() => scotlandYardActionSchema.parse({ ...base, type: 'MOVE', payload: { targetNode: 5 } })).toThrow();
    expect(() => scotlandYardActionSchema.parse({ ...base, type: 'MOVE' })).toThrow();
  });

  it('rejects actions from other games', () => {
    expect(() => scotlandYardActionSchema.parse({ ...base, type: 'ROLL_DICE' })).toThrow();
  });
});

describe('actionSchemaByGame', () => {
  it('maps every game type to its own schema', () => {
    expect(actionSchemaByGame.monopoly).toBe(monopolyActionSchema);
    expect(actionSchemaByGame.catan).toBe(catanActionSchema);
    expect(actionSchemaByGame['scotland-yard']).toBe(scotlandYardActionSchema);
  });
});
