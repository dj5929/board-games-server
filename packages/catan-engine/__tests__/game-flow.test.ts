import { describe, it, expect } from 'vitest';
import { CatanEngine } from '../src/CatanEngine';
import { boardGraph } from '../src/board';
import { playerId, type PlayerId } from '@packages/engine-core';
import { DeterministicRNG } from '@packages/engine-core/test/helpers';
import type { ICatanAction, ICatanState } from '../src/types';

const RESOURCES = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };

function initMainTurn(ids: PlayerId[], rng: { next: () => number }): ICatanState {
  const state = CatanEngine.getInitialState(ids, rng);
  return {
    ...state,
    turnPhase: 'MAIN_TURN',
    placementStep: 'SETTLEMENT',
    placementIndex: 0,
    pendingRoadVertex: null
  };
}

function discardAction(pid: PlayerId, resources: Partial<typeof RESOURCES>): ICatanAction {
  return { type: 'DISCARD_RESOURCES', playerId: pid, resources: { ...RESOURCES, ...resources } };
}

function apply(state: any, action: ICatanAction, rng: { next: () => number }): any {
  const res = CatanEngine.reduce(state, action, rng);
  expect(res.success).toBe(true);
  if (!res.success) return state;
  return res.data.nextState;
}

function applyExpectFail(state: any, action: ICatanAction, rng: { next: () => number }, _error: string): { state: any; error: string | undefined } {
  const res = CatanEngine.reduce(state, action, rng);
  expect(res.success).toBe(false);
  return { state, error: res.success === false ? res.error : undefined };
}

function grantResources(state: any, pid: PlayerId, resources: Partial<typeof RESOURCES>): void {
  const p = state.players.find((pl: any) => pl.id === pid);
  p.resources = { ...p.resources, ...resources };
}

describe('CatanEngine - Base Game Flow', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('plays a full turn cycle across players', () => {
    const rng = new DeterministicRNG([0.5]); // rolls 4 + 4 = 8
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 });

    expect(state.hasRolled).toBe(false);

    // p1 rolls
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(state.hasRolled).toBe(true);
    expect(state.turnPhase).toBe('MAIN_TURN'); // non-7 roll does not change phase

    // p1 builds a settlement
    const vId = Object.keys(state.board.vertices)[0]!;
    state = apply(state, { type: 'BUILD_SETTLEMENT', playerId: p1, vertexId: vId }, rng);
    expect(state.board.vertices[vId]!.owner).toBe(p1);

    // p1 cannot roll twice
    applyExpectFail(state, { type: 'ROLL_DICE', playerId: p1 }, rng, 'Already rolled this turn');

    // p1 ends turn
    state = apply(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(state.hasRolled).toBe(false);
    expect(state.activePlayerId).toBe(p2);

    // p2 takes its turn
    state = apply(state, { type: 'ROLL_DICE', playerId: p2 }, rng);
    expect(state.activePlayerId).toBe(p2);

    // p2 cannot roll before p2's turn next round, but can end turn now
    state = apply(state, { type: 'END_TURN', playerId: p2 }, rng);
    expect(state.activePlayerId).toBe(p3);
    expect(state.turnPhase).toBe('MAIN_TURN');

    // p3 takes its turn and the cycle returns to p1
    state = apply(state, { type: 'ROLL_DICE', playerId: p3 }, rng);
    expect(state.activePlayerId).toBe(p3);
    state = apply(state, { type: 'END_TURN', playerId: p3 }, rng);
    expect(state.activePlayerId).toBe(p1);
    expect(state.turnPhase).toBe('MAIN_TURN');
  });

  it('ends the game at 10 victory points for the active player', () => {
    const rng = new DeterministicRNG([0.5]); // rolls 8
    let state = initMainTurn([p1, p2, p3], rng);

    // Give p1 five cities = 10 points
    const vIds = Object.keys(state.board.vertices).slice(0, 5);
    vIds.forEach(vId => {
      (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: p1, building: 'CITY' };
    });

    const res = CatanEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.status).toBe('FINISHED');
    expect(res.data.nextState.winner).toBe(p1);
    expect(res.data.events.some(e => e.type === 'GAME_OVER')).toBe(true);

    // No further actions allowed once finished
    expect(CatanEngine.isValidAction(res.data.nextState, { type: 'ROLL_DICE', playerId: p1 })).toBe(false);
  });

  it('only requires discard from players holding more than 7 cards on a 7 roll', () => {
    const rng = new DeterministicRNG([0.34, 0.51]); // 3 + 4 = 7
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 5 });
    grantResources(state, p2, { WOOD: 8 });

    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(state.turnPhase).toBe('DISCARD_PHASE');
    expect(state.pendingDiscards[p1]).toBeUndefined();
    expect(state.pendingDiscards[p2]).toBe(4);

    // The player that does not need to discard is rejected
    const fail = CatanEngine.reduce(state, discardAction(p1, { WOOD: 4 }), rng);
    expect(fail.success).toBe(false);
    if (!fail.success) expect(fail.error).toBe('You do not need to discard');

    // Wrong discard amount is rejected
    const wrongAmount = CatanEngine.reduce(state, discardAction(p2, { WOOD: 5 }), rng);
    expect(wrongAmount.success).toBe(false);
    if (!wrongAmount.success) expect(wrongAmount.error).toBe('Must discard exactly 4 resources');

    // Correct discard moves into robber placement
    state = apply(state, discardAction(p2, { WOOD: 4 }), rng);
    expect(state.players[1]!.resources.WOOD).toBe(4);
    expect(state.turnPhase).toBe('ROBBER_PLACEMENT');
  });

  it('discard fails when a player tries to discard resources they do not have', () => {
    const rng = new DeterministicRNG([0.34, 0.51]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 8 });

    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(state.turnPhase).toBe('DISCARD_PHASE');

    const res = CatanEngine.reduce(state, { type: 'DISCARD_RESOURCES', playerId: p1, resources: { WOOD: 1, BRICK: 3, SHEEP: 0, WHEAT: 0, ORE: 0 } }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('Not enough BRICK to discard');
  });

  it('goes straight to robber placement when nobody must discard on a 7', () => {
    const rng = new DeterministicRNG([0.34, 0.51]);
    let state = initMainTurn([p1, p2, p3], rng);
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(state.turnPhase).toBe('ROBBER_PLACEMENT');
  });
});

