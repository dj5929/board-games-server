import { describe, it, expect, vi, afterEach } from 'vitest';
import { PubSubManager } from '../src/PubSubManager';
import RedisMock from 'ioredis-mock';

function makeClient(): any {
  return new RedisMock();
}

describe('PubSubManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a safe no-op when Redis is unavailable', () => {
    // No REDIS_URL -> RedisStore.duplicateClient() returns null, so the
    // manager has no publisher/subscriber and everything is a no-op.
    const mgr = new PubSubManager();
    expect(mgr.isAvailable).toBe(false);
    expect(() => mgr.publish('r1', { state: { a: 1 } })).not.toThrow();
    const handler = vi.fn();
    expect(() => mgr.subscribe('r1', handler)).not.toThrow();
    expect(() => mgr.unsubscribe('r1')).not.toThrow();
    return mgr.destroy();
  });

  it('publishes and delivers a state message to subscribers on the same channel', async () => {
    // Two separate PubSubManagers acting as two server instances sharing one
    // Redis backend: instance A publishes, instance B receives via the channel.
    const sharedA = makeClient();
    const sharedB = makeClient();
    const publisherA = new PubSubManager(sharedA, makeClient());
    const subscriberB = new PubSubManager(makeClient(), sharedB);

    const received: any[] = [];
    subscriberB.subscribe('room-1', msg => received.push(msg));

    // Wait for the subscribe to register on the mock before publishing.
    await new Promise(r => setTimeout(r, 20));

    publisherA.publish('room-1', { state: { turn: 3 }, events: [{ type: 'DICE_ROLLED' }] });

    await new Promise(r => setTimeout(r, 30));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ state: { turn: 3 }, events: [{ type: 'DICE_ROLLED' }] });

    await publisherA.destroy();
    await subscriberB.destroy();
  });

  it('does not deliver messages for channels with no matching subscription', async () => {
    const sharedA = makeClient();
    const sharedB = makeClient();
    const publisherA = new PubSubManager(sharedA, makeClient());
    const subscriberB = new PubSubManager(makeClient(), sharedB);

    const received: any[] = [];
    subscriberB.subscribe('room-1', msg => received.push(msg));

    await new Promise(r => setTimeout(r, 20));

    publisherA.publish('room-other', { state: {} });

    await new Promise(r => setTimeout(r, 30));

    expect(received).toHaveLength(0);

    await publisherA.destroy();
    await subscriberB.destroy();
  });

  it('unsubscribes a room so later publishes are ignored', async () => {
    const sharedA = makeClient();
    const sharedB = makeClient();
    const publisherA = new PubSubManager(sharedA, makeClient());
    const subscriberB = new PubSubManager(makeClient(), sharedB);

    const received: any[] = [];
    subscriberB.subscribe('room-1', msg => received.push(msg));

    await new Promise(r => setTimeout(r, 20));

    publisherA.publish('room-1', { state: { v: 1 } });
    await new Promise(r => setTimeout(r, 30));
    expect(received).toHaveLength(1);

    subscriberB.unsubscribe('room-1');
    await new Promise(r => setTimeout(r, 20));

    publisherA.publish('room-1', { state: { v: 2 } });
    await new Promise(r => setTimeout(r, 30));

    expect(received).toHaveLength(1);

    await publisherA.destroy();
    await subscriberB.destroy();
  });
});
