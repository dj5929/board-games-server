import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
let redis: Redis | null = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
}

const inMemoryStore = new Map<string, string>();

export const RedisStore = {
  async set(key: string, value: string): Promise<void> {
    if (redis) {
      await redis.set(key, value);
    } else {
      inMemoryStore.set(key, value);
    }
  },

  async get(key: string): Promise<string | null> {
    if (redis) {
      return redis.get(key);
    }
    return inMemoryStore.get(key) || null;
  },

  async del(key: string): Promise<void> {
    if (redis) {
      await redis.del(key);
    } else {
      inMemoryStore.delete(key);
    }
  },

  async getKeys(pattern: string): Promise<string[]> {
    if (redis) {
      return redis.keys(pattern);
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(inMemoryStore.keys()).filter(k => regex.test(k));
  },

  isRedisConnected(): boolean {
    return redis !== null;
  }
};
