import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../src/server';
import { roomManager } from '../src/RoomManager';

const app = buildApp(false);
let baseWsUrl = '';

beforeAll(async () => {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as AddressInfo;
  baseWsUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

function waitUntil(cond: () => boolean, timeoutMs = 3000): Promise<void> {
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

async function createRoom(payload: { gameType?: string; playerCount?: number } = {}) {
  const res = await app.inject({ method: 'POST', url: '/rooms', payload });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    roomId: string;
    playerIds: string[];
    gameType: string;
    playerId: string;
    sessionToken: string;
  };
}

function openSocket(url: string) {
  const messages: string[] = [];
  const ws = new WebSocket(url);
  ws.on('message', (raw: string | Buffer | ArrayBuffer | Buffer[]) => messages.push(raw.toString()));
  ws.on('error', () => {});
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
  });

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

  it('ignores invalid actions without broadcasting', async () => {
    const room = await createRoom({ playerCount: 2 });
    const { ws, messages } = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    ws.on('error', () => {});
    await waitForOpen(ws);
    await waitUntil(() => messages.length >= 1);

    const before = messages.length;
    ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: 'p2' })); // not p2's turn

    await new Promise(r => setTimeout(r, 100));
    expect(messages.length).toBe(before);
    ws.close();
  });

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
  });
});