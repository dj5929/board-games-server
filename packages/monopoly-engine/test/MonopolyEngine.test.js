"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_core_1 = require("@packages/engine-core");
const vitest_1 = require("vitest");
const MonopolyEngine_1 = require("../src/MonopolyEngine");
const helpers_1 = require("@packages/engine-core/test/helpers");
const board_1 = require("../src/board");
function reduceHelper(state, action, rng) {
    const result = MonopolyEngine_1.MonopolyEngine.reduce(state, action, rng);
    if (!result.success)
        throw new Error("Expected success, got " + result.error);
    return result.data;
}
(0, vitest_1.describe)('MonopolyEngine Core Mechanics', () => {
    (0, vitest_1.it)('should generate initial state correctly', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        (0, vitest_1.expect)(state.players).toHaveLength(2);
        (0, vitest_1.expect)(state.players[0].money).toBe(1500);
        (0, vitest_1.expect)(state.players[0].position).toBe(0);
        (0, vitest_1.expect)(state.currentPlayerIndex).toBe(0);
    });
    (0, vitest_1.it)('should handle ROLL_DICE correctly', () => {
        const initialState = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        const rng = new helpers_1.DeterministicRNG([0.5, 0.75]); // yields 4 and 5
        const { nextState, events } = reduceHelper(initialState, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(nextState.players[0].position).toBe(9);
        (0, vitest_1.expect)(events.some((e) => e.type === 'DICE_ROLLED')).toBe(true);
    });
    (0, vitest_1.it)('should ignore actions from non-active players', () => {
        const initialState = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        const rng = new helpers_1.DeterministicRNG([0.5, 0.75]);
        const result = MonopolyEngine_1.MonopolyEngine.reduce(initialState, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p2') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, vitest_1.expect)(result.error).toBe('NOT_YOUR_TURN');
        }
    });
});
(0, vitest_1.describe)('MonopolyEngine Phase 5: Property & Rent', () => {
    (0, vitest_1.it)('should allow player to buy an unowned property they are standing on', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Move player 1 to Mediterranean Ave (Index 1)
        state.players[0].position = 1;
        const medPrice = board_1.BOARD_SPACES[1].price; // 60
        const { nextState, events } = reduceHelper(state, { type: 'BUY_PROPERTY', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        // Player 1 should lose 60
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 - medPrice);
        // Bank gains 60
        (0, vitest_1.expect)(nextState.bankMoney).toBe(state.bankMoney + medPrice);
        // Ownership is registered
        (0, vitest_1.expect)(nextState.ownership[(0, engine_core_1.propertyId)('mediterranean')]).toBe((0, engine_core_1.playerId)('p1'));
        (0, vitest_1.expect)(events).toHaveLength(1);
        (0, vitest_1.expect)(events[0].type).toBe('PROPERTY_BOUGHT');
        if (events[0].type === 'PROPERTY_BOUGHT') {
            (0, vitest_1.expect)(events[0].price).toBe(medPrice);
        }
    });
    (0, vitest_1.it)('should not allow buying an already owned property', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.players[0].position = 1;
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2'; // p2 already owns it
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'BUY_PROPERTY', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('ALREADY_OWNED');
    });
    (0, vitest_1.it)('should auto-deduct rent when landing on an owned property', () => {
        const rng = new helpers_1.DeterministicRNG([0, 0]); // yields 1 and 1 -> position 2 (Community Chest). Wait, let's force position 1 (Mediterranean)
        // To land on 1, we need 0 dice roll, but minimum is 1+1=2. 
        // Let's start player at 39, roll 2 -> position 1.
        // 39 + 1 + 1 = 41 -> 41 % 40 = 1.
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.players[0].position = 39;
        // Give p2 ownership of Mediterranean
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2';
        const rent = board_1.BOARD_SPACES[1].baseRent; // 2
        // p1 rolls and lands on 1
        const { nextState, events } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(nextState.players[0].position).toBe(1);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 + 200 - rent); // Passed GO (+200)
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500 + rent);
        (0, vitest_1.expect)(events.some((e) => e.type === 'RENT_PAID')).toBe(true);
        const rentEvent = events.find((e) => e.type === 'RENT_PAID');
        if (rentEvent && rentEvent.type === 'RENT_PAID') {
            (0, vitest_1.expect)(rentEvent.amount).toBe(rent);
            (0, vitest_1.expect)(rentEvent.fromPlayerId).toBe((0, engine_core_1.playerId)('p1'));
            (0, vitest_1.expect)(rentEvent.toPlayerId).toBe((0, engine_core_1.playerId)('p2'));
        }
    });
});
(0, vitest_1.describe)('MonopolyEngine Phase 8: Economy & Trading', () => {
    (0, vitest_1.it)('should mortgage an unmortgaged property and receive half price', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        // Mediterranean price is 60, half is 30
        const { nextState, events } = reduceHelper(state, { type: 'MORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(nextState.mortgagedProperties[(0, engine_core_1.propertyId)('mediterranean')]).toBe(true);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1530);
        (0, vitest_1.expect)(nextState.bankMoney).toBe(state.bankMoney - 30);
        (0, vitest_1.expect)(events.some((e) => e.type === 'PROPERTY_MORTGAGED')).toBe(true);
    });
    (0, vitest_1.it)('should yield 0 rent if the landed property is mortgaged', () => {
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        const rng = new helpers_1.DeterministicRNG([0, 0]); // yields 1 and 1
        state.players[0].position = 39;
        // Give p2 ownership of Mediterranean and mortgage it
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2';
        state.mortgagedProperties[(0, engine_core_1.propertyId)('mediterranean')] = true;
        // p1 rolls and lands on 1
        const { nextState, events } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        // Money should be unchanged from rent, but passed go (+200)
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1700);
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500); // No rent paid
        (0, vitest_1.expect)(events.some((e) => e.type === 'RENT_PAID')).toBe(false);
    });
    (0, vitest_1.it)('should unmortgage a mortgaged property and pay half price + 10%', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        state.mortgagedProperties[(0, engine_core_1.propertyId)('mediterranean')] = true;
        // Mediterranean price is 60. Half is 30. +10% is 33.
        const { nextState, events } = reduceHelper(state, { type: 'UNMORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(!!nextState.mortgagedProperties[(0, engine_core_1.propertyId)('mediterranean')]).toBe(false);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 - 33);
        (0, vitest_1.expect)(nextState.bankMoney).toBe(state.bankMoney + 33);
        (0, vitest_1.expect)(events.some((e) => e.type === 'PROPERTY_UNMORTGAGED')).toBe(true);
    });
    (0, vitest_1.it)('should double base rent if player owns all properties in the color group', () => {
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        const rng = new helpers_1.DeterministicRNG([0, 0]);
        state.players[0].position = 39;
        // Give p2 ownership of Mediterranean and Baltic (Brown group)
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p2';
        const baseRent = board_1.BOARD_SPACES[1].baseRent; // 2 for med
        // p1 rolls and lands on 1 (mediterranean)
        const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        // passing go +200, rent is doubled: 2 * 2 = 4
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 + 200 - (baseRent * 2));
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500 + (baseRent * 2));
    });
    (0, vitest_1.it)('should ignore MORTGAGE_PROPERTY if player does not own the property', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Mediterranean owned by p2, but p1 tries to mortgage it
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2';
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('NOT_OWNER');
    });
    (0, vitest_1.it)('should ignore UNMORTGAGE_PROPERTY if player does not have enough money', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Give p1 an expensive property and mortgage it
        state.ownership[(0, engine_core_1.propertyId)('boardwalk')] = 'p1';
        state.mortgagedProperties[(0, engine_core_1.propertyId)('boardwalk')] = true;
        // Bankrupt p1
        state.players[0].money = 10;
        // Cost to unmortgage boardwalk is 200 + 10% = 220
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'UNMORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('boardwalk') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('INSUFFICIENT_FUNDS');
    });
    (0, vitest_1.it)('isValidAction should return correct booleans for mortgage actions', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        (0, vitest_1.expect)(MonopolyEngine_1.MonopolyEngine.isValidAction(state, { type: 'MORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') })).toBe(true);
        (0, vitest_1.expect)(MonopolyEngine_1.MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') })).toBe(false); // not mortgaged
        state.mortgagedProperties[(0, engine_core_1.propertyId)('mediterranean')] = true;
        (0, vitest_1.expect)(MonopolyEngine_1.MonopolyEngine.isValidAction(state, { type: 'MORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') })).toBe(false); // already mortgaged
        (0, vitest_1.expect)(MonopolyEngine_1.MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') })).toBe(true);
        // Insufficient funds
        state.players[0].money = 0;
        (0, vitest_1.expect)(MonopolyEngine_1.MonopolyEngine.isValidAction(state, { type: 'UNMORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') })).toBe(false);
    });
});
(0, vitest_1.describe)('MonopolyEngine Phase 8: Houses & Hotels', () => {
    (0, vitest_1.it)('should not allow buying a house if player does not own full color group', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        // p1 does not own baltic
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('NOT_MONOPOLY');
    });
    (0, vitest_1.it)('should allow buying a house and deduct housePrice', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p1';
        const housePrice = board_1.BOARD_SPACES[1].housePrice; // 50
        const { nextState, events } = reduceHelper(state, { type: 'BUY_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(nextState.buildings[(0, engine_core_1.propertyId)('mediterranean')]).toBe(1);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 - housePrice);
        (0, vitest_1.expect)(events.some((e) => e.type === 'HOUSE_BOUGHT')).toBe(true);
    });
    (0, vitest_1.it)('should enforce even building rule when buying houses', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p1';
        // Give Mediterranean 1 house
        state.buildings[(0, engine_core_1.propertyId)('mediterranean')] = 1;
        // Trying to buy a 2nd house on Mediterranean should fail because Baltic has 0
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'BUY_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('EVEN_BUILD_RULE');
    });
    (0, vitest_1.it)('should calculate rent correctly based on number of houses', () => {
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        const rng = new helpers_1.DeterministicRNG([0, 0]);
        state.players[0].position = 39;
        // Give p2 ownership of Brown group and 2 houses on Mediterranean
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p2';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p2';
        state.buildings[(0, engine_core_1.propertyId)('mediterranean')] = 2;
        state.buildings[(0, engine_core_1.propertyId)('baltic')] = 1;
        const expectedRent = board_1.BOARD_SPACES[1].rentWithHouses[1]; // 2 houses = index 1 -> 30 rent
        // p1 rolls and lands on Mediterranean (pos 1)
        const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        // passing go +200, rent deducted
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 + 200 - expectedRent);
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500 + expectedRent);
    });
    (0, vitest_1.it)('should allow selling a house for half price and enforce even building rule', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p1';
        // Give Mediterranean 2 houses and Baltic 2 houses
        state.buildings[(0, engine_core_1.propertyId)('mediterranean')] = 2;
        state.buildings[(0, engine_core_1.propertyId)('baltic')] = 2;
        const housePrice = board_1.BOARD_SPACES[1].housePrice; // 50
        // Sell 1 from Mediterranean
        let transition = reduceHelper(state, { type: 'SELL_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(transition.nextState.buildings[(0, engine_core_1.propertyId)('mediterranean')]).toBe(1);
        (0, vitest_1.expect)(transition.nextState.players[0].money).toBe(1500 + (housePrice / 2)); // +25
        (0, vitest_1.expect)(transition.events.some((e) => e.type === 'HOUSE_SOLD')).toBe(true);
        // Now Mediterranean has 1, Baltic has 2. Try to sell Mediterranean again (should fail due to even building)
        const failResult = MonopolyEngine_1.MonopolyEngine.reduce(transition.nextState, { type: 'SELL_HOUSE', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('mediterranean') }, rng);
        (0, vitest_1.expect)(failResult.success).toBe(false);
        if (!failResult.success)
            (0, vitest_1.expect)(failResult.error).toBe('EVEN_BUILD_RULE');
    });
});
(0, vitest_1.describe)('MonopolyEngine Phase 5/8: Missing Game Logic Fixes', () => {
    (0, vitest_1.it)('should scale Railroad rent based on number of railroads owned', () => {
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        state.players[0].position = 39;
        // Give p2 ownership of 2 railroads (Reading and Penn)
        state.ownership[(0, engine_core_1.propertyId)('reading')] = 'p2';
        state.ownership[(0, engine_core_1.propertyId)('penn_rr')] = 'p2';
        // p1 rolls and lands on reading (pos 5)
        // Needs a roll of 6 to get from 39 to 5
        const customRng = new helpers_1.DeterministicRNG([3 / 6, 2 / 6]); // yields 4 and 3 -> 7, pos 6 (Oriental). Let's use 2 and 4
        const rrRng = new helpers_1.DeterministicRNG([1 / 6, 3 / 6]); // yields 2 and 4 = 6. 39 + 6 = 45 -> 45 % 40 = 5 (Reading)
        const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, rrRng);
        (0, vitest_1.expect)(nextState.players[0].position).toBe(5);
        // Rent for 2 railroads is 50. 
        // Player 1 passing go: +200, rent: -50
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 + 200 - 50);
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500 + 50);
    });
    (0, vitest_1.it)('should calculate Utility rent as 4x or 10x the dice roll', () => {
        const state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], new helpers_1.DeterministicRNG([]));
        state.players[0].position = 7;
        // Give p2 ownership of Electric Company
        state.ownership[(0, engine_core_1.propertyId)('electric')] = 'p2';
        // Roll 5 (lands on Electric Company, pos 12)
        const utilRng = new helpers_1.DeterministicRNG([1 / 6, 2 / 6]); // yields 2 and 3 = 5
        const { nextState } = reduceHelper(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, utilRng);
        (0, vitest_1.expect)(nextState.players[0].position).toBe(12);
        // 1 utility = 4x dice roll. Dice roll is 5. Rent = 20.
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 - 20);
        (0, vitest_1.expect)(nextState.players[1].money).toBe(1500 + 20);
        // Now p2 owns both utilities
        nextState.ownership[(0, engine_core_1.propertyId)('water')] = 'p2';
        nextState.players[0].position = 22; // Start closer to Water Works (pos 28)
        const util2Rng = new helpers_1.DeterministicRNG([2 / 6, 2 / 6]); // yields 3 and 3 = 6
        // wait, if we yield doubles, they go to jail? 
        // No, only 3 doubles. But rolling doubles doesn't end turn. That's fine.
        const util2State = reduceHelper(nextState, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') }, util2Rng).nextState;
        (0, vitest_1.expect)(util2State.players[0].position).toBe(28);
        // 2 utilities = 10x dice roll. Dice roll is 6. Rent = 60.
        (0, vitest_1.expect)(util2State.players[0].money).toBe(1500 - 20 - 60);
    });
    (0, vitest_1.it)('should not allow mortgaging a property if there are buildings in the color group', () => {
        const rng = new helpers_1.DeterministicRNG([]);
        let state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        state.ownership[(0, engine_core_1.propertyId)('mediterranean')] = 'p1';
        state.ownership[(0, engine_core_1.propertyId)('baltic')] = 'p1';
        state.buildings[(0, engine_core_1.propertyId)('mediterranean')] = 1; // 1 house in the group
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: (0, engine_core_1.playerId)('p1'), propertyId: (0, engine_core_1.propertyId)('baltic') }, rng);
        (0, vitest_1.expect)(result.success).toBe(false);
        if (!result.success)
            (0, vitest_1.expect)(result.error).toBe('HAS_BUILDINGS');
    });
});
