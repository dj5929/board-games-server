import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
let redis: Redis | null = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
}

/**
 * Iterate all keys matching `pattern` using `SCAN` instead of `KEYS`.
 * `KEYS` is O(N) over the entire keyspace and blocks Redis while it runs;
 * `SCAN` returns results incrementally in small batches so the server never
 * blocks and memory use stays bounded even with tens of thousands of rooms.
 */
async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    keys.push(...batch);
    cursor = nextCursor;
  } while (cursor !== '0');
  return keys;
}

const inMemoryStore = new Map<string, string>();

// JSON cannot represent Infinity / NaN. Tag them so game-state snapshots
// (e.g. Monopoly's unlimited `bankMoney: Infinity`) survive a Redis round-trip.
const INFINITY_TAG = '__JSON_INFINITY__';
const NAN_TAG = '__JSON_NAN__';

export const redisReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return NAN_TAG;
    if (value === Infinity) return INFINITY_TAG;
    if (value === -Infinity) return `-${INFINITY_TAG}`;
  }
  return value;
};

export const redisReviver = (_key: string, value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value === NAN_TAG) return NaN;
    if (value === INFINITY_TAG) return Infinity;
    if (value === `-${INFINITY_TAG}`) return -Infinity;
  }
  return value;
};

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
      return scanKeys(redis, pattern);
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(inMemoryStore.keys()).filter(k => regex.test(k));
  },

  isRedisConnected(): boolean {
    return redis !== null;
  },

  duplicateClient(): Redis | null {
    if (redis) {
      return redis.duplicate();
    }
    return null;
  }
};