describe('CatanEngine - Robber Edge Cases', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('guards every MOVE_ROBBER failure path', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    const desert = state.board.hexes.find((h: any) => h.resource === 'DESERT')!;
    const plainHex = state.board.hexes.find((h: any) => h.resource !== 'DESERT')!;

    // Not in robber placement phase
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: plainHex.id }, rng, 'Not in robber placement phase');

    (state as any).turnPhase = 'ROBBER_PLACEMENT';

    // Invalid hex
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: '99,99' }, rng, 'Invalid hex');

    // Robber must move to a new hex
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: desert.id }, rng, 'Robber must move to a new hex');

    // Cannot steal from self
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: plainHex.id, targetPlayerId: p1 }, rng, 'Cannot steal from yourself');

    // Invalid victim
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: plainHex.id, targetPlayerId: playerId('ghost') }, rng, 'Invalid victim');

    // Victim must be adjacent to the hex
    applyExpectFail(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: plainHex.id, targetPlayerId: p2 }, rng, 'Victim is not adjacent to hex');
  });

  it('moves the robber without stealing when the victim has no resources', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);

    // Place p2 settlement adjacent to a target hex
    const targetHex = state.board.hexes.find((h: any) => h.resource !== 'DESERT')!;
    const vId = Object.keys(boardGraph.vertices).find(v => boardGraph.vertices[v]!.adjacentHexes.includes(targetHex.id))!;
    (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: p2, building: 'SETTLEMENT' };
    grantResources(state, p2, { WOOD: 0 });

    (state as any).turnPhase = 'ROBBER_PLACEMENT';

    const res = CatanEngine.reduce(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: targetHex.id, targetPlayerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const next = res.data.nextState;
    expect(next.board.hexes.find((h: any) => h.id === targetHex.id)!.hasRobber).toBe(true);
    expect(next.turnPhase).toBe('MAIN_TURN');
    expect(res.data.events.some(e => e.type === 'STOLEN_RESOURCE')).toBe(false);
  });
});

