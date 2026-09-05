import { describe, expect, it } from 'vitest';
import { playerId } from '@packages/engine-core';
import type { CatanPlayer, ICatanAction, ICatanState } from '@packages/catan-engine';
import { boardGraph, CatanEngine } from '@packages/catan-engine';
import { CatanBot } from '../src/CatanBot';

const bot = new CatanBot();
const P1 = playerId('p1');
const P2 = playerId('p2');
const P3 = playerId('p3');

function makeRng() {
  let i = 0;
  const values = [0.1, 0.4];
  return { next: () => values[i++ % values.length]! };
}

function makePlayer(id: string, patch: Partial<CatanPlayer> = {}): CatanPlayer {
  return {
    id: playerId(id),
    color: '#fff',
    resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 },
    victoryPoints: 0,
    developmentCards: [],
    playedDevelopmentCards: [],
    ...patch,
  };
}

function makeState(players: CatanPlayer[], patch: Partial<ICatanState> = {}): ICatanState {
  const base = CatanEngine.getInitialState([P1, P2, P3], makeRng());
  return {
    ...base,
    players,
    activePlayerId: P1,
    ...patch,
  };
}

/** p1 is the acting player; returns the action the bot chooses. */
function decideFor(state: ICatanState, player = 'p1'): ICatanAction {
  return bot.decide(state, player, CatanEngine as any);
}

/** Mirrors the engine distance rule for test assertions. */
function isLegalVertex(state: ICatanState, vId: string): boolean {
  const v = state.board.vertices[vId];
  if (!v || v.building) return false;
  const graph = boardGraph.vertices[vId];
  if (!graph) return false;
  return !graph.adjacentVertices.some(adj => state.board.vertices[adj]?.building);
}

function isAdjacentToOwner(state: ICatanState, hexId: string, ownerId: string): boolean {
  return Object.keys(boardGraph.vertices).some(
    vId => boardGraph.vertices[vId]!.adjacentHexes.includes(hexId) && state.board.vertices[vId]?.owner === playerId(ownerId)
  );
}

