import type { IGameEngine, IGameState, IPlayerAction, IGameEvent } from '@packages/engine-core';
import type { IBotStrategy } from '@packages/ai';
import type { Room } from './Room';
import type { RoomManager } from './RoomManager';

type BotRoom = Room<IGameState, IPlayerAction, IGameEvent>;

/**
 * Drives server-side AI players. Every second it sweeps all live rooms and,
 * when the active seat is a bot, computes a move with that game's strategy and
 * dispatches it through the exact same `Room.dispatch` pipeline a human's
 * WebSocket message travels (validate → reduce → snapshot → broadcast).
 *
 * The action is re-validated with `engine.isValidAction` *before* dispatch as
 * a safety net: a strategy bug can never corrupt a game — worst case the move
 * is skipped and retried on the next tick. Strategies are per-game and pluggable.
 */
export class BotController {
  private strategies = new Map<string, IBotStrategy<IGameState, IPlayerAction, IGameEvent>>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly roomManager: Pick<RoomManager, 'allRooms'>) {}

  public registerStrategy(
    gameType: string,
    strategy: IBotStrategy<IGameState, IPlayerAction, IGameEvent>
  ): void {
    this.strategies.set(gameType, strategy);
  }

  public start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
    if (this.tickTimer.unref) {
      this.tickTimer.unref();
    }
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** Run one sweep over every live room. Exposed publicly for tests. */
  public tick(): void {
    for (const room of this.roomManager.allRooms()) {
      this.tickRoom(room as unknown as BotRoom);
    }
  }

  private tickRoom(room: BotRoom): void {
    const state = room.getState() as IGameState & {
      activePlayerId?: string;
      currentPlayerIndex?: number;
      players?: ReadonlyArray<{ id: string }>;
      status: string;
    };
    if (state.status !== 'IN_PROGRESS') return;

    // Cheap reject: no bots at all in this room, or a human is up.
    if (room.botSeats.size === 0) return;
    const activeId = state.activePlayerId ?? state.players?.[state.currentPlayerIndex ?? 0]?.id;
    if (!activeId || !room.isBot(activeId)) return;

    const strategy = this.strategies.get(room.gameType);
    if (!strategy) return;

    const engine = room.getEngine() as IGameEngine<IGameState, IPlayerAction, IGameEvent>;
    let action: IPlayerAction;
    try {
      action = strategy.decide(state, activeId, engine);
    } catch {
      // Defensive: a throwing strategy must never crash the sweep or kill the server.
      return;
    }

    // Safety net: only dispatch a move the engine accepts. If the strategy is
    // buggy, skip this tick (the next tick retries) instead of dispatching a
    // rejected action that would spam the (botless) rejection channel.
    if (!engine.isValidAction(state, action)) return;

    room.dispatch(action);
  }
}