describe('CatanEngine - Building & Economy Edge Cases', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('requires a connected road to build settlements once the player has roads', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10 });

    // p1 owns a road somewhere on the board
    const farEdge = Object.keys(state.board.edges)[20]!;
    (state as any).board.edges[farEdge] = { ...state.board.edges[farEdge], owner: p1 };

    // Attempt to settle on a vertex that is not connected to that road
    const vId = Object.keys(state.board.vertices).find(v => !boardGraph.vertices[v]!.adjacentEdges.includes(farEdge))!;
    applyExpectFail(state, { type: 'BUILD_SETTLEMENT', playerId: p1, vertexId: vId }, rng, 'Must build connected to a road');
  });

  it('requires a connected road or settlement to build roads once the player has buildings', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 10, BRICK: 10 });

    // p1 has a settlement but no roads
    const vId = Object.keys(state.board.vertices)[0]!;
    (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: p1, building: 'SETTLEMENT' };

    const farEdge = Object.keys(state.board.edges).find(e => !boardGraph.edges[e]!.adjacentVertices.includes(vId))!;
    applyExpectFail(state, { type: 'BUILD_ROAD', playerId: p1, edgeId: farEdge }, rng, 'Must build connected to a road or settlement');
  });

  it('guards TRADE_BANK against invalid inputs', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 10 });

    applyExpectFail(state, { type: 'TRADE_BANK', playerId: p1, offerResource: 'WOOD', requestResource: 'BRICK', amount: 0 }, rng, 'Invalid amount');
    applyExpectFail(state, { type: 'TRADE_BANK', playerId: p1, offerResource: 'WOOD', requestResource: 'BRICK', amount: -1 }, rng, 'Invalid amount');
    applyExpectFail(state, { type: 'TRADE_BANK', playerId: p1, offerResource: 'DESERT', requestResource: 'BRICK', amount: 1 }, rng, 'Cannot trade desert');
    applyExpectFail(state, { type: 'TRADE_BANK', playerId: p1, offerResource: 'WOOD', requestResource: 'DESERT', amount: 1 }, rng, 'Cannot trade desert');

    // Not enough resources for 4:1
    grantResources(state, p1, { WOOD: 2, BRICK: 0 });
    applyExpectFail(state, { type: 'TRADE_BANK', playerId: p1, offerResource: 'WOOD', requestResource: 'BRICK', amount: 1 }, rng, 'Not enough resources');
  });
});

describe('CatanEngine - Trading Actions', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');
  const zero = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };

  it('proposes a player trade', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1 });

    // Cannot trade with yourself
    applyExpectFail(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p1, offer: { ...zero, WOOD: 1 }, request: { ...zero } }, rng, 'Cannot trade with yourself');

    // Cannot offer more than owned
    applyExpectFail(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { ...zero, WOOD: 5 }, request: { ...zero } }, rng, 'Not enough WOOD');

    const res = CatanEngine.reduce(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { ...zero, WOOD: 1 }, request: { ...zero, ORE: 1 } }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.activeTrade).not.toBeNull();
    expect(res.data.nextState.activeTrade!.fromPlayerId).toBe(p1);
    expect(res.data.nextState.activeTrade!.toPlayerId).toBe(p2);
  });

  it('accepts a trade and exchanges resources', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1 });
    grantResources(state, p2, { ORE: 1 });

    // No active trade
    applyExpectFail(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng, 'No active trade');

    state = apply(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { ...zero, WOOD: 1 }, request: { ...zero, ORE: 1 } }, rng);

    // Only the recipient may accept
    applyExpectFail(state, { type: 'ACCEPT_TRADE', playerId: p1 }, rng, 'Not the recipient');

    // Proposer must still have the offered resources
    grantResources(state, p1, { WOOD: 0 });
    applyExpectFail(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng, 'Proposer does not have enough WOOD');
    grantResources(state, p1, { WOOD: 1 });

    // Recipient must have the requested resources
    grantResources(state, p2, { ORE: 0 });
    applyExpectFail(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng, 'You do not have enough ORE');
    grantResources(state, p2, { ORE: 1 });

    const res = CatanEngine.reduce(state, { type: 'ACCEPT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.players[0]!.resources.ORE).toBe(1);
    expect(res.data.nextState.players[1]!.resources.WOOD).toBe(1);
    expect(res.data.nextState.activeTrade).toBeNull();
    expect(res.data.events.some(e => e.type === 'TRADE_ACCEPTED')).toBe(true);
  });

  it('rejects a player trade', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1 });

    applyExpectFail(state, { type: 'REJECT_TRADE', playerId: p2 }, rng, 'No active trade');

    state = apply(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { ...zero, WOOD: 1 }, request: { ...zero } }, rng);

    // Proposer is not the recipient
    applyExpectFail(state, { type: 'REJECT_TRADE', playerId: p1 }, rng, 'Not the recipient');

    const res = CatanEngine.reduce(state, { type: 'REJECT_TRADE', playerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.activeTrade).toBeNull();
    expect(res.data.events.some(e => e.type === 'TRADE_REJECTED')).toBe(true);
  });

  it('cancels a player trade', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1 });

    state = apply(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { ...zero, WOOD: 1 }, request: { ...zero } }, rng);

    // Only the proposer can cancel
    applyExpectFail(state, { type: 'CANCEL_TRADE', playerId: p2 }, rng, 'Not the proposer');

    const res = CatanEngine.reduce(state, { type: 'CANCEL_TRADE', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.activeTrade).toBeNull();
    expect(res.data.events.some(e => e.type === 'TRADE_CANCELLED')).toBe(true);
  });
});

