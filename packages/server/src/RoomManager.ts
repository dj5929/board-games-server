import { Room } from './Room';
import { IGameState, IPlayerAction, IGameEvent } from '@packages/engine-core';

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export class RoomManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rooms: Map<string, Room<any, any, any>> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  public createRoom<S extends IGameState, A extends IPlayerAction, E extends IGameEvent>(
    room: Room<S, A, E>
  ): string {
    this.rooms.set(room.id, room);
    return room.id;
  }

  public getRoom(id: string) {
    return this.rooms.get(id);
  }

  public removeRoom(id: string) {
    this.rooms.delete(id);
  }

  public get roomCount(): number {
    return this.rooms.size;
  }

  private startCleanup() {
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

  public stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const roomManager = new RoomManager();
