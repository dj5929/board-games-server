"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const MonopolyEngine_1 = require("../src/MonopolyEngine");
const engine_core_1 = require("@packages/engine-core");
// Deterministic RNG for tests
const mockRng = {
    values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    index: 0,
    next() {
        const val = this.values[this.index];
        this.index = (this.index + 1) % this.values.length;
        return val;
    }
};
(0, vitest_1.describe)('Bankruptcy & Debt System', () => {
    let state;
    const p1 = (0, engine_core_1.playerId)('p1');
    const p2 = (0, engine_core_1.playerId)('p2');
    const p3 = (0, engine_core_1.playerId)('p3');
    (0, vitest_1.beforeEach)(() => {
        mockRng.index = 0;
        state = MonopolyEngine_1.MonopolyEngine.getInitialState([p1, p2, p3], mockRng);
    });
    (0, vitest_1.it)('player incurs debt when rent exceeds balance', () => {
        // Setup: p2 owns Boardwalk (rent 50), p1 lands on it but has only 10 money
        state.ownership[(0, engine_core_1.propertyId)('boardwalk')] = p2;
        state.players[0].money = 10;
        state.players[0].position = 37; // Space before boardwalk (39)
        // Force dice roll to 2 (1 + 1) -> 39
        mockRng.values = [0, 0]; // 1, 1
        mockRng.index = 0;
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        const nextState = result.data.nextState;
        const p1State = nextState.players[0];
        (0, vitest_1.expect)(p1State.money).toBe(10); // Money not deducted yet
        (0, vitest_1.expect)(p1State.debt).toEqual({ amount: 50, to: p2, reason: 'Rent' });
        (0, vitest_1.expect)(result.data.events.some(e => e.type === 'DEBT_INCURRED')).toBe(true);
    });
    (0, vitest_1.it)('blocks normal actions when in debt', () => {
        state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
        // Try to end turn
        const endTurnResult = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(endTurnResult.success).toBe(false);
        if (!endTurnResult.success) {
            (0, vitest_1.expect)(endTurnResult.error).toBe('MUST_RESOLVE_DEBT');
        }
        // Try to roll dice
        const rollResult = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(rollResult.success).toBe(false);
    });
    (0, vitest_1.it)('allows PAY_DEBT if player has enough money', () => {
        state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
        state.players[0].money = 150;
        const p2InitialMoney = state.players[1].money;
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'PAY_DEBT', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        const nextState = result.data.nextState;
        (0, vitest_1.expect)(nextState.players[0].money).toBe(50);
        (0, vitest_1.expect)(nextState.players[1].money).toBe(p2InitialMoney + 100);
        (0, vitest_1.expect)(nextState.players[0].debt).toBeNull();
        (0, vitest_1.expect)(result.data.events.some(e => e.type === 'DEBT_CLEARED')).toBe(true);
    });
    (0, vitest_1.it)('allows selling/mortgaging to raise money for PAY_DEBT', () => {
        state.players[0].debt = { amount: 100, to: p2, reason: 'Rent' };
        state.players[0].money = 10;
        state.ownership[(0, engine_core_1.propertyId)('boardwalk')] = p1; // price 400, mortgage 200
        const mortgageResult = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'MORTGAGE_PROPERTY', playerId: p1, propertyId: (0, engine_core_1.propertyId)('boardwalk') }, mockRng);
        (0, vitest_1.expect)(mortgageResult.success).toBe(true);
        if (!mortgageResult.success)
            return;
        const stateAfterMortgage = mortgageResult.data.nextState;
        (0, vitest_1.expect)(stateAfterMortgage.players[0].money).toBe(210);
        const payResult = MonopolyEngine_1.MonopolyEngine.reduce(stateAfterMortgage, { type: 'PAY_DEBT', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(payResult.success).toBe(true);
    });
    (0, vitest_1.it)('DECLARE_BANKRUPTCY transfers assets to creditor and eliminates player', () => {
        state.players[0].debt = { amount: 1000, to: p2, reason: 'Rent' };
        state.players[0].money = 50;
        state.ownership[(0, engine_core_1.propertyId)('park_place')] = p1;
        state.players[0].getOutOfJailFreeCards.push('chance_jail');
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        const nextState = result.data.nextState;
        const p1State = nextState.players[0];
        const p2State = nextState.players[1];
        (0, vitest_1.expect)(p1State.status).toBe('BANKRUPT');
        (0, vitest_1.expect)(p1State.money).toBe(0);
        (0, vitest_1.expect)(p1State.debt).toBeNull();
        // Assets transferred
        (0, vitest_1.expect)(p2State.money).toBe(1500 + 50); // Original + P1's remaining cash
        (0, vitest_1.expect)(nextState.ownership[(0, engine_core_1.propertyId)('park_place')]).toBe(p2);
        (0, vitest_1.expect)(p2State.getOutOfJailFreeCards).toContain('chance_jail');
        // Turn auto-advances to p2
        (0, vitest_1.expect)(nextState.currentPlayerIndex).toBe(1);
        (0, vitest_1.expect)(result.data.events.some(e => e.type === 'BANKRUPTCY_DECLARED')).toBe(true);
    });
    (0, vitest_1.it)('DECLARE_BANKRUPTCY to BANK clears assets', () => {
        state.players[0].debt = { amount: 1000, to: 'BANK', reason: 'Tax' };
        state.players[0].money = 50;
        state.ownership[(0, engine_core_1.propertyId)('park_place')] = p1;
        state.players[0].getOutOfJailFreeCards.push('chance_jail');
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        const nextState = result.data.nextState;
        const p1State = nextState.players[0];
        (0, vitest_1.expect)(p1State.status).toBe('BANKRUPT');
        (0, vitest_1.expect)(p1State.money).toBe(0);
        (0, vitest_1.expect)(nextState.bankMoney).toBe(20580 + 50); // Original bank + P1's remaining cash
        // Assets cleared
        (0, vitest_1.expect)(nextState.ownership[(0, engine_core_1.propertyId)('park_place')]).toBeUndefined();
        (0, vitest_1.expect)(nextState.chanceDeck).toContain('chance_jail');
    });
    (0, vitest_1.it)('GAME_OVER is emitted when only 1 active player remains', () => {
        // p1 goes bankrupt
        state.players[0].debt = { amount: 1000, to: p3, reason: 'Rent' };
        let result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        state = result.data.nextState;
        // Fast forward to p2's turn
        state.currentPlayerIndex = 1;
        // p2 goes bankrupt
        state.players[1].debt = { amount: 1000, to: p3, reason: 'Rent' };
        result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'DECLARE_BANKRUPTCY', playerId: p2 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        state = result.data.nextState;
        (0, vitest_1.expect)(state.status).toBe('FINISHED');
        (0, vitest_1.expect)(result.data.events.some(e => e.type === 'GAME_OVER')).toBe(true);
    });
    (0, vitest_1.it)('END_TURN skips bankrupt players', () => {
        // p2 is bankrupt
        state.players[1].status = 'BANKRUPT';
        // p1 ends turn
        const result = MonopolyEngine_1.MonopolyEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, mockRng);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (!result.success)
            return;
        // Turn should go to p3 (index 2)
        (0, vitest_1.expect)(result.data.nextState.currentPlayerIndex).toBe(2);
    });
});