describe('CatanEngine - Development Cards', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('buys a development card and deducts the cost', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { ORE: 1, WHEAT: 1, SHEEP: 1 });

    const deckSize = state.devCardDeck.length;
    const res = CatanEngine.reduce(state, { type: 'BUY_DEV_CARD', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const next = res.data.nextState;
    expect(next.players[0]!.resources.ORE).toBe(0);
    expect(next.players[0]!.resources.WHEAT).toBe(0);
    expect(next.players[0]!.resources.SHEEP).toBe(0);
    expect(next.devCardDeck.length).toBe(deckSize - 1);
    expect(next.players[0]!.developmentCards).toHaveLength(1);
    expect(next.players[0]!.developmentCards[0]!.boughtThisTurn).toBe(true);
    expect(res.data.events.some(e => e.type === 'DEV_CARD_BOUGHT')).toBe(true);
  });

  it('fails to buy a development card without resources or when the deck is empty', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);

    applyExpectFail(state, { type: 'BUY_DEV_CARD', playerId: p1 }, rng, 'Not enough resources');

    grantResources(state, p1, { ORE: 1, WHEAT: 1, SHEEP: 1 });
    (state as any).devCardDeck = [];
    applyExpectFail(state, { type: 'BUY_DEV_CARD', playerId: p1 }, rng, 'Development card deck is empty');
  });

  it('plays a Knight card: moves robber and steals a resource', () => {
    const rng = new DeterministicRNG([0]); // steal index 0
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'k1', type: 'KNIGHT', boughtThisTurn: false }];

    const targetHex = state.board.hexes.find((h: any) => h.resource !== 'DESERT')!;
    const vId = Object.keys(boardGraph.vertices).find(v => boardGraph.vertices[v]!.adjacentHexes.includes(targetHex.id))!;
    (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: p2, building: 'SETTLEMENT' };
    grantResources(state, p2, { WOOD: 1 });

    const res = CatanEngine.reduce(state, { type: 'PLAY_KNIGHT', playerId: p1, hexId: targetHex.id, targetPlayerId: p2 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const next = res.data.nextState;
    expect(next.players[0]!.developmentCards).toHaveLength(0);
    expect(next.players[0]!.playedDevelopmentCards).toContain('KNIGHT');
    expect(next.playedDevCardThisTurn).toBe(true);
    expect(next.board.hexes.find((h: any) => h.id === targetHex.id)!.hasRobber).toBe(true);
    expect(next.players[1]!.resources.WOOD).toBe(0);
    expect(next.players[0]!.resources.WOOD).toBe(1);
    expect(res.data.events.some(e => e.type === 'STOLEN_RESOURCE' && e.resource === 'WOOD')).toBe(true);
  });

  it('plays a Monopoly card and takes all matching resources from other players', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'm1', type: 'MONOPOLY', boughtThisTurn: false }];
    grantResources(state, p2, { ORE: 5 });

    const res = CatanEngine.reduce(state, { type: 'PLAY_MONOPOLY', playerId: p1, resource: 'ORE' }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const next = res.data.nextState;
    expect(next.players[0]!.resources.ORE).toBe(5);
    expect(next.players[1]!.resources.ORE).toBe(0);
    expect(next.playedDevCardThisTurn).toBe(true);
  });

  it('plays a Road Building card and places two roads', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'rb1', type: 'ROAD_BUILDING', boughtThisTurn: false }];

    const eIds = Object.keys(state.board.edges).slice(0, 2);
    const res = CatanEngine.reduce(state, { type: 'PLAY_ROAD_BUILDING', playerId: p1, edgeId1: eIds[0]!, edgeId2: eIds[1]! }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const next = res.data.nextState;
    expect(next.board.edges[eIds[0]!]!.owner).toBe(p1);
    expect(next.board.edges[eIds[1]!]!.owner).toBe(p1);
    const roadEvents = res.data.events.filter(e => e.type === 'ROAD_BUILT');
    expect(roadEvents).toHaveLength(2);
    expect(res.data.events.some(e => e.type === 'DEV_CARD_PLAYED' && e.cardType === 'ROAD_BUILDING')).toBe(true);
  });

  it('rejects a Road Building card that would exceed the 15-road limit', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'rb1', type: 'ROAD_BUILDING', boughtThisTurn: false }];

    const eIds = Object.keys(state.board.edges).slice(0, 16);
    eIds.slice(0, 15).forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: p1 };
    });

    applyExpectFail(state, { type: 'PLAY_ROAD_BUILDING', playerId: p1, edgeId1: eIds[15]! }, rng, 'Maximum roads reached');
  });

  it('rejects a first Road Building road that is not connected to the network (CRITICAL-4)', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'rb1', type: 'ROAD_BUILDING', boughtThisTurn: false }];

    // Give p1 a single settlement so they have a "network" to connect to
    const eIds = Object.keys(state.board.edges);
    const vertexId = Object.keys(boardGraph.vertices).find(vId =>
      boardGraph.vertices[vId]!.adjacentEdges.some(eId => eIds.includes(eId))
    )!;
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: p1, building: 'SETTLEMENT' };

    // Pick an edge that is far from p1's settlement (not adjacent to any of its adjacent edges)
    const adjacentEdgeIds = boardGraph.vertices[vertexId]!.adjacentEdges;
    const disconnectedEdge = eIds.find(eId => !adjacentEdgeIds.includes(eId))!;

    applyExpectFail(state, { type: 'PLAY_ROAD_BUILDING', playerId: p1, edgeId1: disconnectedEdge }, rng, 'First road must connect to your network');
  });

  it('allows a second Road Building road connected only to the first road (CRITICAL-4)', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'rb1', type: 'ROAD_BUILDING', boughtThisTurn: false }];

    // Give p1 a single settlement to establish a network
    const eIds = Object.keys(state.board.edges);
    const vertexId = Object.keys(boardGraph.vertices).find(vId =>
      boardGraph.vertices[vId]!.adjacentEdges.some(eId => eIds.includes(eId))
    )!;
    (state as any).board.vertices[vertexId] = { ...state.board.vertices[vertexId], owner: p1, building: 'SETTLEMENT' };

    // First road: an edge adjacent to the settlement
    const firstEdgeId = boardGraph.vertices[vertexId]!.adjacentEdges[0]!;
    // Second road: an edge adjacent to the first road's other vertex, so it only
    // connects via the just-placed first road
    const firstEdge = boardGraph.edges[firstEdgeId]!;
    const otherVertexId = firstEdge.adjacentVertices.find(v => v !== vertexId)!;
    const secondEdgeId = boardGraph.vertices[otherVertexId]!.adjacentEdges.find(eId => eId !== firstEdgeId)!;

    const res = CatanEngine.reduce(state, { type: 'PLAY_ROAD_BUILDING', playerId: p1, edgeId1: firstEdgeId, edgeId2: secondEdgeId }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.nextState.board.edges[firstEdgeId]!.owner).toBe(p1);
    expect(res.data.nextState.board.edges[secondEdgeId]!.owner).toBe(p1);
  });

});