describe('CatanBot', () => {
  it('rolls the dice at the start of its main turn', () => {
    const state = makeState(
      [makePlayer('p1'), makePlayer('p2', { victoryPoints: 2 }), makePlayer('p3', { victoryPoints: 3 })],
      { turnPhase: 'MAIN_TURN', hasRolled: false }
    );
    expect(decideFor(state)).toEqual({ type: 'ROLL_DICE', playerId: P1 });
  });

  it('upgrades a settlement to a city when it can afford it', () => {
    const base = makeState([makePlayer('p1', { resources: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 2, ORE: 3 } })], {
      turnPhase: 'MAIN_TURN',
      hasRolled: true,
    });
    const cityVId = Object.keys(base.board.vertices)[0]!;
    const state: ICatanState = {
      ...base,
      board: {
        ...base.board,
        vertices: {
          ...base.board.vertices,
          [cityVId]: { ...base.board.vertices[cityVId]!, owner: P1, building: 'SETTLEMENT' },
        },
      },
    };
    const action = decideFor(state);
    expect(action.type).toBe('UPGRADE_CITY');
    if (action.type === 'UPGRADE_CITY') {
      expect(state.board.vertices[action.vertexId]?.owner).toBe(P1);
      expect(state.board.vertices[action.vertexId]?.building).toBe('SETTLEMENT');
    }
  });

  it('builds a settlement connected to its own road when affordable', () => {
    const base = makeState([makePlayer('p1', { resources: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1, ORE: 0 } })], {
      turnPhase: 'MAIN_TURN',
      hasRolled: true,
    });
    const roadEdgeId = Object.keys(base.board.edges)[0]!;
    const state: ICatanState = {
      ...base,
      board: {
        ...base.board,
        edges: { ...base.board.edges, [roadEdgeId]: { ...base.board.edges[roadEdgeId]!, owner: P1 } },
      },
    };
    const action = decideFor(state);
    expect(action.type).toBe('BUILD_SETTLEMENT');
    if (action.type === 'BUILD_SETTLEMENT') {
      const vId = action.vertexId;
      expect(isLegalVertex(state, vId)).toBe(true);
      expect(boardGraph.vertices[vId]!.adjacentEdges.some(eId => state.board.edges[eId]?.owner === P1)).toBe(true);
    }
  });

  it('ends the turn when nothing is affordable after rolling', () => {
    const state = makeState([makePlayer('p1')], { turnPhase: 'MAIN_TURN', hasRolled: true });
    expect(decideFor(state)).toEqual({ type: 'END_TURN', playerId: P1 });
  });

  it('buys a development card when it can afford one and has nothing to build', () => {
    const state = makeState(
      [makePlayer('p1', { resources: { WOOD: 0, BRICK: 0, SHEEP: 1, WHEAT: 1, ORE: 1 } })],
      { turnPhase: 'MAIN_TURN', hasRolled: true }
    );
    expect(decideFor(state)).toEqual({ type: 'BUY_DEV_CARD', playerId: P1 });
  });

  it('plays a Knight card (bought on a previous turn)', () => {
    const state = makeState(
      [
        makePlayer('p1', {
          developmentCards: [{ id: 'k1', type: 'KNIGHT', boughtThisTurn: false }],
        }),
      ],
      { turnPhase: 'MAIN_TURN', hasRolled: true, playedDevCardThisTurn: false }
    );
    const action = decideFor(state);
    expect(action.type).toBe('PLAY_KNIGHT');
    if (action.type === 'PLAY_KNIGHT') {
      expect(action.hexId).not.toBe(state.board.hexes.find(h => h.hasRobber)!.id);
    }
  });

  it('trades with the bank when it is short exactly one resource for a build', () => {
    const state = makeState(
      [makePlayer('p1', { resources: { WOOD: 4, BRICK: 0, SHEEP: 1, WHEAT: 1, ORE: 0 } })],
      { turnPhase: 'MAIN_TURN', hasRolled: true }
    );
    expect(decideFor(state)).toEqual({
      type: 'TRADE_BANK',
      playerId: P1,
      offerResource: 'WOOD',
      requestResource: 'BRICK',
      amount: 1,
    });
  });

  it('places its first settlement on a legal vertex', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')]);
    const action = decideFor(state);
    expect(action.type).toBe('PLACE_INITIAL_SETTLEMENT');
    if (action.type === 'PLACE_INITIAL_SETTLEMENT') {
      expect(isLegalVertex(state, action.vertexId)).toBe(true);
    }
  });

  it('honors the distance rule for its second settlement', () => {
    const base = makeState([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')]);
    const occupiedVId = Object.keys(base.board.vertices)[10]!;
    const state: ICatanState = {
      ...base,
      turnPhase: 'INITIAL_PLACEMENT_2',
      activePlayerId: P2,
      board: {
        ...base.board,
        vertices: {
          ...base.board.vertices,
          [occupiedVId]: { ...base.board.vertices[occupiedVId]!, owner: P2, building: 'SETTLEMENT' },
        },
      },
    };
    const action = decideFor(state, 'p2');
    expect(action.type).toBe('PLACE_INITIAL_SETTLEMENT');
    if (action.type === 'PLACE_INITIAL_SETTLEMENT') {
      expect(action.vertexId).not.toBe(occupiedVId);
      expect(isLegalVertex(state, action.vertexId)).toBe(true);
      expect(boardGraph.vertices[action.vertexId]!.adjacentVertices).not.toContain(occupiedVId);
    }
  });

  it('places a road touching its pending settlement', () => {
    const base = makeState([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')]);
    const anchorVId = Object.keys(base.board.vertices)[5]!;
    const state: ICatanState = {
      ...base,
      placementStep: 'ROAD',
      pendingRoadVertex: anchorVId,
    };
    const action = decideFor(state);
    expect(action.type).toBe('PLACE_INITIAL_ROAD');
    if (action.type === 'PLACE_INITIAL_ROAD') {
      expect(boardGraph.vertices[anchorVId]!.adjacentEdges).toContain(action.edgeId);
      expect(state.board.edges[action.edgeId]?.owner).toBeNull();
    }
  });

  it('discards the exact required count, most abundant resources first', () => {
    const state = makeState(
      [
        makePlayer('p1', { resources: { WOOD: 4, BRICK: 4, SHEEP: 2, WHEAT: 1, ORE: 1 } }),
        makePlayer('p2'),
        makePlayer('p3'),
      ],
      { turnPhase: 'DISCARD_PHASE', pendingDiscards: { [P1]: 5 } }
    );
    const action = decideFor(state);
    expect(action.type).toBe('DISCARD_RESOURCES');
    if (action.type === 'DISCARD_RESOURCES') {
      const total = Object.values(action.resources).reduce((s, n) => s + n, 0);
      expect(total).toBe(5);
      expect(action.resources.WOOD).toBe(4);
      expect(action.resources.BRICK).toBe(1);
    }
  });

  it('moves the robber and robs the victory-point leader when adjacent', () => {
    const base = makeState([
      makePlayer('p1'),
      makePlayer('p2', { victoryPoints: 3 }),
      makePlayer('p3', { victoryPoints: 6, resources: { WOOD: 2, BRICK: 2, SHEEP: 0, WHEAT: 0, ORE: 0 } }),
    ]);
    const targetVId = Object.keys(base.board.vertices)[0]!;
    const state: ICatanState = {
      ...base,
      turnPhase: 'ROBBER_PLACEMENT',
      board: {
        ...base.board,
        vertices: {
          ...base.board.vertices,
          [targetVId]: { ...base.board.vertices[targetVId]!, owner: P3, building: 'SETTLEMENT' },
        },
      },
    };
    const robberHex = state.board.hexes.find(h => h.hasRobber)!.id;
    const action = decideFor(state);
    expect(action.type).toBe('MOVE_ROBBER');
    if (action.type === 'MOVE_ROBBER') {
      expect(action.targetPlayerId).toBe(P3);
      expect(action.hexId).not.toBe(robberHex);
      expect(isAdjacentToOwner(state, action.hexId, 'p3')).toBe(true);
    }
  });

  it('accepts a clearly favorable trade offer', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')], {
      activeTrade: {
        id: 't1',
        fromPlayerId: P2,
        toPlayerId: P1,
        offer: { WOOD: 2, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 },
        request: { WOOD: 0, BRICK: 1, SHEEP: 0, WHEAT: 0, ORE: 0 },
      },
    });
    expect(decideFor(state)).toEqual({ type: 'ACCEPT_TRADE', playerId: P1 });
  });

  it('rejects an unfavorable trade offer', () => {
    const state = makeState([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')], {
      activeTrade: {
        id: 't1',
        fromPlayerId: P2,
        toPlayerId: P1,
        offer: { WOOD: 1, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 },
        request: { WOOD: 0, BRICK: 1, SHEEP: 1, WHEAT: 0, ORE: 0 },
      },
    });
    expect(decideFor(state)).toEqual({ type: 'REJECT_TRADE', playerId: P1 });
  });
});