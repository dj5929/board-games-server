"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionSchema = void 0;
const zod_1 = require("zod");
const baseAction = { playerId: zod_1.z.string() };
exports.actionSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('ROLL_DICE') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('END_TURN') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('BUY_PROPERTY') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('PAY_JAIL_FINE') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('USE_JAIL_CARD') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('PAY_DEBT') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('DECLARE_BANKRUPTCY') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('RESTART_GAME') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('MORTGAGE_PROPERTY'), propertyId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('UNMORTGAGE_PROPERTY'), propertyId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('BUY_HOUSE'), propertyId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('SELL_HOUSE'), propertyId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('ACCEPT_TRADE') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('REJECT_TRADE') }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('CANCEL_TRADE') }),
    zod_1.z.object({
        ...baseAction, type: zod_1.z.literal('PROPOSE_TRADE'),
        toPlayerId: zod_1.z.string(),
        offeredProperties: zod_1.z.array(zod_1.z.string()),
        requestedProperties: zod_1.z.array(zod_1.z.string()),
        offeredMoney: zod_1.z.number(),
        requestedMoney: zod_1.z.number()
    }),
    // Catan actions
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('BUILD_SETTLEMENT'), vertexId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('BUILD_ROAD'), edgeId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('UPGRADE_CITY'), vertexId: zod_1.z.string() }),
    // Catan initial placement actions
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('PLACE_INITIAL_SETTLEMENT'), vertexId: zod_1.z.string() }),
    zod_1.z.object({ ...baseAction, type: zod_1.z.literal('PLACE_INITIAL_ROAD'), edgeId: zod_1.z.string() }),
]);
