import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../src/RoomManager';
import { Room } from '../src/Room';
import { MonopolyEngine } from '@packages/monopoly-engine';

function makeRoom(id: string) {
  return new Room(id, 'monopoly', MonopolyEngine as any, { next: () => 0.5 }, ['p1', 'p2']);
}

describe('RoomManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates, retrieves, counts and removes rooms', () => {
    const manager = new RoomManager();
    manager.createRoom(makeRoom('a'));
    manager.createRoom(makeRoom('b'));
    expect(manager.roomCount).toBe(2);
    expect(manager.getRoom('a')?.id).toBe('a');
    expect(manager.getRoom('missing')).toBeUndefined();
    manager.removeRoom('a');
    expect(manager.roomCount).toBe(1);
    expect(manager.getRoom('a')).toBeUndefined();
    manager.stopCleanup();
  });

  it('garbage-collects idle rooms on the periodic cleanup tick', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const manager = new RoomManager();
    const active = makeRoom('active');
    const stale = makeRoom('stale');
    manager.createRoom(active);
    manager.createRoom(stale);

    stale.lastActivity = Date.now() - 31 * 60 * 1000;

    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(manager.getRoom('stale')).toBeUndefined();
    expect(manager.getRoom('active')).toBeDefined();
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
    manager.stopCleanup();
  });

  it('closes the sockets of an idle room during cleanup (MED-1)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const manager = new RoomManager();
    const stale = makeRoom('stale');
    manager.createRoom(stale);

    const close = vi.fn();
    (stale as any).addConnection('p1', { send: vi.fn(), close });

    stale.lastActivity = Date.now() - 31 * 60 * 1000;

    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(manager.getRoom('stale')).toBeUndefined();
    expect(close).toHaveBeenCalled();
    logSpy.mockRestore();
    manager.stopCleanup();
  });

  it('rejects room creation beyond the capacity limit (MED-3)', () => {
    const manager = new RoomManager();
    let threw = false;
    (manager as any).rooms.clear();
    // Place the map at capacity
    (manager as any).rooms = new Map(
      Array.from({ length: 10000 }, (_, i) => [`room${i}`, makeRoom(`room${i}`)])
    );
    try {
      manager.createRoom(makeRoom('overflow'));
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(manager.roomCount).toBe(10000);
    manager.stopCleanup();
  });

  it('keeps rooms that are still active', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const manager = new RoomManager();
    manager.createRoom(makeRoom('fresh'));

    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(manager.getRoom('fresh')).toBeDefined();
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    manager.stopCleanup();
  });

  it('stops the cleanup timer on stopCleanup', () => {
    const manager = new RoomManager();
    expect((manager as any).cleanupTimer).not.toBeNull();
    manager.stopCleanup();
    expect((manager as any).cleanupTimer).toBeNull();
  });

  it('rehydrates rooms from the store without re-running initial state (regression: empty player list threw)', async () => {
    // Create a room (2 players = valid Monopoly min). Its constructor persists a
    // snapshot to the store. Capture the state so we can assert it's restored.
    const source = makeRoom('restore-me');
    const expectedState = source.getState();

    const manager = new RoomManager();
    await manager.initFromRedis({ monopoly: MonopolyEngine } as any);

    const restored = manager.getRoom('restore-me');
    expect(restored).toBeDefined();
    expect(restored?.getState()).toEqual(expectedState);

    // Regression: Monopoly's unlimited bank must survive the JSON round-trip
    // (JSON.stringify turns Infinity into null without the tagged replacer/reviver).
    const restoredState = restored?.getState() as { bankMoney?: unknown };
    expect(restoredState.bankMoney).toBe(Infinity);
    manager.stopCleanup();
  });
});