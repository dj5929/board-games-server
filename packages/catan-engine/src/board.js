"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardGraph = void 0;
exports.generateBoard = generateBoard;
const engine_core_1 = require("@packages/engine-core");
// Standard Catan board has 19 hexes
// Resources: 4 Wood, 4 Sheep, 4 Wheat, 3 Brick, 3 Ore, 1 Desert
const STANDARD_RESOURCES = [
    'WOOD', 'WOOD', 'WOOD', 'WOOD',
    'SHEEP', 'SHEEP', 'SHEEP', 'SHEEP',
    'WHEAT', 'WHEAT', 'WHEAT', 'WHEAT',
    'BRICK', 'BRICK', 'BRICK',
    'ORE', 'ORE', 'ORE',
    'DESERT'
];
// Tokens: 2, 12 (x1) | 3, 4, 5, 6, 8, 9, 10, 11 (x2)
const STANDARD_TOKENS = [
    2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
];
function createBoardGraph() {
    const vertices = {};
    const edges = {};
    const getHexNeighbors = (q, r) => [
        [q + 1, r], [q, r + 1], [q - 1, r + 1], [q - 1, r], [q, r - 1], [q + 1, r - 1]
    ];
    for (let q = -2; q <= 2; q++) {
        const r1 = Math.max(-2, -q - 2);
        const r2 = Math.min(2, -q + 2);
        for (let r = r1; r <= r2; r++) {
            const H = `${q},${r}`;
            const neighbors = getHexNeighbors(q, r).map(([nq, nr]) => `${nq},${nr}`);
            for (const N of neighbors) {
                const edgeId = [H, N].sort().join('|');
                if (!edges[edgeId]) {
                    edges[edgeId] = { adjacentVertices: [], adjacentHexes: [H, N].sort() };
                }
            }
            for (let i = 0; i < 6; i++) {
                const N1 = neighbors[i];
                const N2 = neighbors[(i + 1) % 6];
                const vertexId = [H, N1, N2].sort().join('|');
                if (!vertices[vertexId]) {
                    vertices[vertexId] = { adjacentVertices: [], adjacentEdges: [], adjacentHexes: [H, N1, N2].sort() };
                }
            }
        }
    }
    Object.keys(vertices).forEach(vId => {
        const v = vertices[vId];
        const [h1, h2, h3] = v.adjacentHexes;
        const e1 = [h1, h2].sort().join('|');
        const e2 = [h2, h3].sort().join('|');
        const e3 = [h1, h3].sort().join('|');
        v.adjacentEdges.push(e1, e2, e3);
        if (edges[e1])
            edges[e1].adjacentVertices.push(vId);
        if (edges[e2])
            edges[e2].adjacentVertices.push(vId);
        if (edges[e3])
            edges[e3].adjacentVertices.push(vId);
    });
    Object.values(edges).forEach(e => {
        if (e.adjacentVertices.length === 2) {
            const v1 = e.adjacentVertices[0];
            const v2 = e.adjacentVertices[1];
            if (!vertices[v1].adjacentVertices.includes(v2))
                vertices[v1].adjacentVertices.push(v2);
            if (!vertices[v2].adjacentVertices.includes(v1))
                vertices[v2].adjacentVertices.push(v1);
        }
    });
    return { vertices, edges };
}
exports.boardGraph = createBoardGraph();
function generateBoard(rng) {
    const coords = [];
    const radius = 2;
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            coords.push({ q, r });
        }
    }
    const resources = (0, engine_core_1.shuffleArray)(STANDARD_RESOURCES, rng);
    const tokens = (0, engine_core_1.shuffleArray)(STANDARD_TOKENS, rng);
    let tokenIndex = 0;
    const hexes = coords.map((coord, i) => {
        const resource = resources[i];
        let numberToken = null;
        let hasRobber = false;
        if (resource === 'DESERT') {
            hasRobber = true;
        }
        else {
            numberToken = tokens[tokenIndex++];
        }
        return {
            id: `${coord.q},${coord.r}`,
            q: coord.q,
            r: coord.r,
            s: -coord.q - coord.r,
            resource,
            numberToken,
            hasRobber
        };
    });
    const vertices = {};
    for (const vId of Object.keys(exports.boardGraph.vertices)) {
        vertices[vId] = { id: vId, owner: null, building: null };
    }
    const edges = {};
    for (const eId of Object.keys(exports.boardGraph.edges)) {
        edges[eId] = { id: eId, owner: null, port: null };
    }
    // Generate Ports
    const portTypes = ['3:1', '3:1', '3:1', '3:1', 'WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    const shuffledPorts = (0, engine_core_1.shuffleArray)(portTypes, rng);
    // Find all outer edges
    const outerEdges = Object.keys(exports.boardGraph.edges).filter(eId => exports.boardGraph.edges[eId].adjacentHexes.length === 1);
    // Trace the perimeter to order the outer edges
    const perimeterEdges = [];
    if (outerEdges.length > 0) {
        let currentEdge = outerEdges[0];
        let currentVertex = exports.boardGraph.edges[currentEdge].adjacentVertices[0];
        for (let i = 0; i < outerEdges.length; i++) {
            perimeterEdges.push(currentEdge);
            const nextVertex = exports.boardGraph.edges[currentEdge].adjacentVertices.find(v => v !== currentVertex);
            // Find the next outer edge connected to nextVertex
            const nextEdge = exports.boardGraph.vertices[nextVertex].adjacentEdges.find(e => e !== currentEdge && exports.boardGraph.edges[e].adjacentHexes.length === 1);
            if (nextEdge) {
                currentEdge = nextEdge;
                currentVertex = nextVertex;
            }
        }
    }
    // Place ports on every other edge around the perimeter
    let portIndex = 0;
    for (let i = 0; i < perimeterEdges.length; i += 2) {
        if (portIndex < shuffledPorts.length) {
            edges[perimeterEdges[i]].port = shuffledPorts[portIndex++];
        }
    }
    return { hexes, vertices, edges };
}