describe('CatanEngine - Turn Management Edge Cases', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('resets dev card boughtThisTurn and cancels active trades on END_TURN', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    grantResources(state, p1, { WOOD: 1 });

    (state as any).players[0].developmentCards = [{ id: 'k1', type: 'KNIGHT', boughtThisTurn: true }];
    (state as any).hasRolled = true;

    // Set up an active trade
    state = apply(state, { type: 'PROPOSE_TRADE', playerId: p1, toPlayerId: p2, offer: { WOOD: 1, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 }, request: { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 } }, rng);
    expect(state.activeTrade).not.toBeNull();

    const endRes = CatanEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(endRes.success).toBe(true);
    if (!endRes.success) return;

    const next = endRes.data.nextState;
    expect(next.activeTrade).toBeNull();
    expect(next.players[0]!.developmentCards[0]!.boughtThisTurn).toBe(false);
    expect(endRes.data.events.some(e => e.type === 'TRADE_CANCELLED')).toBe(true);
  });

  it('returns an error when the active player is not part of the game', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);
    (state as any).activePlayerId = playerId('ghost');

    const res = CatanEngine.reduce(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe('Invalid active player');
  });
});

describe('CatanEngine - Longest Road Edge Cases', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  function edgesAroundHex(hexId: string): string[] {
    return Object.keys(boardGraph.edges).filter(eId => boardGraph.edges[eId]!.adjacentHexes.includes(hexId));
  }

  it('awards nobody the Longest Road when two players tie at 5 roads', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);

    // p1 takes a 5-edge path around the center hex, excluding the shared edge
    // so both networks stay disjoint.
    const p1Edges = edgesAroundHex('0,0').filter(eId => eId !== '0,0|0,1');
    const p2Edges = edgesAroundHex('0,1').slice(0, 5);

    p1Edges.forEach(eId => { (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: p1 }; });
    p2Edges.forEach(eId => { (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: p2 }; });

    (state as any).hasRolled = true;
    const res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.longestRoadOwner).toBeNull();
    expect(res.data.events.some(e => e.type === 'LONGEST_ROAD_AWARDED')).toBe(false);
  });

  it('does not count roads past an opposing settlement', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);

    const hexEdges = edgesAroundHex('0,0'); // 6 edges forming a cycle
    hexEdges.forEach(eId => {
      (state as any).board.edges[eId] = { ...state.board.edges[eId], owner: p1 };
    });

    // Block both endpoints of one cycle edge with p2's settlements. The cycle
    // breaks into a run of at most 4 roads (roads leading into a block still
    // count, so a single block only trims the 6-cycle to a 5-edge arc).
    const shareId = hexEdges[0]!;
    const blockedVertices = boardGraph.edges[shareId]!.adjacentVertices;
    blockedVertices.forEach(vId => {
      (state as any).board.vertices[vId] = { ...state.board.vertices[vId], owner: p2, building: 'SETTLEMENT' };
    });

    (state as any).hasRolled = true;
    const res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.nextState.longestRoadOwner).toBeNull();
    expect(res.data.nextState.longestRoadLength).toBe(4);
  });
});

