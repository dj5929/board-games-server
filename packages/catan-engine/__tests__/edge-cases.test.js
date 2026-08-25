"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const CatanEngine_1 = require("../src/CatanEngine");
const board_1 = require("../src/board");
const engine_core_1 = require("@packages/engine-core");
const helpers_1 = require("@packages/engine-core/test/helpers");
(0, vitest_1.describe)('CatanEngine - Edge Cases & Phase E Features', () => {
    (0, vitest_1.it)('should allow city to produce 2 resources on dice roll', () => {
        const rng = new helpers_1.DeterministicRNG([0.5, 0.5]); // rolls 8 (4+4)
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        const hex8 = state.board.hexes.find(h => h.numberToken === 8);
        const vertexId = Object.keys(board_1.boardGraph.vertices).find(vId => board_1.boardGraph.vertices[vId].adjacentHexes.includes(hex8.id));
        state.board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: (0, engine_core_1.playerId)('p1'), building: 'CITY' };
        const initialResourceCount = state.players[0].resources[hex8.resource] || 0;
        const rollAction = { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') };
        const res = CatanEngine_1.CatanEngine.reduce(state, rollAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        const finalResourceCount = state.players[0].resources[hex8.resource] || 0;
        (0, vitest_1.expect)(finalResourceCount).toBe(initialResourceCount + 2); // City produces 2!
    });
    (0, vitest_1.it)('should block production if Robber is on hex', () => {
        const rng = new helpers_1.DeterministicRNG([0.5, 0.5]); // rolls 8
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        const hex8 = state.board.hexes.find(h => h.numberToken === 8);
        const vertexId = Object.keys(board_1.boardGraph.vertices).find(vId => board_1.boardGraph.vertices[vId].adjacentHexes.includes(hex8.id));
        state.board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: (0, engine_core_1.playerId)('p1'), building: 'SETTLEMENT' };
        // Move robber to hex8
        const hex8Index = state.board.hexes.findIndex(h => h.id === hex8.id);
        state.board.hexes[hex8Index].hasRobber = true;
        // Remove robber from desert
        const desertIndex = state.board.hexes.findIndex(h => h.resource === 'DESERT');
        if (desertIndex >= 0)
            state.board.hexes[desertIndex].hasRobber = false;
        const initialResourceCount = state.players[0].resources[hex8.resource] || 0;
        const rollAction = { type: 'ROLL_DICE', playerId: (0, engine_core_1.playerId)('p1') };
        const res = CatanEngine_1.CatanEngine.reduce(state, rollAction, rng);
        (0, vitest_1.expect)(res.success).toBe(true);
        if (!res.success)
            return;
        state = res.data.nextState;
        const finalResourceCount = state.players[0].resources[hex8.resource] || 0;
        (0, vitest_1.expect)(finalResourceCount).toBe(initialResourceCount); // Blocked!
    });
    (0, vitest_1.it)('should fail building on occupied edge/vertex and duplicate builds', () => {
        const rng = new helpers_1.DeterministicRNG([0.1]);
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        const vertexId = Object.keys(state.board.vertices)[0];
        const edgeId = board_1.boardGraph.vertices[vertexId].adjacentEdges[0];
        // P2 occupies the vertex and edge
        state.board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: (0, engine_core_1.playerId)('p2'), building: 'SETTLEMENT' };
        state.board.edges[edgeId] = { ...state.board.edges[edgeId], owner: (0, engine_core_1.playerId)('p2') };
        // P1 tries to build on it
        const buildSettlementAction = { type: 'BUILD_SETTLEMENT', playerId: (0, engine_core_1.playerId)('p1'), vertexId };
        const res1 = CatanEngine_1.CatanEngine.reduce(state, buildSettlementAction, rng);
        (0, vitest_1.expect)(res1.success).toBe(false);
        (0, vitest_1.expect)(res1.success === false && res1.error).toBe('Vertex is already occupied');
        const buildRoadAction = { type: 'BUILD_ROAD', playerId: (0, engine_core_1.playerId)('p1'), edgeId };
        const res2 = CatanEngine_1.CatanEngine.reduce(state, buildRoadAction, rng);
        (0, vitest_1.expect)(res2.success).toBe(false);
        (0, vitest_1.expect)(res2.success === false && res2.error).toBe('Edge already occupied');
    });
    (0, vitest_1.it)('should enforce piece limits (5 settlements, 4 cities, 15 roads)', () => {
        const rng = new helpers_1.DeterministicRNG([0.1]);
        let state = CatanEngine_1.CatanEngine.getInitialState([(0, engine_core_1.playerId)('p1'), (0, engine_core_1.playerId)('p2')], rng);
        // Give player infinite resources
        state.players[0].resources = { WOOD: 100, BRICK: 100, SHEEP: 100, WHEAT: 100, ORE: 100 };
        // Setup 5 settlements for p1
        const vIds = Object.keys(state.board.vertices).slice(0, 5);
        vIds.forEach(vId => {
            state.board.vertices[vId] = { ...state.board.vertices[vId], owner: (0, engine_core_1.playerId)('p1'), building: 'SETTLEMENT' };
        });
        const vId6 = Object.keys(state.board.vertices)[5];
        // Bypass distance rule for testing piece limits by just manually giving them an adjacent road
        const edgeId6 = board_1.boardGraph.vertices[vId6].adjacentEdges[0];
        state.board.edges[edgeId6] = { ...state.board.edges[edgeId6], owner: (0, engine_core_1.playerId)('p1') };
        const buildSettlementAction = { type: 'BUILD_SETTLEMENT', playerId: (0, engine_core_1.playerId)('p1'), vertexId: vId6 };
        let res = CatanEngine_1.CatanEngine.reduce(state, buildSettlementAction, rng);
        (0, vitest_1.expect)(res.success).toBe(false);
        (0, vitest_1.expect)(res.success === false && res.error).toBe('Maximum settlements reached');
        // Upgrade 4 settlements to cities
        for (let i = 0; i < 4; i++) {
            state.board.vertices[vIds[i]] = { ...state.board.vertices[vIds[i]], owner: (0, engine_core_1.playerId)('p1'), building: 'CITY' };
        }
        // Try upgrading the 5th settlement to city
        const buildCityAction = { type: 'UPGRADE_CITY', playerId: (0, engine_core_1.playerId)('p1'), vertexId: vIds[4] };
        res = CatanEngine_1.CatanEngine.reduce(state, buildCityAction, rng);
        (0, vitest_1.expect)(res.success).toBe(false);
        (0, vitest_1.expect)(res.success === false && res.error).toBe('Maximum cities reached');
        // Setup 15 roads for p1
        const eIds = Object.keys(state.board.edges).slice(0, 15);
        eIds.forEach(eId => {
            state.board.edges[eId] = { ...state.board.edges[eId], owner: (0, engine_core_1.playerId)('p1') };
        });
        // We can't build road 16 because of the limit
        const eId16 = Object.keys(state.board.edges)[16];
        // Fake adjacent vertex owned by p1 to satisfy connection rule
        const adjV = board_1.boardGraph.edges[eId16].adjacentVertices[0];
        state.board.vertices[adjV] = { ...state.board.vertices[adjV], owner: (0, engine_core_1.playerId)('p1'), building: 'SETTLEMENT' };
        const buildRoadAction = { type: 'BUILD_ROAD', playerId: (0, engine_core_1.playerId)('p1'), edgeId: eId16 };
        res = CatanEngine_1.CatanEngine.reduce(state, buildRoadAction, rng);
        (0, vitest_1.expect)(res.success).toBe(false);
        (0, vitest_1.expect)(res.success === false && res.error).toBe('Maximum roads reached');
    });
});
