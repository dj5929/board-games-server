"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_core_1 = require("@packages/engine-core");
const vitest_1 = require("vitest");
const MonopolyEngine_1 = require("../src/MonopolyEngine");
const helpers_1 = require("@packages/engine-core/test/helpers");
function reduceHelper(state, action, rng) {
    const result = MonopolyEngine_1.MonopolyEngine.reduce(state, action, rng);
    if (!result.success)
        throw new Error("Expected success, got " + result.error);
    return result.data;
}
(0, vitest_1.describe)('RESTART_GAME', () => {
    (0, vitest_1.it)('should reset the board to the initial state', () => {
        const rng = new helpers_1.DeterministicRNG([0.5, 0.5]);
        const initialState = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Make some changes
        initialState.players[0].money = 1000;
        initialState.players[0].position = 10;
        initialState.currentPlayerIndex = 1;
        // Now dispatch RESTART_GAME using active player's ID
        const activePlayerId = initialState.players[initialState.currentPlayerIndex].id;
        const { nextState, events } = reduceHelper(initialState, { type: 'RESTART_GAME', playerId: activePlayerId }, rng);
        (0, vitest_1.expect)(nextState.players[0].money).toBe(1500);
        (0, vitest_1.expect)(nextState.players[0].position).toBe(0);
        (0, vitest_1.expect)(nextState.currentPlayerIndex).toBe(0);
        (0, vitest_1.expect)(events).toHaveLength(1);
        (0, vitest_1.expect)(events[0].type).toBe('GAME_RESTARTED');
    });
    (0, vitest_1.it)('should allow RESTART_GAME from any player', () => {
        const rng = new helpers_1.DeterministicRNG([0.5, 0.5]);
        const initialState = MonopolyEngine_1.MonopolyEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        initialState.currentPlayerIndex = 1; // p2 is active
        // p1 tries to restart
        const result = MonopolyEngine_1.MonopolyEngine.reduce(initialState, { type: 'RESTART_GAME', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
