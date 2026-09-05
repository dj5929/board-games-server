import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/RoomManager';
import { Room } from '../src/Room';
import { BotController } from '../src/BotController';
import { MonopolyBot } from '@packages/ai';
import { MonopolyEngine } from '@packages/monopoly-engine';

// Dice (1,3) = 4 on every roll — deterministic, no doubles, clean turn flow.
function makeRng() {
  let i = 0;
  const values = [0.1, 0.4];
  return { next: () => values[i++ % values.length]! };
}

describe('Bot gameplay', () => {
  it('a bot-vs-bot Monopoly game advances through full turns via the real strategy', () => {
    const manager = new RoomManager();
    const room = new Room('bot-bot', 'monopoly', MonopolyEngine as any, makeRng(), ['p1', 'p2'], undefined, {
      botSeats: ['p1', 'p2']
    });
    manager.createRoom(room);

    const controller = new BotController(manager);
    controller.registerStrategy('monopoly', new MonopolyBot() as any);

    // The controller only drives rooms already IN_PROGRESS; in production a
    // human seat's first action (here simulated) leaves the LOBBY.
    room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
    expect((room.getState() as any).status).toBe('IN_PROGRESS');

    // tick 1: p1 has nothing to spend on, so it ends its turn.
    controller.tick();
    let state = room.getState() as any;
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[0].hasRolled).toBe(false);

    // tick 2: p2 rolls.
    controller.tick();
    state = room.getState() as any;
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[1].hasRolled).toBe(true);

    // tick 3: p2 ends its turn, handing play back to p1.
    controller.tick();
    state = room.getState() as any;
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[1].hasRolled).toBe(false);

    // tick 4: p1 rolls again — the loop is alive.
    controller.tick();
    state = room.getState() as any;
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[0].hasRolled).toBe(true);

    manager.stopCleanup();
  });
});