describe('CatanEngine - isValidAction Coverage', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');

  it('validates the full action set', () => {
    const rng = new DeterministicRNG([0.5]);
    let state = initMainTurn([p1, p2, p3], rng);

    // Base turn
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p1 })).toBe(true);
    expect(CatanEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(false); // not rolled
    expect(CatanEngine.isValidAction(state, { type: 'ROLL_DICE', playerId: p2 })).toBe(false); // not active

    // MOVE_ROBBER only during robber placement
    expect(CatanEngine.isValidAction(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: '0,1' })).toBe(false);
    (state as any).turnPhase = 'ROBBER_PLACEMENT';
    expect(CatanEngine.isValidAction(state, { type: 'MOVE_ROBBER', playerId: p1, hexId: '0,1' })).toBe(true);
    (state as any).turnPhase = 'MAIN_TURN';

    // DISCARD only for players with pending discard
    expect(CatanEngine.isValidAction(state, discardAction(p1, {}))).toBe(false);
    (state as any).pendingDiscards[p1] = 2;
    expect(CatanEngine.isValidAction(state, discardAction(p1, {}))).toBe(true);

    // ACCEPT/REJECT requires an active trade with the recipient
    expect(CatanEngine.isValidAction(state, { type: 'ACCEPT_TRADE', playerId: p2 })).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'REJECT_TRADE', playerId: p2 })).toBe(false);

    // Dev cards only during main turn and once per turn
    (state as any).playedDevCardThisTurn = true;
    expect(CatanEngine.isValidAction(state, { type: 'PLAY_KNIGHT', playerId: p1, hexId: '0,1' })).toBe(false);
    expect(CatanEngine.isValidAction(state, { type: 'PLAY_MONOPOLY', playerId: p1, resource: 'WOOD' })).toBe(false);

    // After rolling, END_TURN becomes valid
    state = apply(state, { type: 'ROLL_DICE', playerId: p1 }, rng);
    expect(CatanEngine.isValidAction(state, { type: 'END_TURN', playerId: p1 })).toBe(true);
  });
});

