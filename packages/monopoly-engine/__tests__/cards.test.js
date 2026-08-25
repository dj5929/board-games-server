"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MonopolyEngine_1 = require("../src/MonopolyEngine");
const engine_core_1 = require("@packages/engine-core");
const helpers_1 = require("@packages/engine-core/test/helpers");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Chance & Community Chest Cards', () => {
    let state;
    (0, vitest_1.beforeEach)(() => {
        // 0 = 0, so random choices for decks will just keep order
        const rng = new helpers_1.DeterministicRNG([0]);
        state = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('player1'), (0, engine_core_1.playerId)('player2')], rng);
    });
    (0, vitest_1.it)('initializes chanceDeck and chestDeck', () => {
        (0, vitest_1.expect)(state.chanceDeck).toBeDefined();
        (0, vitest_1.expect)(state.chanceDeck.length).toBe(16);
        (0, vitest_1.expect)(state.chestDeck).toBeDefined();
        (0, vitest_1.expect)(state.chestDeck.length).toBe(16);
    });
    (0, vitest_1.it)('draws a chance card and handles movement effect', () => {
        // Force player to space 7 (Chance)
        // Roll dice: 3 + 4 = 7
        // Math.floor(rng * 6) => we want 3 and 4 => we need rng to return 2/6 and 3/6
        const rng = new helpers_1.DeterministicRNG([2 / 6, 3 / 6]);
        // With rng always 0 during getInitialState, the chance array is un-shuffled (reversed? our shuffle loops backwards so actually it swaps i with 0, meaning it moves elements to front). 
        // Wait, let's just cheat and explicitly set the deck in the test.
        const customState = {
            ...structuredClone(state),
            chanceDeck: ['chance_advance_go', ...state.chanceDeck.filter((x) => x !== 'chance_advance_go')]
        };
        const res = MonopolyEngine_1.MonopolyEngine.reduce(customState, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('player1') }, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        const nextState = res.data.nextState;
        // chance_advance_go should move to 0
        (0, vitest_1.expect)(nextState.players[0].position).toBe(0);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500 + 200); // collected 200 for passing go
    });
});
