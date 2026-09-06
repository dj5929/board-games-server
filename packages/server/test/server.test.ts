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

async function createRoom(payload: { gameType?: string; playerCount?: number; hotSeat?: boolean; bots?: string[]; isPublic?: boolean } = {}) {
  const res = await app.inject({ method: 'POST', url: '/rooms', payload });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    roomId: string;
    roomCode: string;
    playerIds: string[];
    gameType: string;
    playerId: string;
    sessionToken: string;
    isHotSeat?: boolean;
    isPublic?: boolean;
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

  it('flags a room as public when requested (Phase 37)', async () => {
    const pub = await createRoom({ playerCount: 2, isPublic: true });
    expect(pub.isPublic).toBe(true);

    const priv = await createRoom({ playerCount: 2 });
    expect(priv.isPublic).toBe(false);

    roomManager.removeRoom(pub.roomId);
    roomManager.removeRoom(priv.roomId);
  });
});

describe('GET /rooms', () => {
  function removeRoom(roomId: string) {
    roomManager.removeRoom(roomId);
  }

  async function listRooms(gameType?: string) {
    const res = await app.inject({ method: 'GET', url: gameType ? `/rooms?gameType=${gameType}` : '/rooms' });
    expect(res.statusCode).toBe(200);
    return res.json().rooms as Array<Record<string, any>>;
  }

  it('lists only public rooms with directory metadata (Phase 37)', async () => {
    const pub = await createRoom({ gameType: 'monopoly', playerCount: 2, isPublic: true });
    const priv = await createRoom({ gameType: 'catan', playerCount: 3 }); // private -> excluded

    const rooms = await listRooms();
    const entry = rooms.find(r => r.roomId === pub.roomId);
    expect(entry).toBeDefined();
    expect(rooms.some(r => r.roomId === priv.roomId)).toBe(false);

    expect(entry!.gameType).toBe('monopoly');
    expect(entry!.label).toBe('Monopoly');
    expect(entry!.seats).toBe(2);
    expect(entry!.capacity).toBe(8);
    // Creator holds p1; one seat remains claimable.
    expect(entry!.connectedCount).toBe(0);
    expect(entry!.availableSeats).toBe(1);
    expect(entry!.isFull).toBe(false);
    expect(entry!.status).toBe('LOBBY');
    expect(entry!.isHotSeat).toBe(false);
    expect(entry!.botCount).toBe(0);
    expect(entry!.hasBots).toBe(false);
    expect(entry!.spectatorCount).toBe(0);

    removeRoom(pub.roomId);
    removeRoom(priv.roomId);
  });

  it('tracks available seats as joiners claim them (Phase 37)', async () => {
    const room = await createRoom({ playerCount: 4, isPublic: true });
    await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });

    const rooms = await listRooms();
    const entry = rooms.find(r => r.roomId === room.roomId)!;
    expect(entry.availableSeats).toBe(2);
    expect(entry.connectedCount).toBe(0);

    removeRoom(room.roomId);
  });

  it('reflects bot seats, hot-seat rooms and spectators in the directory (Phase 37)', async () => {
    const room = await createRoom({ playerCount: 3, hotSeat: true, bots: ['p3'], isPublic: true });

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.length >= 1);

    const rooms = await listRooms();
    const entry = rooms.find(r => r.roomId === room.roomId)!;
    expect(entry.isHotSeat).toBe(true);
    expect(entry.botCount).toBe(1);
    expect(entry.hasBots).toBe(true);
    // p1 creator + p3 bot claim two seats; p2 stays open.
    expect(entry.availableSeats).toBe(1);
    expect(entry.spectatorCount).toBe(1);

    spec.ws.close();
    await waitUntil(() => (roomManager.getRoom(room.roomId) as any).spectatorConnections.size === 0);
    removeRoom(room.roomId);
  });

  it('filters the directory by game type (Phase 37)', async () => {
    const mono = await createRoom({ gameType: 'monopoly', playerCount: 2, isPublic: true });
    const catan = await createRoom({ gameType: 'catan', playerCount: 3, isPublic: true });

    const monopoly = await listRooms('monopoly');
    expect(monopoly.some(r => r.roomId === mono.roomId)).toBe(true);
    expect(monopoly.some(r => r.roomId === catan.roomId)).toBe(false);

    const catanRooms = await listRooms('catan');
    expect(catanRooms.some(r => r.roomId === catan.roomId)).toBe(true);
    expect(catanRooms.some(r => r.roomId === mono.roomId)).toBe(false);

    removeRoom(mono.roomId);
    removeRoom(catan.roomId);
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

describe('POST /rooms/:roomId/spectate', () => {
  it('returns a 404 for a missing room', async () => {
    const res = await app.inject({ method: 'POST', url: '/rooms/no-such-room/spectate' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Room not found' });
  });

  it('issues a spectator credential without consuming a seat', async () => {
    const room = await createRoom({ playerCount: 2 });
    const res = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { roomId: string; gameType: string; spectatorId: string; token: string };
    expect(body.roomId).toBe(room.roomId);
    expect(body.gameType).toBe('monopoly');
    expect(body.spectatorId).toMatch(/^spectator-/);
    expect(body.token).toBeTruthy();

    // The room still has its full set of seats open: spectators never occupy one.
    const join = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    expect(join.statusCode).toBe(200);
    expect(join.json().playerId).toBe('p2');
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

  it('closes with 1008 when playerId/spectatorId and token are missing', async () => {
    const room = await createRoom();
    const ws = new WebSocket(`${baseWsUrl}/rooms/${room.roomId}/ws`);
    ws.on('error', () => {});
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('playerId/spectatorId and token required in query');
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

  it('closes with 1008 for an invalid spectator token (Phase 36)', async () => {
    const room = await createRoom();
    const ws = new WebSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=spectator-1&token=wrong`);
    ws.on('error', () => {});
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('Invalid session token');
  });

  it('shows a hidden-info projection to a spectator and ignores their messages (Phase 36)', async () => {
    const room = await createRoom({ gameType: 'scotland-yard', playerCount: 3 });
    const p1 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.length >= 1);

    // A player (Mr X) sees his real position; the spectator must not.
    const playerState = JSON.parse(p1.messages[0]!);
    const playerMrX = playerState.state.players.find((p: any) => p.role === 'MR_X');
    expect(playerMrX.position).not.toBe(0);

    const specState = JSON.parse(spec.messages[0]!);
    expect(specState.type).toBe('STATE_UPDATE');
    const specMrX = specState.state.players.find((p: any) => p.role === 'MR_X');
    expect(specMrX.position).toBe(0);

    // Spectator messages are dropped entirely: no dispatch, no feedback.
    // (Settle briefly: the spectator's connect broadcast also reaches p1.)
    await new Promise(r => setTimeout(r, 400));
    const specBefore = spec.messages.length;
    const p1Before = p1.messages.length;
    spec.ws.send(JSON.stringify({ type: 'MOVE', playerId: room.playerId, payload: { targetNode: 13, ticketType: 'taxi' } }));
    await new Promise(r => setTimeout(r, 500));
    expect(spec.messages.length).toBe(specBefore);
    expect(p1.messages.length).toBe(p1Before);
    spec.ws.close();
    p1.ws.close();
  }, 20000);

  it('streams action broadcasts and events to a spectator (Phase 36)', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.length >= 1);

    const specBefore = spec.messages.length;
    p1.ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: room.playerId }));

    await waitUntil(() => spec.messages.some(m => JSON.parse(m).type === 'EVENTS'));
    const events = spec.messages
      .map(m => JSON.parse(m))
      .find(m => m.type === 'EVENTS');
    expect(events.events.some((e: any) => e.type === 'DICE_ROLLED')).toBe(true);
    // The spectator gets the new state too, not just events.
    expect(JSON.parse(spec.messages[specBefore]!).type).toBe('STATE_UPDATE');
    spec.ws.close();
    p1.ws.close();
  }, 20000);

  it('streams a live spectator count to players over the socket (Phase 36)', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(
      `${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`
    );
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    const initial = JSON.parse(p1.messages[0]!);
    expect(initial.spectatorCount).toBe(0);

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => p1.messages.some(m => JSON.parse(m).spectatorCount === 1));

    const joined = p1.messages.map(m => JSON.parse(m)).find(m => m.spectatorCount === 1);
    expect(joined.type).toBe('STATE_UPDATE');

    const joinedIndex = p1.messages.length;
    spec.ws.close();
    // Leaving rebroadcasts so the count drops back to 0 for the player.
    await waitUntil(() => {
      for (let i = joinedIndex; i < p1.messages.length; i++) {
        if (JSON.parse(p1.messages[i]!).spectatorCount === 0) return true;
      }
      return false;
    });
    p1.ws.close();
  }, 20000);

  it('removes the spectator from the room when the socket closes (Phase 36)', async () => {
    const room = await createRoom();
    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.length >= 1);

    const roomRef = roomManager.getRoom(room.roomId) as any;
    expect(roomRef.spectatorConnections.get(cred.spectatorId).send).toBeInstanceOf(Function);

    spec.ws.close();
    await waitUntil(() => roomRef.spectatorConnections.get(cred.spectatorId) === undefined);
  }, 20000);
});

describe('in-room chat (Phase 38)', () => {
  it('relays a player chat line to every player and spectator', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`);
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);

    const join = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    const p2cred = join.json() as { playerId: string; sessionToken: string };
    const p2 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${p2cred.playerId}&token=${p2cred.sessionToken}`);
    p2.ws.on('error', () => {});
    await waitForOpen(p2.ws);

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);

    p1.ws.send(JSON.stringify({ type: 'CHAT', text: '  hello room  ' }));

    for (const client of [p1, p2, spec]) {
      await waitUntil(() => client.messages.some(m => JSON.parse(m).type === 'CHAT_MESSAGE'));
      const frame = client.messages.map(m => JSON.parse(m)).find(m => m.type === 'CHAT_MESSAGE');
      expect(frame.message.text).toBe('hello room');
      expect(frame.message.senderId).toBe(room.playerId);
      expect(frame.message.senderRole).toBe('player');
      expect(frame.message.roomId).toBe(room.roomId);
      expect(typeof frame.message.sentAt).toBe('number');
    }
  }, 20000);

  it('lets a spectator chat; game actions from a spectator are still dropped', async () => {
    const room = await createRoom({ gameType: 'scotland-yard', playerCount: 3 });
    const p1 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`);
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.length >= 1);
    // Let the spectator-join STATE_UPDATE (spectatorCount bump) settle on p1 so
    // the "dropped action" assertion below only compares like-for-like.
    await waitUntil(() => p1.messages.some(m => JSON.parse(m).spectatorCount === 1));

    // A spectator game action is still silently ignored (chat-only sockets).
    const p1Before = p1.messages.length;
    spec.ws.send(JSON.stringify({ type: 'MOVE', playerId: room.playerId, payload: { targetNode: 13, ticketType: 'taxi' } }));
    await new Promise(r => setTimeout(r, 300));
    expect(p1.messages.length).toBe(p1Before);

    // ...but their chat is relayed to everyone with the spectator identity.
    spec.ws.send(JSON.stringify({ type: 'CHAT', text: 'go detectives!' }));
    await waitUntil(() => p1.messages.some(m => {
      const d = JSON.parse(m);
      return d.type === 'CHAT_MESSAGE' && d.message.senderRole === 'spectator';
    }));
    const frame = p1.messages.map(m => JSON.parse(m)).find(m => m.type === 'CHAT_MESSAGE' && m.message.senderRole === 'spectator');
    expect(frame.message.senderId).toBe(cred.spectatorId);
    expect(frame.message.text).toBe('go detectives!');
    // The spectator receives their own line back like any other client.
    await waitUntil(() => spec.messages.some(m => JSON.parse(m).type === 'CHAT_MESSAGE'));
  }, 20000);

  it('rejects blank, non-string and oversized chat lines without relaying or state writes', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`);
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);
    const stateCountBefore = p1.messages.map(m => JSON.parse(m)).filter(m => m.type === 'STATE_UPDATE').length;

    p1.ws.send(JSON.stringify({ type: 'CHAT', text: '   ' }));
    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 'x'.repeat(501) }));
    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 123 }));
    p1.ws.send(JSON.stringify({ type: 'CHAT' }));

    await waitUntil(() => p1.messages.some(m => {
      const d = JSON.parse(m);
      return d.type === 'ERROR' && d.error === 'Invalid message';
    }));

    // Nobody received a chat line, and no game state broadcast was triggered.
    expect(p1.messages.map(m => JSON.parse(m)).some(m => m.type === 'CHAT_MESSAGE')).toBe(false);
    const stateCountAfter = p1.messages.map(m => JSON.parse(m)).filter(m => m.type === 'STATE_UPDATE').length;
    expect(stateCountAfter).toBe(stateCountBefore);
  }, 20000);

  it('chat never mutates game state and the game remains playable', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`);
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    const lastState = () => {
      const states = p1.messages.map(m => JSON.parse(m)).filter(m => m.type === 'STATE_UPDATE');
      return JSON.stringify(states[states.length - 1]!.state);
    };
    const before = lastState();

    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 'quick question?' }));
    await waitUntil(() => p1.messages.some(m => JSON.parse(m).type === 'CHAT_MESSAGE'));
    expect(p1.messages.map(m => JSON.parse(m)).some(m => m.type === 'EVENTS')).toBe(false);
    expect(lastState()).toBe(before);

    // The room still accepts real game actions after the chat round-trip.
    p1.ws.send(JSON.stringify({ type: 'ROLL_DICE', playerId: room.playerId }));
    await waitUntil(() => p1.messages.some(m => JSON.parse(m).type === 'EVENTS'));
    const events = p1.messages.map(m => JSON.parse(m)).find(m => m.type === 'EVENTS');
    expect(events.events.some((e: any) => e.type === 'DICE_ROLLED')).toBe(true);
  }, 20000);

  it('replays the recent chat history to a player and a spectator that connect late (Phase 39)', async () => {
    const room = await createRoom({ playerCount: 2 });
    const p1 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${room.playerId}&token=${room.sessionToken}`);
    p1.ws.on('error', () => {});
    await waitForOpen(p1.ws);
    await waitUntil(() => p1.messages.length >= 1);

    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 'greetings' }));
    await waitUntil(() => p1.messages.some(m => JSON.parse(m).type === 'CHAT_MESSAGE'));
    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 'are you there?' }));
    await waitUntil(() => p1.messages.filter(m => JSON.parse(m).type === 'CHAT_MESSAGE').length >= 2);

    // A player connecting late is caught up on what was already said.
    const join = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/join` });
    const p2cred = join.json() as { playerId: string; sessionToken: string };
    const p2 = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?playerId=${p2cred.playerId}&token=${p2cred.sessionToken}`);
    p2.ws.on('error', () => {});
    await waitForOpen(p2.ws);
    await waitUntil(() => p2.messages.some(m => JSON.parse(m).type === 'CHAT_HISTORY'));
    const hist = p2.messages.map(m => JSON.parse(m)).find(m => m.type === 'CHAT_HISTORY');
    expect(hist.messages.map((c: { text: string }) => c.text)).toEqual(['greetings', 'are you there?']);

    // A spectator joining even later gets the same history snapshot.
    const spectate = await app.inject({ method: 'POST', url: `/rooms/${room.roomId}/spectate` });
    const cred = spectate.json() as { spectatorId: string; token: string };
    const spec = openSocket(`${baseWsUrl}/rooms/${room.roomId}/ws?spectatorId=${cred.spectatorId}&token=${cred.token}`);
    spec.ws.on('error', () => {});
    await waitForOpen(spec.ws);
    await waitUntil(() => spec.messages.some(m => JSON.parse(m).type === 'CHAT_HISTORY'));
    const specHist = spec.messages.map(m => JSON.parse(m)).find(m => m.type === 'CHAT_HISTORY');
    expect(specHist.messages.map((c: { text: string }) => c.text)).toEqual(['greetings', 'are you there?']);

    // Live chat still flows to the late joiners after the catch-up.
    p1.ws.send(JSON.stringify({ type: 'CHAT', text: 'now live' }));
    await waitUntil(() => spec.messages.some(m => {
      const d = JSON.parse(m);
      return d.type === 'CHAT_MESSAGE' && d.message.text === 'now live';
    }));
    await waitUntil(() => p2.messages.some(m => {
      const d = JSON.parse(m);
      return d.type === 'CHAT_MESSAGE' && d.message.text === 'now live';
    }));
  }, 20000);
});

describe('room codes & invite links (Phase 40)', () => {
  it('returns a valid shareable code on create and exposes it in the directory', async () => {
    const body = await createRoom({ playerCount: 2, isPublic: true });
    expect(body.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const rooms = await app.inject({ method: 'GET', url: '/rooms' });
    const entry = rooms.json().rooms.find((r: any) => r.roomId === body.roomId);
    expect(entry?.roomCode).toBe(body.roomCode);
    roomManager.removeRoom(body.roomId);
  });

  it('joins a room by its invite code, case-insensitively (Phase 40)', async () => {
    const body = await createRoom({ playerCount: 2 });
    const join = await app.inject({ method: 'POST', url: `/rooms/${body.roomCode.toLowerCase()}/join` });
    expect(join.statusCode).toBe(200);
    expect(join.json().playerId).toBe('p2');
    expect(join.json().roomId).toBe(body.roomId);
    expect(join.json().roomCode).toBe(body.roomCode);
    roomManager.removeRoom(body.roomId);
  });

  it('spectates a room by its invite code (Phase 40)', async () => {
    const body = await createRoom({ playerCount: 2 });
    const spec = await app.inject({ method: 'POST', url: `/rooms/${body.roomCode}/spectate` });
    expect(spec.statusCode).toBe(200);
    const cred = spec.json();
    expect(cred.roomId).toBe(body.roomId);
    expect(cred.roomCode).toBe(body.roomCode);
    expect(cred.spectatorId).toBeTruthy();
    expect(cred.token).toBeTruthy();
    roomManager.removeRoom(body.roomId);
  });

  it('rejects unknown codes with a 404 (Phase 40)', async () => {
    const join = await app.inject({ method: 'POST', url: '/rooms/ZZZZZZ/join' });
    expect(join.statusCode).toBe(404);
    const spec = await app.inject({ method: 'POST', url: '/rooms/ZZZZZZ/spectate' });
    expect(spec.statusCode).toBe(404);
  });
});