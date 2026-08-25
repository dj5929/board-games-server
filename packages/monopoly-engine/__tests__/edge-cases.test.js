"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const MonopolyEngine_1 = require("../src/MonopolyEngine");
const engine_core_1 = require("@packages/engine-core");
const helpers_1 = require("@packages/engine-core/test/helpers");
(0, vitest_1.describe)('MonopolyEngine - Edge Cases & Phase E Features', () => {
    (0, vitest_1.it)('should enforce house and hotel supply limits (32 houses, 12 hotels)', () => {
        const rng = new helpers_1.DeterministicRNG([0.5]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        ['mediterranean', 'baltic'].forEach(prop => {
            state.ownership[(0, engine_core_1.propertyId)(prop)] = (0, engine_core_1.playerId)('p1');
        });
        const fakeProperties = ['st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana'];
        fakeProperties.forEach(prop => {
            state.buildings[(0, engine_core_1.propertyId)(prop)] = 4;
        });
        const buyHouseAction = { type: 'BUY_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') };
        const res1 = MonopolyEngine_1.MonopolyEngine.reduce(state, buyHouseAction, rng);
        (0, vitest_1.expect)(res1.success).toBe(false);
        (0, vitest_1.expect)(res1.success === false && res1.error).toBe('MAX_BUILDINGS');
        fakeProperties.forEach(prop => { delete state.buildings[(0, engine_core_1.propertyId)(prop)]; });
        const hotelProperties = ['st_charles', 'states', 'virginia', 'st_james', 'tennessee', 'new_york', 'kentucky', 'indiana', 'illinois', 'atlantic', 'ventnor', 'marvin_gardens'];
        hotelProperties.forEach(prop => { state.buildings[(0, engine_core_1.propertyId)(prop)] = 5; });
        state.buildings[(0, engine_core_1.propertyId)('mediterranean')] = 4;
        state.buildings[(0, engine_core_1.propertyId)('baltic')] = 4;
        const buyHotelAction = { type: 'BUY_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') };
        const res2 = MonopolyEngine_1.MonopolyEngine.reduce(state, buyHotelAction, rng);
        (0, vitest_1.expect)(res2.success).toBe(false);
        (0, vitest_1.expect)(res2.success === false && res2.error).toBe('MAX_BUILDINGS');
    });
    (0, vitest_1.it)('should handle COLLECT_FROM_PLAYERS with bankrupt/poor players', () => {
        const rng = new helpers_1.DeterministicRNG([0.1, 0.1]); // Roll 1+1 = 2 (Community Chest)
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.chestDeck = ['chest_opera', ...state.chestDeck.filter(c => c !== 'chest_opera')];
        state.players[1].money = 10;
        const rollAction = { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') };
        const res = MonopolyEngine_1.MonopolyEngine.reduce(state, rollAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[1].debt).not.toBeNull();
        (0, vitest_1.expect)(state.players[1].debt?.amount).toBe(50);
        (0, vitest_1.expect)(state.players[1].debt?.to).toBe((0, engine_core_1.playerId)('p1'));
    });
    (0, vitest_1.it)('should handle PAY_PLAYERS with insufficient funds', () => {
        const rngChance = new helpers_1.DeterministicRNG([0.4, 0.5]); // 3+4 = 7 (Chance)
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2'), (0, engine_core_1.playerId)('p3')], rngChance);
        state.chanceDeck = ['chance_chairman', ...state.chanceDeck.filter(c => c !== 'chance_chairman')];
        state.players[0].money = 20; // Needs to pay $50 to each of the 2 other players ($100 total)
        const rollAction = { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') };
        const res = MonopolyEngine_1.MonopolyEngine.reduce(state, rollAction, rngChance);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[0].debt).not.toBeNull();
        (0, vitest_1.expect)(state.players[0].debt?.amount).toBe(100);
        (0, vitest_1.expect)(state.players[0].debt?.to).toBe('BANK');
    });
    (0, vitest_1.it)('should allow CANCEL_TRADE', () => {
        const rng = new helpers_1.DeterministicRNG([0.5]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        const proposeAction = {
            type: 'PROPOSE_TRADE', playerId: (0, engine_core_1.playerId)('p1'), toPlayerId: (0, engine_core_1.playerId)('p2'),
            offeredProperties: [], requestedProperties: [], offeredMoney: 100, requestedMoney: 0
        };
        let res = MonopolyEngine_1.MonopolyEngine.reduce(state, proposeAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.activeTrade).not.toBeNull();
        const cancelAction = { type: 'CANCEL_TRADE', playerId: (0, engine_core_1.playerId)('p1') };
        res = MonopolyEngine_1.MonopolyEngine.reduce(state, cancelAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.activeTrade).toBeNull();
    });
    (0, vitest_1.it)('should send player to jail on 3 consecutive doubles', () => {
        const rng = new helpers_1.DeterministicRNG([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]); // 1+1 = 2 (chest), 1+1 = 2 (tax), 1+1 = 2
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // First double
        let res = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[0].doublesCount).toBe(1);
        (0, vitest_1.expect)(state.players[0].inJail).toBe(false);
        // Second double
        res = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[0].doublesCount).toBe(2);
        (0, vitest_1.expect)(state.players[0].inJail).toBe(false);
        // Third double (Speeding!)
        res = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[0].doublesCount).toBe(0);
        (0, vitest_1.expect)(state.players[0].inJail).toBe(true);
        (0, vitest_1.expect)(state.players[0].position).toBe(10);
    });
    (0, vitest_1.it)('should allow USE_JAIL_CARD and return it to the correct deck', () => {
        const rng = new helpers_1.DeterministicRNG([0.5]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.players[0].inJail = true;
        state.players[0].position = 10;
        state.players[0].getOutOfJailFreeCards = ['chance_jail_free'];
        const initialChanceDeckLength = state.chanceDeck.length;
        const useCardAction = { type: 'USE_JAIL_CARD', playerId: (0, engine_core_1.playerId)('p1') };
        const res = MonopolyEngine_1.MonopolyEngine.reduce(state, useCardAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        (0, vitest_1.expect)(state.players[0].inJail).toBe(false);
        (0, vitest_1.expect)(state.players[0].getOutOfJailFreeCards).toHaveLength(0);
        (0, vitest_1.expect)(state.chanceDeck).toHaveLength(initialChanceDeckLength + 1);
        (0, vitest_1.expect)(state.chanceDeck[state.chanceDeck.length - 1]).toBe('chance_jail_free');
    });
});
