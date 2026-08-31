import { describe, it, expect } from 'vitest';
import { actionSchema } from '../src/schemas';

const base = { playerId: 'p1' };

describe('actionSchema', () => {
  it('parses every supported action with a valid payload', () => {
    const validActions = [
      { type: 'ROLL_DICE' },
      { type: 'END_TURN' },
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
      { type: 'PROPOSE_TRADE', toPlayerId: 'p2', offeredMoney: 100, requestedMoney: 50 },
      { type: 'PROPOSE_TRADE', toPlayerId: 'p2', offeredProperties: ['x'], offeredMoney: 100 },
      { type: 'PROPOSE_TRADE', toPlayerId: 'p2', offer: { WOOD: 1 }, request: { BRICK: 1 } },
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
      { type: 'MOVE', payload: { targetNode: 5, ticketType: 'taxi' } },
      { type: 'DOUBLE_MOVE', payload: { move1: { targetNode: 5, ticketType: 'taxi' }, move2: { targetNode: 7, ticketType: 'bus' } } },
    ];

    for (const action of validActions) {
      const parsed = actionSchema.parse({ ...base, ...action });
      expect(parsed.type).toBe(action.type);
      expect(parsed.playerId).toBe('p1');
    }
  });

  it('rejects actions that are missing required fields', () => {
    expect(() => actionSchema.parse({ type: 'MORTGAGE_PROPERTY', playerId: 'p1' })).toThrow();
    expect(() => actionSchema.parse({ type: 'BUILD_ROAD', playerId: 'p1' })).toThrow();
    expect(() => actionSchema.parse({ type: 'PROPOSE_TRADE', playerId: 'p1' })).toThrow();
    expect(() => actionSchema.parse({ type: 'DISCARD_RESOURCES', playerId: 'p1' })).toThrow();
    expect(() => actionSchema.parse({ type: 'MOVE', playerId: 'p1', payload: { targetNode: 5 } })).toThrow();
    expect(() => actionSchema.parse({ type: 'TRADE_BANK', playerId: 'p1', offerResource: 'WOOD' })).toThrow();
  });

  it('rejects unknown action types', () => {
    expect(() => actionSchema.parse({ type: 'NO_SUCH_ACTION', playerId: 'p1' })).toThrow();
  });

  it('rejects actions without a playerId', () => {
    expect(() => actionSchema.parse({ type: 'ROLL_DICE' })).toThrow();
  });
});