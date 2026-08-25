"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomManager = exports.RoomManager = void 0;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
class RoomManager {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rooms = new Map();
    cleanupTimer = null;
    constructor() {
        this.startCleanup();
    }
    createRoom(room) {
        this.rooms.set(room.id, room);
        return room.id;
    }
    getRoom(id) {
        return this.rooms.get(id);
    }
    removeRoom(id) {
        this.rooms.delete(id);
    }
    get roomCount() {
        return this.rooms.size;
    }
    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [id, room] of this.rooms) {
                if (now - room.lastActivity > ROOM_TTL_MS) {
                    console.log(`[RoomManager] Removing idle room ${id} (idle for ${Math.round((now - room.lastActivity) / 1000 / 60)}m)`);
                    this.rooms.delete(id);
                }
            }
        }, CLEANUP_INTERVAL_MS);
        // Don't let the timer prevent process exit
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}
exports.RoomManager = RoomManager;
exports.roomManager = new RoomManager();
