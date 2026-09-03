import { z } from 'zod';
import type { GameType } from '@packages/engine-core';

const baseAction = { playerId: z.string() };

const nonnegativeInt = z.number().int().nonnegative();

export const monopolyActionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseAction, type: z.literal('ROLL_DICE') }),
  z.object({ ...baseAction, type: z.literal('END_TURN') }),
  z.object({ ...baseAction, type: z.literal('FORCE_END_TURN') }),
  z.object({ ...baseAction, type: z.literal('BUY_PROPERTY') }),
  z.object({ ...baseAction, type: z.literal('PAY_JAIL_FINE') }),
  z.object({ ...baseAction, type: z.literal('USE_JAIL_CARD') }),
  z.object({ ...baseAction, type: z.literal('PAY_DEBT') }),
  z.object({ ...baseAction, type: z.literal('DECLARE_BANKRUPTCY') }),
  z.object({ ...baseAction, type: z.literal('RESTART_GAME') }),
  z.object({ ...baseAction, type: z.literal('MORTGAGE_PROPERTY'), propertyId: z.string() }),
  z.object({ ...baseAction, type: z.literal('UNMORTGAGE_PROPERTY'), propertyId: z.string() }),
  z.object({ ...baseAction, type: z.literal('BUY_HOUSE'), propertyId: z.string() }),
  z.object({ ...baseAction, type: z.literal('SELL_HOUSE'), propertyId: z.string() }),
  z.object({ ...baseAction, type: z.literal('ACCEPT_TRADE') }),
  z.object({ ...baseAction, type: z.literal('REJECT_TRADE') }),
  z.object({ ...baseAction, type: z.literal('CANCEL_TRADE') }),
  z.object({
    ...baseAction, type: z.literal('PROPOSE_TRADE'),
    toPlayerId: z.string(),
    offeredProperties: z.array(z.string()),
    requestedProperties: z.array(z.string()),
    offeredMoney: nonnegativeInt,
    requestedMoney: nonnegativeInt,
  }),
]);

export const catanActionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseAction, type: z.literal('BUILD_SETTLEMENT'), vertexId: z.string() }),
  z.object({ ...baseAction, type: z.literal('BUILD_ROAD'), edgeId: z.string() }),
  z.object({ ...baseAction, type: z.literal('UPGRADE_CITY'), vertexId: z.string() }),
  z.object({ ...baseAction, type: z.literal('PLACE_INITIAL_SETTLEMENT'), vertexId: z.string() }),
  z.object({ ...baseAction, type: z.literal('PLACE_INITIAL_ROAD'), edgeId: z.string() }),
  z.object({ ...baseAction, type: z.literal('DISCARD_RESOURCES'), resources: z.record(z.string(), nonnegativeInt) }),
  z.object({ ...baseAction, type: z.literal('MOVE_ROBBER'), hexId: z.string(), targetPlayerId: z.string().optional() }),
  z.object({ ...baseAction, type: z.literal('BUY_DEV_CARD') }),
  z.object({ ...baseAction, type: z.literal('PLAY_KNIGHT'), hexId: z.string(), targetPlayerId: z.string().optional() }),
  z.object({ ...baseAction, type: z.literal('PLAY_YEAR_OF_PLENTY'), resource1: z.string(), resource2: z.string() }),
  z.object({ ...baseAction, type: z.literal('PLAY_MONOPOLY'), resource: z.string() }),
  z.object({ ...baseAction, type: z.literal('PLAY_ROAD_BUILDING'), edgeId1: z.string(), edgeId2: z.string().optional() }),
  z.object({ ...baseAction, type: z.literal('TRADE_BANK'), offerResource: z.string(), requestResource: z.string(), amount: z.number().int().positive() }),
  z.object({ ...baseAction, type: z.literal('PROPOSE_TRADE'), toPlayerId: z.string(), offer: z.record(z.string(), nonnegativeInt), request: z.record(z.string(), nonnegativeInt) }),
  z.object({ ...baseAction, type: z.literal('ACCEPT_TRADE') }),
  z.object({ ...baseAction, type: z.literal('REJECT_TRADE') }),
  z.object({ ...baseAction, type: z.literal('CANCEL_TRADE') }),
  z.object({ ...baseAction, type: z.literal('ROLL_DICE') }),
  z.object({ ...baseAction, type: z.literal('END_TURN') }),
  z.object({ ...baseAction, type: z.literal('FORCE_END_TURN') }),
]);

export const scotlandYardActionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseAction, type: z.literal('MOVE'), payload: z.object({ targetNode: z.number(), ticketType: z.string() }) }),
  z.object({ ...baseAction, type: z.literal('DOUBLE_MOVE'), payload: z.object({
    move1: z.object({ targetNode: z.number(), ticketType: z.string() }),
    move2: z.object({ targetNode: z.number(), ticketType: z.string() })
  }) }),
  z.object({ ...baseAction, type: z.literal('SKIP_TURN') }),
]);

export const actionSchemaByGame: Record<GameType, z.ZodType> = {
  'monopoly': monopolyActionSchema,
  'catan': catanActionSchema,
  'scotland-yard': scotlandYardActionSchema,
};
