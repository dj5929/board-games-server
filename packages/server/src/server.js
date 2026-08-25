"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const cors_1 = __importDefault(require("@fastify/cors"));
const RoomManager_1 = require("./RoomManager");
const Room_1 = require("./Room");
const monopoly_engine_1 = require("@packages/monopoly-engine");
const catan_engine_1 = require("@packages/catan-engine");
const schemas_1 = require("./schemas");
const fastify = (0, fastify_1.default)({ logger: true });
fastify.register(cors_1.default, { origin: '*' });
fastify.register(websocket_1.default);
// Simple RNG for MVP (in production use seeded or crypto RNG)
const MathRandomProvider = { next: () => Math.random() };
fastify.post('/rooms', async (request, reply) => {
    const body = request.body || {};
    const playerCount = body.playerCount || 2;
    const gameType = body.gameType || 'monopoly';
    const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
    const roomId = Math.random().toString(36).substring(7);
    let engine = monopoly_engine_1.MonopolyEngine;
    if (gameType === 'catan') {
        engine = catan_engine_1.CatanEngine;
    }
    const room = new Room_1.Room(roomId, gameType, engine, MathRandomProvider, playerIds);
    RoomManager_1.roomManager.createRoom(room);
    return { roomId, playerIds, gameType };
});
fastify.post('/rooms/:roomId/join', async (request, reply) => {
    const roomId = request.params.roomId;
    const room = RoomManager_1.roomManager.getRoom(roomId);
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
    fastify.get('/rooms/:roomId/ws', { websocket: true }, (connection, req) => {
        const roomId = req.params.roomId;
        const room = RoomManager_1.roomManager.getRoom(roomId);
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
            send: (data) => connection.socket.send(data)
        });
        console.log(`[WS] Connection established for room ${roomId} player ${playerId}`);
        connection.socket.on('message', (message) => {
            try {
                const parsed = JSON.parse(message.toString());
                const action = schemas_1.actionSchema.parse(parsed);
                // Dispatch the action to the room
                room.dispatch(action);
            }
            catch (err) {
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
const start = async () => {
    try {
        await fastify.listen({ port: 3000 });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
exports.start = start;
if (require.main === module) {
    (0, exports.start)();
}
