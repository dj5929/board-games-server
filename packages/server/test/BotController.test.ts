import { describe, it, expect, vi, afterEach } from 'vitest';
import { RoomManager } from '../src/RoomManager';
import { Room } from '../src/Room';
import { BotController } from '../src/BotController';
import { MonopolyEngine } from '@packages/monopoly-engine';

// Deterministic rng that yields dice (1,3) = 4 on EVERY roll (no doubles), so
// the turn advances cleanly on END_TURN. The alternation is infinite because
// getInitialState's deck shuffles also consume rng calls.
function makeRng() {
  let i = 0;
  const values = [0.1, 0.4];
  return { next: () => values[i++ % values.length]! };
}

function makeBotRoom(id: string, botSeats: string[] = ['p2']) {
  return new Room(id, 'monopoly', MonopolyEngine as any, makeRng(), ['p1', 'p2'], undefined, {
    botSeats
  });
}

/** Advance a Monopoly room to p2's turn (p1 rolls no-doubles then ends). */
function advanceToBot(room: Room<any, any, any>) {
  room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
  room.dispatch({ type: 'END_TURN', playerId: 'p1' } as any);
  expect((room.getState() as any).currentPlayerIndex).toBe(1);
  expect((room.getState() as any).status).toBe('IN_PROGRESS');
}

describe('BotController', () => {
  afterEach(() => {
    // Restore any spies created in the tests.
    vi.restoreAllMocks();
  });

  it('does nothing for rooms with no bot in the active seat', () => {
    const manager = new RoomManager();
    manager.createRoom(makeBotRoom('human-turn'));

    const controller = new BotController(manager);
    const dispatchSpy = vi.spyOn(manager.getRoom('human-turn')!, 'dispatch');

    controller.tick();
    expect(dispatchSpy).not.toHaveBeenCalled();
    manager.stopCleanup();
  });

  it('dispatches the strategy action when a bot is the active player', () => {
    const manager = new RoomManager();
    const room = makeBotRoom('bot-turn');
    manager.createRoom(room);

    const decide = vi.fn(() => ({ type: 'ROLL_DICE', playerId: 'p2' }));
    const controller = new BotController(manager);
    controller.registerStrategy('monopoly', { decide } as any);

    advanceToBot(room);
    controller.tick();

    expect(decide).toHaveBeenCalledTimes(1);
    // The bot's ROLL_DICE went through the real dispatch pipeline.
    expect((room.getState() as any).players[1].hasRolled).toBe(true);
    manager.stopCleanup();
  });

  it('passes the authoritative state, acting id and real engine to the strategy', () => {
    const manager = new RoomManager();
    const room = makeBotRoom('bot-passing');
    manager.createRoom(room);

    let captured: { playerId?: string; state?: any; engine?: any } = {};
    const controller = new BotController(manager);
    controller.registerStrategy('monopoly', {
      decide: (state: any, playerId: string, engine: any) => {
        captured = { playerId, state, engine };
        return { type: 'ROLL_DICE', playerId };
      }
    } as any);

    advanceToBot(room);
    controller.tick();

    expect(captured.playerId).toBe('p2');
    expect(captured.engine?.isValidAction).toBeInstanceOf(Function);
    // House rule: strategy sees full state (engine used for legal-move exploration).
    expect(captured.state?.players).toHaveLength(2);
    manager.stopCleanup();
  });

  it('safety-skips an invalid strategy action instead of dispatching it', () => {
    const manager = new RoomManager();
    const room = makeBotRoom('bot-invalid');
    manager.createRoom(room);

    // END_TURN before rolling is illegal for p2; the controller must not dispatch.
    const controller = new BotController(manager);
    controller.registerStrategy('monopoly', {
      decide: () => ({ type: 'END_TURN', playerId: 'p2' })
    } as any);

    advanceToBot(room);
    const dispatchSpy = vi.spyOn(room, 'dispatch');

    controller.tick();

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect((room.getState() as any).players[1].hasRolled).toBe(false);
    manager.stopCleanup();
  });

  it('does nothing for rooms that are not in progress', () => {
    const manager = new RoomManager();
    // Fresh Monopoly room: status LOBBY, active player p1 (human) — bot inactive.
    manager.createRoom(makeBotRoom('lobby-room', ['p1', 'p2']));

    const controller = new BotController(manager);
    const dispatchSpy = vi.spyOn(manager.getRoom('lobby-room')!, 'dispatch');

    controller.tick();
    expect(dispatchSpy).not.toHaveBeenCalled();
    manager.stopCleanup();
  });

  it('tolerates a strategy that throws (defensive: never crashes the sweep)', () => {
    const manager = new RoomManager();
    const room = makeBotRoom('bot-throw');
    manager.createRoom(room);

    const controller = new BotController(manager);
    controller.registerStrategy('monopoly', {
      decide: () => { throw new Error('strategy bug'); }
    } as any);

    advanceToBot(room);
    // Hmm: advanceToBot dispatched via room.dispatch directly (not the controller),
    // so the controller has not seen the state change yet. Run tick — should not throw.
    expect(() => controller.tick()).not.toThrow();
    // And the game state is unchanged (no crash, no illegal dispatch).
    expect((room.getState() as any).players[1].hasRolled).toBe(false);
    manager.stopCleanup();
  });

  it('start/stop manages the interval lifecycle', () => {
    const manager = new RoomManager();
    const controller = new BotController(manager);

    vi.useFakeTimers();
    try {
      controller.start();
      expect((controller as any).tickTimer).not.toBeNull();
      const tickSpy = vi.spyOn(controller, 'tick');
      vi.advanceTimersByTime(3000);
      expect(tickSpy).toHaveBeenCalledTimes(3);

      controller.stop();
      vi.advanceTimersByTime(3000);
      expect(tickSpy).toHaveBeenCalledTimes(3);
      expect((controller as any).tickTimer).toBeNull();
    } finally {
      vi.useRealTimers();
      controller.stop();
    }
    manager.stopCleanup();
  });
});