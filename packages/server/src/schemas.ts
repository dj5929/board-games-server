import { z } from 'zod';

const baseAction = { playerId: z.string() };

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseAction, type: z.literal('ROLL_DICE') }),
  z.object({ ...baseAction, type: z.literal('END_TURN') }),
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
    offeredMoney: z.number(),
    requestedMoney: z.number()
  }),
  // Catan actions
  z.object({ ...baseAction, type: z.literal('BUILD_SETTLEMENT'), vertexId: z.string() }),
  z.object({ ...baseAction, type: z.literal('BUILD_ROAD'), edgeId: z.string() }),
  z.object({ ...baseAction, type: z.literal('UPGRADE_CITY'), vertexId: z.string() }),
  // Catan initial placement actions
  z.object({ ...baseAction, type: z.literal('PLACE_INITIAL_SETTLEMENT'), vertexId: z.string() }),
  z.object({ ...baseAction, type: z.literal('PLACE_INITIAL_ROAD'), edgeId: z.string() }),
]);
