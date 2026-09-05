import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/server';
import { roomManager } from '../src/RoomManager';

const app = buildApp(false);
let baseWsUrl = '';

const liveSockets = new Set<WebSocket>();

afterEach(() => {
  for (const ws of liveSockets) {
    if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
  }
  liveSockets.clear();
});

beforeAll(async () => {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as AddressInfo;
  baseWsUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

function waitUntil(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      if (cond()) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error('Timed out waiting for condition'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function createRoom(payload: { gameType?: string; playerCount?: number; hotSeat?: boolean; bots?: string[] } = {}) {
  const res = await app.inject({ method: 'POST', url: '/rooms', payload });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    roomId: string;
    playerIds: string[];
    gameType: string;
    playerId: string;
    sessionToken: string;
    isHotSeat?: boolean;
  };
}

function openSocket(url: string) {
  const messages: string[] = [];
  const ws = new WebSocket(url);
  liveSockets.add(ws);
  ws.on('message', (raw: string | Buffer | ArrayBuffer | Buffer[]) => messages.push(raw.toString()));
  ws.on('error', () => {});
  ws.on('close', () => liveSockets.delete(ws));
  return { ws, messages };
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('close', () => reject(new Error('connection closed before opening')));
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on('close', (code, reason) => resolve({ code, reason: String(reason) }));
  });
}

describe('POST /rooms', () => {
  it('creates a 2-player monopoly room by default and reserves p1 for the creator', async () => {
    const body = await createRoom();
    expect(body.roomId).toBeTruthy();
    expect(body.playerIds).toEqual(['p1', 'p2']);
    expect(body.gameType).toBe('monopoly');
    expect(body.playerId).toBe('p1');
    expect(body.sessionToken).toBeTruthy();
  });

  it('honours the requested player count and game type', async () => {
    const body = await createRoom({ gameType: 'scotland-yard', playerCount: 4 });
    expect(body.playerIds).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(body.gameType).toBe('scotland-yard');

    const catanRoom = await createRoom({ gameType: 'catan', playerCount: 3 });
    expect(catanRoom.gameType).toBe('catan');
  });

  it('rejects player counts outside a game\'s allowed range with a 400', async () => {
    const res1 = await app.inject({ method: 'POST', url: '/rooms', payload: { gameType: 'catan', playerCount: 2 } });
    expect(res1.statusCode).toBe(400);
    expect(res1.json()).toEqual({ error: 'Catan requires 3 to 4 players.' });

    const res2 = await app.inject({ method: 'POST', url: '/rooms', payload: { gameType: 'scotland-yard', playerCount: 2 } });
    expect(res2.statusCode).toBe(400);
    expect(res2.json()).toEqual({ error: 'Scotland Yard requires 3 to 6 players.' });

    const res3 = await app.inject({ method: 'POST', url: '/rooms', payload: { gameType: 'monopoly', playerCount: 1 } });
    expect(res3.statusCode).toBe(400);
    expect(res3.json()).toEqual({ error: 'Monopoly requires 2 to 8 players.' });
  });

  it('rejects unknown game types with a 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/rooms', payload: { gameType: 'chess' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Unknown game type' });
  });

  it('flags a room as hot-seat when requested (hot-seat regression)', async () => {
    const body = await createRoom({ playerCount: 2, hotSeat: true });
    expect(body.isHotSeat).toBe(true);

    const normal = await createRoom({ playerCount: 2 });
    expect(normal.isHotSeat).toBe(false);
  });

  it('creates a room with bot seats that joining clients cannot claim (Phase 35)', async () => {
    const body = await createRoom({ playerCount: 3, bots: ['p2'] });

    // p2 is a bot seat: the first human joiner must get p3 (p1 is the creator).
    const join1 = await app.inject({ method: 'POST', url: `/rooms/${body.roomId}/join` });
    expect(join1.statusCode).toBe(200);
    expect(join1.json().playerId).toBe('p3');

    // p1 (creator) + p2 (bot) + p3 (joined) → the room is now full.
    const join2 = await app.inject({ method: 'POST', url: `/rooms/${body.roomId}/join` });
    expect(join2.statusCode).toBe(400);
    expect(join2.json()).toEqual({ error: 'Room is full' });

    // The internal room registers p2 as a bot.
    const internal = roomManager.getRoom(body.roomId) as any;
    expect(internal.isBot('p2')).toBe(true);
  });

  it('ignores bot seat names that do not match any seat', async () => {
    const body = await createRoom({ playerCount: 2, bots: ['p2', 'ghost'] });

    const internal = roomManager.getRoom(body.roomId) as any;
    expect(internal.isBot('p2')).toBe(true);
    expect(internal.isBot('ghost')).toBe(false);
  });
});

describe('POST /rooms/:roomId/join', () => {
  it('returns a 404 for a missing room', async () => {
    const res = await app.inject({ method: 'POST', url: '/rooms/no-such-room/join' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Room not found' });
  });

  it('joins the next available seat', async () => {
    const room = await createRoom({ playerCount: 2 });
    const res = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.playerId).toBe('p2');
    expect(body.gameType).toBe('monopoly');
    expect(body.sessionToken).toBeTruthy();
  });

  it('returns a 400 when the room is full', async () => {
    const room = await createRoom({ playerCount: 2 });
    await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    const res = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Room is full' });
  });
});

describe('WebSocket /rooms/:roomId/ws', () => {
  it('closes with 1008 when the room does not exist', async () => {
    const ws = new WebSocket(`${baseWsUrl}/rooms/nope/ws?playerId=p1&token=t`);
    ws.on('error', () => {});
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('Room not found');
  });

  it('closes with 1008 when playerId and token are missing', async () => {
    const room = await createRoom();
    const ws = new WebSocket(`${baseWsUrl}/rooms/${room.roomId}/ws`);
    ws.on('error', () => {});
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('playerId and token required in query');
  });

  it('closes with 1008 when the session token is invalid', async () => {
    const room = await createRoom();
    const ws = new WebSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=p1&token=wrong`);
    ws.on('error', () => {});
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('Invalid session token');
  });

  it('streams state updates and events for dispatched actions', async () => {
    const room = await createRoom({ playerCount: 2 });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);

    await waitUntil(() => messages.length >= 1);
    const initialState = JSON.parse(messages[0]!);
    expect(initialState.type).toBe('STATE_UPDATE');
    expect(initialState.state.players).toHaveLength(2);

    ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: room.playerId }));

    await waitUntil(() => messages.length >= 3);
    const stateUpdate = JSON.parse(messages[1]!);
    const events = JSON.parse(messages[2]!);
    expect(stateUpdate.type).toBe('STATE_UPDATE');
    expect(events.type).toBe('EVENTS');
    expect(events.events.some((ev: any) => ev.type === 'DICE_ROLLED')).toBe(true);
    ws.close();
  }, 20000);

  it('replies with an ERROR message for unparseable or invalid payloads', async () => {
    const room = await createRoom({ playerCount: 2 });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);

    ws.send('this is not json');
    ws.send(JSON.stringify({ type: 'NOT_A_REAL_ACTION', playerId: room.playerId }));

    await waitUntil(() => messages.filter(m => JSON.parse(m).type === 'ERROR').length >= 2);
    const errors = messages.filter(m => JSON.parse(m).type === 'ERROR');
    for (const error of errors) {
      expect(JSON.parse(error).error).toBe('Invalid payload');
    }
    ws.close();
  });

  it('sends ACTION_REJECTED for invalid actions without broadcasting a state change', async () => {
    const room = await createRoom({ playerCount: 2 });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);
    await waitUntil(() => messages.length >= 1);

    const before = messages.length;
    // CRITICAL-1: the server forces playerId to the socket identity (p1), so
    // sending an invalid action (END_TURN before rolling) is rejected with feedback.
    ws.send(JSON.stringify({ type: 'END_TURN', playerId: 'p2' }));

    await waitUntil(() => messages.some(m => JSON.parse(m).type === 'ACTION_REJECTED'));
    const rejected = messages.map(m => JSON.parse(m)).filter(m => m.type === 'ACTION_REJECTED');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    // No extra state broadcast from the invalid action
    expect(messages.length).toBe(before + 1);
    ws.close();
  }, 20000);

  it('forces the socket identity over a forged playerId (CRITICAL-1)', async () => {
    const room = await createRoom({ playerCount: 2 });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);
    await waitUntil(() => messages.length >= 1);

    // p1 is the active player. Send ROLL_DICE but impersonate p2 in the payload.
    // The server must bind it to the socket identity (p1), so the roll succeeds.
    // (Key the wait on the DICE_ROLLED event: rolling doubles keeps hasRolled
    // false because the engine grants another turn, so hasRolled is not a
    // reliable success signal.)
    ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: 'p2' }));

    await waitUntil(() => messages.some(m => JSON.parse(m).type === 'EVENTS' && JSON.parse(m).events.some((e: any) => e.type === 'DICE_ROLLED')));
    expect(messages.some(m => JSON.parse(m).type === 'ACTION_REJECTED')).toBe(false);
    ws.close();
  }, 20000);

  it('honours a hot-seat owner acting for another seat (hot-seat regression)', async () => {
    const room = await createRoom({ playerCount: 2, hotSeat: true });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);
    await waitUntil(() => messages.length >= 1);

    // p1 (the owner) is the active player. Claiming to act as *p2* over the
    // owner's shared-board connection must be honoured — the engine then rejects
    // the roll because it is not p2's turn. Had the claim been ignored, the
    // server would have forced p1 and the roll would have succeeded.
    ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: 'p2' }));

    await waitUntil(() => messages.some(m => JSON.parse(m).type === 'ACTION_REJECTED'));
    const rolled = messages
      .map(m => JSON.parse(m))
      .filter(m => m.type === 'EVENTS')
      .some(m => m.events.some((e: any) => e.type === 'DICE_ROLLED'));
    expect(rolled).toBe(false);
    ws.close();
  }, 20000);

  it('still binds a non-owner seat to its own identity in a hot-seat room (hot-seat regression)', async () => {
    const room = await createRoom({ playerCount: 2, hotSeat: true });
    const joinRes = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    const p2 = joinRes.json() as { playerId: string; sessionToken: string };

    const p1 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    const conn2 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${p2.playerId}&token=${p2.sessionToken}`
    );
    p1.ws.on('error', () => {});
    conn2.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitForOpen(conn2.ws);
    await waitUntil(() => p1.messages.length >= 1 && conn2.messages.length >= 1);

    // p2 is not the owner, so the payload's forged playerId must be ignored:
    // the action is bound to p2, and since p1 (not p2) is the active player the
    // engine rejects it. If the claim had been honoured, p1 would have rolled.
    conn2.ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: 'p1' }));

    await waitUntil(() => conn2.messages.some(m => JSON.parse(m).type === 'ACTION_REJECTED'));
    const p1Rolled = p1.messages
      .map(m => JSON.parse(m))
      .filter(m => m.type === 'EVENTS')
      .some(m => m.events.some((e: any) => e.type === 'DICE_ROLLED'));
    expect(p1Rolled).toBe(false);
    p1.ws.close();
    conn2.ws.close();
  }, 20000);

  it('removes the connection from the room when the socket closes', async () => {
    const room = await createRoom({ playerCount: 2 });
    const joinRes = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    const p2 = joinRes.json() as { playerId: string; sessionToken: string };

    const p1 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    const conn2 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${p2.playerId}&token=${p2.sessionToken}`
    );
    p1.ws.on('error', () => {});
    conn2.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitForOpen(conn2.ws);

    const roomRef = roomManager.getRoom(room.roomId) as any;
    expect(roomRef.connections.get(room.playerId).send).toBeInstanceOf(Function);
    expect(roomRef.connections.get(p2.playerId).send).toBeInstanceOf(Function);

    p1.ws.close();
    await waitUntil(() => roomRef.connections.get(room.playerId) === undefined);
    expect(roomRef.connections.get(p2.playerId)).toBeDefined();
    conn2.ws.close();
  }, 20000);
});