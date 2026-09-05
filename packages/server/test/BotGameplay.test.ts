import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/RoomManager';
import { Room } from '../src/Room';
import { BotController } from '../src/BotController';
import { CatanBot, MonopolyBot, ScotlandYardBot } from '@packages/ai';
import { CatanEngine } from '@packages/catan-engine';
import { MonopolyEngine } from '@packages/monopoly-engine';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';

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

  it('a bot-vs-bot Scotland Yard game rotates through Mr X and two detectives', () => {
    const manager = new RoomManager();
    const room = new Room('sy-bots', 'scotland-yard', ScotlandYardEngine as any, makeRng(), ['p1', 'p2', 'p3'], undefined, {
      botSeats: ['p1', 'p2', 'p3']
    });
    manager.createRoom(room);

    const controller = new BotController(manager);
    controller.registerStrategy('scotland-yard', new ScotlandYardBot() as any);

    // Scotland Yard starts IN_PROGRESS with Mr X (p1) active.
    expect((room.getState() as any).status).toBe('IN_PROGRESS');
    expect((room.getState() as any).activePlayerId).toBe('p1');

    // tick 1: Mr X flees (p1 → next player).
    controller.tick();
    expect((room.getState() as any).activePlayerId).toBe('p2');

    // tick 2-3: detectives p2 and p3 chase, handing play back to Mr X.
    controller.tick();
    expect((room.getState() as any).activePlayerId).toBe('p3');
    controller.tick();
    expect((room.getState() as any).activePlayerId).toBe('p1');

    // tick 4: a full round done — Mr X has logged a move each time he was up.
    controller.tick();
    const state = room.getState() as any;
    expect(state.activePlayerId).toBe('p2');
    expect(state.mrXLog.length).toBe(2);

    manager.stopCleanup();
  });

  it('a bot-vs-bot Catan game completes initial placement and keeps the turn loop alive', () => {
    const manager = new RoomManager();
    const room = new Room('catan-bots', 'catan', CatanEngine as any, makeRng(), ['p1', 'p2', 'p3'], undefined, {
      botSeats: ['p1', 'p2', 'p3']
    });
    manager.createRoom(room);

    const controller = new BotController(manager);
    controller.registerStrategy('catan', new CatanBot() as any);

    // Catan starts IN_PROGRESS in initial placement 1 with the first player active.
    let state = room.getState() as any;
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.turnPhase).toBe('INITIAL_PLACEMENT_1');
    expect(state.activePlayerId).toBe('p1');

// Initial placement: 3 players × 2 rounds × (settlement + road) = 12 actions.
    // Every placement must be mechanically legal (distance rule / road contact),
    // so the controller advances one action per tick without a single skip.
    for (let i = 0; i < 12; i++) {
      controller.tick();
    }
    state = room.getState() as any;
    expect(state.turnPhase).toBe('MAIN_TURN');
    // The round-2 starter (last phase-1 player) takes the first main turn.
    expect(state.activePlayerId).toBe('p3');
    expect(Object.values(state.board.vertices).filter((v: any) => v.owner).length).toBe(6);
    expect(Object.values(state.board.edges).filter((e: any) => e.owner).length).toBe(6);
    for (const p of state.players) {
      expect(p.resources).toEqual({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 });
    }

    // First MAIN_TURN: p3 rolls (deterministic total 4), then eventually ends its
    // turn — it may buy a cheap dev card first if the roll put resources in hand.
    controller.tick();
    expect((room.getState() as any).activePlayerId).toBe('p3');
    expect((room.getState() as any).hasRolled).toBe(true);

    let guard = 0;
    while ((room.getState() as any).activePlayerId === 'p3' && guard < 10) {
      controller.tick();
      guard++;
    }
    expect((room.getState() as any).activePlayerId).not.toBe('p3');

    // Over many more ticks the active seat keeps rotating through all three
    // bots — no player ever stalls (a stalled Catan bot would pin the loop).
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      controller.tick();
      const id = (room.getState() as any).activePlayerId;
      if (!seen.includes(id)) seen.push(id);
    }
    expect(seen).toContain('p1');
    expect(seen).toContain('p2');
    expect(seen).toContain('p3');

    manager.stopCleanup();
  });
});