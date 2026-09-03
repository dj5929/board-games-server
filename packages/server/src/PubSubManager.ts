import type { Redis } from 'ioredis';
import { RedisStore } from './RedisStore';
export interface RoomBroadcastMessage {
  state: unknown;
  events?: unknown[];
  timer?: { turnStartedAt: number; turnTimeLimitMs: number };
}

type Logger = Pick<typeof console, 'log'>;

/**
 * Redis Pub/Sub adapter for cross-instance WebSocket room broadcasting.
 *
 * When multiple server instances share a Redis backend, actions processed
 * on instance A need to be delivered to players connected on instance B.
 * State is already centralized in Redis (via RedisStore), so only the
 * in-memory connection delivery needs bridging.
 *
 * Flow:
 * 1. Instance A processes an action, saves state to Redis, publishes to channel
 * 2. Instance B (subscriber) receives the message on its local channel
 * 3. Instance B looks up its local connections for the room
 * 4. Instance B projects state per-player and delivers to local connections
 *
 * In single-instance mode (no REDIS_URL), PubSubManager is a no-op since
 * Room already broadcasts directly to local connections.
 */
export class PubSubManager {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private handlers: Map<string, (message: RoomBroadcastMessage) => void> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private logger: Logger = console;

  /**
   * @param injectedPublisher  optional pre-built publisher (e.g. a mock for tests).
   * @param injectedSubscriber optional pre-built subscriber (e.g. a mock for tests).
   */
  constructor(injectedPublisher?: Redis, injectedSubscriber?: Redis) {
    this.publisher = injectedPublisher ?? RedisStore.duplicateClient();
    if (this.publisher) {
      this.subscriber = injectedSubscriber ?? RedisStore.duplicateClient();
      this.setupSubscriber();
    }
  }

  public setLogger(logger: Logger) {
    this.logger = logger;
  }

  public get isAvailable(): boolean {
    return this.publisher !== null && this.subscriber !== null;
  }

  private setupSubscriber() {
    if (!this.subscriber) return;

    this.subscriber.on('message', (channel: string, message: string) => {
      const handler = this.handlers.get(channel);
      if (!handler) return;

      try {
        const parsed: RoomBroadcastMessage = JSON.parse(message);
        handler(parsed);
      } catch (err) {
        this.logger.log(`[PubSub] Failed to parse message on ${channel}: ${err}`);
      }
    });

    this.subscriber.on('error', (err: Error) => {
      this.logger.log(`[PubSub] Subscriber error: ${err.message}`);
    });
  }

  /**
   * Publish a state broadcast message to a room's Redis channel.
   * Called by Room after every successful reduce() + saveState().
   */
  publish(roomId: string, message: RoomBroadcastMessage): void {
    if (!this.publisher) return;

    const channel = `ps:room:${roomId}`;
    try {
      this.publisher.publish(channel, JSON.stringify(message));
    } catch (err) {
      this.logger.log(`[PubSub] Failed to publish to ${channel}: ${err}`);
    }
  }

  /**
   * Subscribe to a room's Redis channel. When messages arrive, the handler
   * is invoked with the raw state + events so it can project and deliver
   * to local connections.
   *
   * No-op if Redis is unavailable or already subscribed to this room.
   */
  subscribe(roomId: string, handler: (message: RoomBroadcastMessage) => void): void {
    if (!this.subscriber) return;

    const channel = `ps:room:${roomId}`;

    if (this.subscribedChannels.has(channel)) {
      this.handlers.set(channel, handler);
      return;
    }

    this.handlers.set(channel, handler);
    this.subscriber.subscribe(channel);
    this.subscribedChannels.add(channel);
  }

  /**
   * Unsubscribe from a room's Redis channel.
   * Called when the last local connection to a room is removed.
   */
  unsubscribe(roomId: string): void {
    if (!this.subscriber) return;

    const channel = `ps:room:${roomId}`;

    if (!this.subscribedChannels.has(channel)) return;

    this.handlers.delete(channel);
    this.subscriber.unsubscribe(channel);
    this.subscribedChannels.delete(channel);
  }

  /**
   * Clean up all subscriptions and close Redis connections.
   */
  async destroy(): Promise<void> {
    if (this.subscriber) {
      if (this.subscribedChannels.size > 0) {
        await this.subscriber.unsubscribe(...Array.from(this.subscribedChannels));
      }
      this.subscribedChannels.clear();
      this.handlers.clear();
      this.subscriber.disconnect();
      this.subscriber = null;
    }
    if (this.publisher) {
      this.publisher.disconnect();
      this.publisher = null;
    }
  }
}
