"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const Room_1 = require("../src/Room");
const monopoly_engine_1 = require("@packages/monopoly-engine");
(0, vitest_1.describe)('Room', () => {
    (0, vitest_1.it)('should initialize state correctly', () => {
        const rng = { next: () => 0.5 };
        const room = new Room_1.Room('test-room', 'monopoly', monopoly_engine_1.MonopolyEngine, rng, ['p1', 'p2']);
        const state = room.getState();
        (0, vitest_1.expect)(state.players).toHaveLength(2);
        (0, vitest_1.expect)(state.currentPlayerIndex).toBe(0);
    });
    (0, vitest_1.it)('should broadcast state on connection', () => {
        const rng = { next: () => 0.5 };
        const room = new Room_1.Room('test-room', 'monopoly', monopoly_engine_1.MonopolyEngine, rng, ['p1', 'p2']);
        const mockSend = vitest_1.vi.fn();
        room.addConnection('p1', { send: mockSend });
        (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(mockSend.mock.calls[0][0]);
        (0, vitest_1.expect)(payload.type).toBe('STATE_UPDATE');
        (0, vitest_1.expect)(payload.state.players).toHaveLength(2);
    });
    (0, vitest_1.it)('should dispatch action and broadcast updates', () => {
        const rng = { next: () => 0.5 };
        const room = new Room_1.Room('test-room', 'monopoly', monopoly_engine_1.MonopolyEngine, rng, ['p1', 'p2']);
        const mockSend = vitest_1.vi.fn();
        room.addConnection('p1', { send: mockSend });
        // reset mock to clear the initial STATE_UPDATE from connection
        mockSend.mockClear();
        // p1 rolls dice
        room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' });
        // Expect 2 broadcasts: STATE_UPDATE and EVENTS
        (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(2);
        const stateUpdate = JSON.parse(mockSend.mock.calls[0][0]);
        (0, vitest_1.expect)(stateUpdate.type).toBe('STATE_UPDATE');
        (0, vitest_1.expect)(stateUpdate.state.players[0].position).toBe(8); // 4 + 4 based on 0.5 rng -> Math.floor(0.5*6)+1 = 4
        const eventsUpdate = JSON.parse(mockSend.mock.calls[1][0]);
        (0, vitest_1.expect)(eventsUpdate.type).toBe('EVENTS');
        (0, vitest_1.expect)(eventsUpdate.events[0].type).toBe('DICE_ROLLED');
    });
});
