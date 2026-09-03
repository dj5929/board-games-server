import { Room } from './Room';
import { IGameEngine, IGameState, IPlayerAction, IGameEvent } from '@packages/engine-core';
import { RedisStore, redisReviver } from './RedisStore';
import { PubSubManager } from './PubSubManager';

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const MAX_ROOMS = 10000;

type Logger = Pick<typeof console, 'log'>;

export class RoomManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rooms: Map<string, Room<any, any, any>> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private logger: Logger = console;
  private pubsub: PubSubManager;

  constructor() {
    this.pubsub = new PubSubManager();
    this.startCleanup();
  }

  public setLogger(logger: Logger) {
    this.logger = logger;
  }

  public setPubSubLogger(logger: Logger) {
    this.pubsub.setLogger(logger);
  }

  public createRoom<S extends IGameState, A extends IPlayerAction, E extends IGameEvent>(
    room: Room<S, A, E>
  ): string {
    if (this.rooms.size >= MAX_ROOMS) {
      this.logger.log('[RoomManager] Room capacity reached, rejecting new room');
      throw new Error('Room capacity reached');
    }
    this.rooms.set(room.id, room);
    room.setPubSub(this.pubsub);
    return room.id;
  }

  public getRoom(id: string) {
    return this.rooms.get(id);
  }

  public removeRoom(id: string) {
    const room = this.rooms.get(id);
    if (room) {
      room.closeAllConnections();
    }
    this.rooms.delete(id);
    RedisStore.del(`room:${id}`).catch(err => this.logger.log(`Redis del error: ${err}`));
  }

  public async initFromRedis(engines: Record<string, IGameEngine<IGameState, IPlayerAction, IGameEvent>>) {
    const keys = await RedisStore.getKeys('room:*');
    // Read the raw snapshots concurrently and build rooms in bounded batches
    // via Promise.allSettled, rather than one sequential `await` round-trip per
    // room (10k rooms = 10k sequential Redis GETs today).
    const BATCH_SIZE = 50;
    const results: Array<{ key: string; data?: any }> = [];
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map(async (key) => {
          const dataStr = await RedisStore.get(key);
          return { key, dataStr };
        })
      );
      settled.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.dataStr) {
          try {
            results.push({ key: batch[idx]!, data: JSON.parse(res.value.dataStr, redisReviver) });
          } catch (e) {
            this.logger.log(`[RoomManager] Failed to parse room ${batch[idx]}: ${e}`);
          }
        }
      });
    }

    // Build all rooms in parallel; the constructor no longer writes the snapshot
    // back (rehydrate path), so no redundant persistence round-trips occur here.
    const built = await Promise.allSettled(
      results.map(async ({ data }) => {
        const engine = engines[data.gameType];
        if (!engine) return null;
        const room = new Room(data.id, data.gameType, engine, { next: () => 0.5 }, [], data.state, {
          isHotSeat: data.isHotSeat === true,
          ownerPlayerId: data.ownerPlayerId ?? null,
          turnTimeLimitMs: data.turnTimeLimitMs ?? 0
        });
        room.loadState(data);
        room.setPubSub(this.pubsub);
        return room;
      })
    );

    for (const res of built) {
      if (res.status === 'fulfilled' && res.value) {
        this.rooms.set(res.value.id, res.value);
        this.logger.log(`[RoomManager] Rehydrated room ${res.value.id} (${res.value.gameType}) from Redis`);
      } else if (res.status === 'rejected') {
        this.logger.log(`[RoomManager] Failed to rehydrate room: ${res.reason}`);
      }
    }
  }

  public get roomCount(): number {
    return this.rooms.size;
  }

  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, room] of this.rooms) {
        // Idle timeout
        if (now - room.lastActivity > ROOM_TTL_MS) {
          this.logger.log(`[RoomManager] Removing idle room ${id} (idle for ${Math.round((now - room.lastActivity) / 1000 / 60)}m)`);
          room.closeAllConnections();
          this.rooms.delete(id);
          RedisStore.del(`room:${id}`).catch(() => {});
          continue;
        }

        // Token expiry (5 mins)
        for (const [playerId, issuedAt] of room.tokenIssuedAt.entries()) {
           if (now - issuedAt > 5 * 60 * 1000) {
              this.logger.log(`[RoomManager] Revoking unredeemed session token for player ${playerId} in room ${id}`);
              room.revokeSessionToken(playerId);
           }
        }

        // Forfeit on 5-min disconnect for active player
        const state = room.getState();
        if (state && state.activePlayerId) {
           const activeId = state.activePlayerId;
           const disconnectedAt = room.disconnectedAt.get(activeId);
           if (disconnectedAt && now - disconnectedAt > 5 * 60 * 1000) {
              this.logger.log(`[RoomManager] Player ${activeId} in room ${id} disconnected for >5 mins. Forfeiting turn.`);
              room.disconnectedAt.delete(activeId); // clear to prevent spam
              room.dispatch({ type: 'END_TURN', playerId: activeId } as any);
           }
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