describe('CatanEngine - Player Count Validation', () => {
  const rng = new DeterministicRNG([0.5]);

  it('rejects fewer than 3 players', () => {
    expect(() => CatanEngine.getInitialState([playerId('p1'), playerId('p2')], rng)).toThrow('Catan requires 3 to 4 players.');
  });

  it('rejects more than 4 players', () => {
    const many = Array.from({ length: 5 }, (_, i) => playerId(`p${i + 1}`));
    expect(() => CatanEngine.getInitialState(many, rng)).toThrow('Catan requires 3 to 4 players.');
  });

  it('accepts 3 and 4 players', () => {
    expect(CatanEngine.getInitialState([playerId('p1'), playerId('p2'), playerId('p3')], rng).players).toHaveLength(3);
    const four = Array.from({ length: 4 }, (_, i) => playerId(`p${i + 1}`));
    expect(CatanEngine.getInitialState(four, rng).players).toHaveLength(4);
  });
});

describe('CatanEngine - Per-Player State Projection (CRITICAL-2/3)', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');
  const rng = new DeterministicRNG([0.5]);

  it('keeps the full state for the requesting player', () => {
    const state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'k1', type: 'KNIGHT', boughtThisTurn: false }];
    const projected = CatanEngine.getStateForPlayer!(state, p1);
    expect(projected.players[0]!.developmentCards[0]!.id).toBe('k1');
  });

  it('hides other players development card details', () => {
    const state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[1].developmentCards = [{ id: 'vp1', type: 'VICTORY_POINT', boughtThisTurn: false }];
    const projected = CatanEngine.getStateForPlayer!(state, p1);
    const opp = projected.players[1]!;
    expect(opp.developmentCards).toHaveLength(1);
    expect(opp.developmentCards[0]!.id).toBe('HIDDEN');
    expect(opp.developmentCards[0]!.type).not.toBe('VICTORY_POINT');
    // victory points must not be inflated by hidden card types
    expect(opp.victoryPoints).toBe(state.players[1]!.victoryPoints);
  });

  it('does not expose the ordered dev card deck to any player', () => {
    const state = initMainTurn([p1, p2, p3], rng);
    const projected = CatanEngine.getStateForPlayer!(state, p1);
    expect(projected.devCardDeck).toHaveLength(state.devCardDeck.length);
    expect(projected.devCardDeck).not.toEqual(state.devCardDeck);
    expect(projected.devCardDeck.every(c => c === 'HIDDEN' as unknown as typeof state.devCardDeck[number])).toBe(true);
  });
});

describe('CatanEngine - END_TURN Dev-Card Immutability (LOW-10)', () => {
  const p1 = playerId('p1');
  const p2 = playerId('p2');
  const p3 = playerId('p3');
  const rng = new DeterministicRNG([0.5]);

  it('does not mutate the card object referenced by the previous state', () => {
    const state = initMainTurn([p1, p2, p3], rng);
    (state as any).players[0].developmentCards = [{ id: 'k1', type: 'KNIGHT', boughtThisTurn: true }];
    (state as any).hasRolled = true;

    const res = CatanEngine.reduce(state, { type: 'END_TURN', playerId: p1 }, rng);
    expect(res.success).toBe(true);
    if (!res.success) return;

    // The previous (frozen) state's card must remain untouched
    expect(state.players[0]!.developmentCards[0]!.boughtThisTurn).toBe(true);
    // The new state's cloned card is reset
    expect(res.data.nextState.players[0]!.developmentCards[0]!.boughtThisTurn).toBe(false);
  });
});