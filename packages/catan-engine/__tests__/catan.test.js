"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const CatanEngine_1 = require("../src/CatanEngine");
const board_1 = require("../src/board");
const engine_core_1 = require("@packages/engine-core");
const helpers_1 = require("@packages/engine-core/test/helpers");
(0, vitest_1.describe)('CatanEngine', () => {
    (0, vitest_1.it)('should initialize state and graph deterministically', () => {
        const rng = new helpers_1.DeterministicRNG([0.1, 0.5, 0.9]);
        const state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        (0, vitest_1.expect)(state.players).toHaveLength(2);
        (0, vitest_1.expect)(state.board.hexes).toHaveLength(19);
        // Graph tests
        (0, vitest_1.expect)(Object.keys(state.board.vertices)).toHaveLength(54);
        (0, vitest_1.expect)(Object.keys(state.board.edges)).toHaveLength(72);
    });
    (0, vitest_1.it)('should handle basic building mechanics and resource costs', () => {
        const rng = new helpers_1.DeterministicRNG([0.1]);
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Initial resources from getInitialState are 10 of each
        (0, vitest_1.expect)(state.players[0].resources.WOOD).toBe(10);
        const vertexId = Object.keys(state.board.vertices)[0];
        // Build Settlement
        const buildSettlementAction = { type: 'BUILD_SETTLEMENT', playerId: (0, engine_core_1.playerId)('p1'), vertexId };
        const res1 = CatanEngine_1.CatanEngine.reduce(state, buildSettlementAction, rng);
        (0, vitest_1.expect)(res1.success).toBe(true);
        if (!res1.success)
            return;
        state = res1.data.nextState;
        (0, vitest_1.expect)(state.players[0].resources.WOOD).toBe(9); // cost deducted
        (0, vitest_1.expect)(state.board.vertices[vertexId].owner).toBe((0, engine_core_1.playerId)('p1'));
        (0, vitest_1.expect)(state.board.vertices[vertexId].building).toBe('SETTLEMENT');
        (0, vitest_1.expect)(state.players[0].victoryPoints).toBe(1);
        // Try building adjacent (Distance Rule)
        const adjacentVertexId = board_1.boardGraph.vertices[vertexId].adjacentVertices[0];
        const buildAdjacentAction = { type: 'BUILD_SETTLEMENT', playerId: (0, engine_core_1.playerId)('p1'), vertexId: adjacentVertexId };
        const res2 = CatanEngine_1.CatanEngine.reduce(state, buildAdjacentAction, rng);
        (0, vitest_1.expect)(res2.success).toBe(false); // Should fail distance rule
        // Build Road connected to settlement
        const adjacentEdgeId = board_1.boardGraph.vertices[vertexId].adjacentEdges[0];
        const buildRoadAction = { type: 'BUILD_ROAD', playerId: (0, engine_core_1.playerId)('p1'), edgeId: adjacentEdgeId };
        const res3 = CatanEngine_1.CatanEngine.reduce(state, buildRoadAction, rng);
        (0, vitest_1.expect)(res3.success).toBe(true);
        if (!res3.success)
            return;
        state = res3.data.nextState;
        (0, vitest_1.expect)(state.board.edges[adjacentEdgeId].owner).toBe((0, engine_core_1.playerId)('p1'));
        // Upgrade City
        const upgradeCityAction = { type: 'UPGRADE_CITY', playerId: (0, engine_core_1.playerId)('p1'), vertexId };
        const res4 = CatanEngine_1.CatanEngine.reduce(state, upgradeCityAction, rng);
        (0, vitest_1.expect)(res4.success).toBe(true);
        if (!res4.success)
            return;
        state = res4.data.nextState;
        (0, vitest_1.expect)(state.board.vertices[vertexId].building).toBe('CITY');
        (0, vitest_1.expect)(state.players[0].victoryPoints).toBe(2);
    });
    (0, vitest_1.it)('should generate resources on dice roll', () => {
        const rng = new helpers_1.DeterministicRNG([0.5, 0.5]); // rolls 8 (4+4)
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Find a hex that will produce 8
        const hex8 = state.board.hexes.find(h => h.numberToken === 8);
        // Find a vertex adjacent to this hex
        const vertexId = Object.keys(board_1.boardGraph.vertices).find(vId => board_1.boardGraph.vertices[vId].adjacentHexes.includes(hex8.id));
        // Give player a settlement there
        state.board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: (0, engine_core_1.playerId)('p1'), building: 'SETTLEMENT' };
        const initialResourceCount = state.players[0].resources[hex8.resource] || 0;
        const rollAction = { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') };
        const res = CatanEngine_1.CatanEngine.reduce(state, rollAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        const finalResourceCount = state.players[0].resources[hex8.resource] || 0;
        (0, vitest_1.expect)(finalResourceCount).toBe(initialResourceCount + 1);
    });
    (0, vitest_1.it)('should reject invalid actions and enforce resource constraints', () => {
        const rng = new helpers_1.DeterministicRNG([0.1]);
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Clear resources to test constraints
        state.players[0].resources = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
        const vertexId = Object.keys(state.board.vertices)[0];
        const edgeId = Object.keys(state.board.edges)[0];
        // Fail settlement (no resources)
        const res1 = CatanEngine_1.CatanEngine.reduce(state, { type: 'BUILD_SETTLEMENT', playerId: (0, engine_core_1.playerId)('p1'), vertexId }, rng);
        (0, vitest_1.expect)(res1.success).toBe(false);
        (0, vitest_1.expect)(res1.success === false && res1.error).toBe('Not enough resources');
        // Fail road (no resources)
        const res2 = CatanEngine_1.CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: (0, engine_core_1.playerId)('p1'), edgeId }, rng);
        (0, vitest_1.expect)(res2.success).toBe(false);
        // Fail city (no resources)
        const res3 = CatanEngine_1.CatanEngine.reduce(state, { type: 'UPGRADE_CITY', playerId: (0, engine_core_1.playerId)('p1'), vertexId }, rng);
        (0, vitest_1.expect)(res3.success).toBe(false);
        // Give resources back
        state.players[0].resources = { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 };
        // Fail city (no settlement)
        const res4 = CatanEngine_1.CatanEngine.reduce(state, { type: 'UPGRADE_CITY', playerId: (0, engine_core_1.playerId)('p1'), vertexId }, rng);
        (0, vitest_1.expect)(res4.success).toBe(false);
        // Fail road (not connected)
        state.board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: (0, engine_core_1.playerId)('p1'), building: 'SETTLEMENT' };
        const farEdgeId = Object.keys(state.board.edges).find(e => !board_1.boardGraph.edges[e].adjacentVertices.includes(vertexId));
        const res5 = CatanEngine_1.CatanEngine.reduce(state, { type: 'BUILD_ROAD', playerId: (0, engine_core_1.playerId)('p1'), edgeId: farEdgeId }, rng);
        (0, vitest_1.expect)(res5.success).toBe(false);
        // Fail turn for wrong player
        const res6 = CatanEngine_1.CatanEngine.reduce(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p2') }, rng);
        (0, vitest_1.expect)(res6.success).toBe(false);
        // Unknown action
        const res7 = CatanEngine_1.CatanEngine.reduce(state, { type: 'UNKNOWN' }, rng);
        (0, vitest_1.expect)(res7.success).toBe(false);
        // isValidAction
        (0, vitest_1.expect)(CatanEngine_1.CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p2') })).toBe(false);
        (0, vitest_1.expect)(CatanEngine_1.CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') })).toBe(true);
        // END_TURN
        const res8 = CatanEngine_1.CatanEngine.reduce(state, { type: 'END_TURN', playerId: (0, engine_core_1.playerId)('p1') }, rng);
        (0, vitest_1.expect)(res8.success).toBe(true);
        if (res8.success) {
            (0, vitest_1.expect)(res8.data.nextState.activePlayerId).toBe((0, engine_core_1.playerId)('p2'));
        }
    });
});
