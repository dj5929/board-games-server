import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { roomManager } from './RoomManager';
import { Room } from './Room';
import { MonopolyEngine } from '@packages/monopoly-engine';
import { CatanEngine } from '@packages/catan-engine';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';
import type { IGameEngine, IGameState, IPlayerAction, IGameEvent } from '@packages/engine-core';
import { GAME_CONFIGS, isGameType } from '@packages/engine-core';
import { actionSchemaByGame } from './schemas';
import crypto from 'node:crypto';

const CryptoRandomProvider = {
  next: () => crypto.randomBytes(4).readUInt32LE(0) / 0xffffffff
};

export const ENGINES: Record<string, IGameEngine<IGameState, IPlayerAction, IGameEvent>> = {
  'monopoly': MonopolyEngine,
  'catan': CatanEngine,
  'scotland-yard': ScotlandYardEngine
};

export const buildApp = (logger: boolean = true) => {
  const fastify = Fastify({ logger });
  roomManager.setLogger({ log: (msg: string) => fastify.log.info(msg) });

  fastify.register(cors, { origin: ['http://localhost:5173'] });
  fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  fastify.register(fastifyWebsocket);

  fastify.post<{ Body: { playerCount?: number; gameType?: string } }>('/rooms', async (request, reply) => {
    const body = request.body || {};
    const gameType = body.gameType || 'monopoly';

    if (!isGameType(gameType)) {
      return reply.status(400).send({ error: 'Unknown game type' });
    }

    const config = GAME_CONFIGS[gameType];
    const playerCount = body.playerCount ?? config.minPlayers;

    if (typeof playerCount !== 'number' || !Number.isInteger(playerCount) ||
        playerCount < config.minPlayers || playerCount > config.maxPlayers) {
      return reply.status(400).send({
        error: `${GAME_CONFIGS[gameType].label} requires ${config.minPlayers} to ${config.maxPlayers} players.`
      });
    }

    const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);

    const roomId = crypto.randomUUID();

    const engine = ENGINES[gameType];
    if (!engine) {
      return reply.status(400).send({ error: 'Unknown game type' });
    }

    const room = new Room<IGameState, IPlayerAction, IGameEvent>(roomId, gameType, engine, CryptoRandomProvider, playerIds);
    roomManager.createRoom(room);

    // Auto-join the creator to the first available slot
    const playerId = playerIds[0]!;
    const sessionToken = room.issueSessionToken(playerId);

    return { roomId, playerIds, gameType, playerId, sessionToken };
  });

  fastify.post<{ Params: { roomId: string } }>('/rooms/:roomId/join', async (request, reply) => {
    const roomId = request.params.roomId;
    const room = roomManager.getRoom(roomId);

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const availableId = room.getAvailablePlayerId();
    if (!availableId) {
      return reply.status(400).send({ error: 'Room is full' });
    }

    const sessionToken = room.issueSessionToken(availableId);
    return { playerId: availableId, gameType: room.gameType, sessionToken };
  });

  fastify.register(async function (fastify) {
    fastify.get<{ Params: { roomId: string }; Querystring: { playerId?: string, token?: string } }>('/rooms/:roomId/ws', { websocket: true }, (socket, req) => {
      const roomId = req.params.roomId;
      const room = roomManager.getRoom(roomId);

      if (!room) {
        socket.close(1008, 'Room not found');
        return;
      }

      const playerId = req.query.playerId;
      const token = req.query.token;

      if (!playerId || !token) {
        socket.close(1008, 'playerId and token required in query');
        return;
      }

      if (!room.verifySessionToken(playerId, token)) {
        socket.close(1008, 'Invalid session token');
        return;
      }

      room.addConnection(playerId, {
        send: (data: string) => socket.send(data),
        close: () => socket.close()
      });
      fastify.log.info(`[WS] Connection established for room ${roomId} player ${playerId}`);

      const actionSchema = actionSchemaByGame[room.gameType as keyof typeof actionSchemaByGame];
      if (!actionSchema) {
        socket.close(1008, 'Unsupported game type');
        return;
      }

      let wsTokens = 10;
      let lastRefill = Date.now();
      
      let isAlive = true;
      socket.on('pong', () => { isAlive = true; });
      const pingInterval = setInterval(() => {
        if (!isAlive) {
          socket.terminate();
          clearInterval(pingInterval);
          return;
        }
        isAlive = false;
        socket.ping();
      }, 30000);

      socket.on('message', (message: string) => {
        const now = Date.now();
        wsTokens += Math.floor((now - lastRefill) / 1000) * 10; // refill 10 tokens per sec
        if (wsTokens > 20) wsTokens = 20; // max burst 20
        lastRefill = now;
        
        if (wsTokens <= 0) {
           socket.send(JSON.stringify({ type: 'ERROR', error: 'Rate limit exceeded' }));
           return;
        }
        wsTokens -= 1;

        try {
          const parsed = JSON.parse(message.toString());
          const action = actionSchema.parse(parsed);
          // CRITICAL-1: force playerId to the authenticated socket identity,
          // ignoring any client-supplied value to prevent impersonation.
          room.dispatch({ ...(action as object), playerId } as Parameters<typeof room.dispatch>[0]);
        } catch {
          socket.send(JSON.stringify({ type: 'ERROR', error: 'Invalid payload' }));
        }
      });

      socket.on('close', (code, reason) => {
        clearInterval(pingInterval);
        fastify.log.info(`[WS] Connection closed for room ${roomId} player ${playerId}. Code: ${code}, Reason: ${reason}`);
        room.removeConnection(playerId);
      });

      socket.on('error', (err) => {
        fastify.log.error(`[WS] Error for room ${roomId}: ${err.message}`);
      });
    });
  });

  return fastify;
};

export const start = async () => {
  await roomManager.initFromRedis(ENGINES);
  const fastify = buildApp(false);
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (typeof require !== 'undefined' && require.main === module) {
  start();
}