"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const engine_core_1 = require("@packages/engine-core");
class Room {
    id;
    gameType;
    engine;
    rng;
    state;
    connections = new Map();
    lastActivity;
    constructor(id, gameType, engine, rng, initialPlayerIds) {
        this.id = id;
        this.gameType = gameType;
        this.engine = engine;
        this.rng = rng;
        this.state = this.engine.getInitialState(initialPlayerIds.map(id => (0, engine_core_1.playerId)(id)), this.rng);
        this.lastActivity = Date.now();
    }
    getState() {
        return this.state;
    }
    addConnection(playerId, connection) {
        this.connections.set(playerId, connection);
        this.lastActivity = Date.now();
        this.broadcastState();
    }
    removeConnection(playerId) {
        this.connections.delete(playerId);
    }
    dispatch(action) {
        this.lastActivity = Date.now();
        if (!this.engine.isValidAction(this.state, action)) {
            return;
        }
        const result = this.engine.reduce(this.state, action, this.rng);
        if (!result.success)
            return;
        this.state = result.data.nextState;
        this.broadcastState();
        if (result.data.events.length > 0) {
            this.broadcastEvents(result.data.events);
        }
    }
    broadcastState() {
        const payload = JSON.stringify({ type: 'STATE_UPDATE', state: this.state });
        for (const conn of this.connections.values()) {
            conn.send(payload);
        }
    }
    broadcastEvents(events) {
        const payload = JSON.stringify({ type: 'EVENTS', events });
        for (const conn of this.connections.values()) {
            conn.send(payload);
        }
    }
    getAvailablePlayerId() {
        const allPlayerIds = this.state.players.map(p => p.id);
        for (const id of allPlayerIds) {
            if (!this.connections.has(id))
                return id;
        }
        return null;
    }
}
exports.Room = Room;
