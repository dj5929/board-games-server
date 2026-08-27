import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { roomManager } from './RoomManager';
import { Room } from './Room';
import { MonopolyEngine } from '@packages/monopoly-engine';
import { CatanEngine } from '@packages/catan-engine';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';
import { actionSchema } from './schemas';

const fastify = Fastify({ logger: true });
fastify.register(cors, { origin: '*' });
fastify.register(fastifyWebsocket);

// Simple RNG for MVP (in production use seeded or crypto RNG)
const MathRandomProvider = { next: () => Math.random() };

fastify.post<{ Body: { playerCount?: number; gameType?: string } }>('/rooms', async (request, reply) => {
  const body = request.body || {};
  const playerCount = body.playerCount || 2;
  const gameType = body.gameType || 'monopoly';
  const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);

  const roomId = Math.random().toString(36).substring(7);
  
  let engine: any = MonopolyEngine;
  if (gameType === 'catan') {
    engine = CatanEngine;
  } else if (gameType === 'scotland-yard') {
    engine = ScotlandYardEngine;
  }

  const room = new Room(roomId, gameType, engine, MathRandomProvider, playerIds);
  roomManager.createRoom(room);
  return { roomId, playerIds, gameType };
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

  return { playerId: availableId, gameType: room.gameType };
});

fastify.register(async function (fastify) {
  fastify.get<{ Params: { roomId: string }; Querystring: { playerId?: string } }>('/rooms/:roomId/ws', { websocket: true }, (connection, req) => {
    const roomId = req.params.roomId;
    const room = roomManager.getRoom(roomId);
    
    if (!room) {
      connection.socket.close(1008, 'Room not found');
      return;
    }

    // For MVP, we assume the client passes playerId in query string ?playerId=p1
    const playerId = req.query.playerId;
    if (!playerId) {
      connection.socket.close(1008, 'playerId required in query');
      return;
    }

    room.addConnection(playerId, {
      send: (data: string) => connection.socket.send(data)
    });
    console.log(`[WS] Connection established for room ${roomId} player ${playerId}`);

    connection.socket.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        const action = actionSchema.parse(parsed);
        // Dispatch the action to the room
        room.dispatch(action as Parameters<typeof room.dispatch>[0]);
      } catch (err) {
        connection.socket.send(JSON.stringify({ type: 'ERROR', error: 'Invalid payload' }));
      }
    });

    connection.socket.on('close', (code, reason) => {
      console.log(`[WS] Connection closed for room ${roomId} player ${playerId}. Code: ${code}, Reason: ${reason}`);
      room.removeConnection(playerId);
    });
    
    connection.socket.on('error', (err) => {
      console.log(`[WS] Error for room ${roomId}:`, err);
    });
  });
});

export const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
