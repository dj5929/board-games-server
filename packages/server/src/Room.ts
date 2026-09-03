import { IGameEngine, IGameState, IPlayerAction, IGameEvent, IRandomProvider, playerId } from '@packages/engine-core';
import crypto from 'node:crypto';
import { RedisStore, redisReplacer } from './RedisStore';
import type { PubSubManager, RoomBroadcastMessage } from './PubSubManager';

export interface IClientConnection {
  send(data: string): void;
  close?(): void;
}

export interface IRoomOptions {
  /** Hot-seat rooms are played from a single shared browser. The room's owner
   *  session is then allowed to dispatch actions for *any* seat, because all
   *  seats belong to the same physical screen. Online rooms keep one-seat-one-token. */
  isHotSeat?: boolean;
  /** The seat whose session may act for every seat in a hot-seat room
   *  (normally the room's creator, i.e. `p1`). */
  ownerPlayerId?: string | null;
  /** Turn time limit in ms. When the active player exceeds it, their turn is
   *  force-advanced (FORCE_END_TURN / SKIP_TURN). 0 or undefined disables. */
  turnTimeLimitMs?: number;
}

export class Room<S extends IGameState, A extends IPlayerAction, E extends IGameEvent> {
  private state: S;
  private connections: Map<string, IClientConnection> = new Map();
  private pubsub: PubSubManager | null = null;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  public turnStartedAt: number;
  public readonly turnTimeLimitMs: number;
  public sessionTokens: Map<string, string> = new Map();
  public tokenIssuedAt: Map<string, number> = new Map();
  public disconnectedAt: Map<string, number> = new Map();
  public lastActivity: number;
  public readonly isHotSeat: boolean;
  public readonly ownerPlayerId: string | null;

  constructor(
    public readonly id: string,
    public readonly gameType: string,
    private engine: IGameEngine<S, A, E>,
    private rng: IRandomProvider,
    initialPlayerIds: string[],
    initialState?: S,
    options: IRoomOptions = {}
  ) {
    this.state = initialState ?? this.engine.getInitialState(initialPlayerIds.map(id => playerId(id)), this.rng);
    this.lastActivity = Date.now();
    this.turnStartedAt = this.lastActivity;
    this.turnTimeLimitMs = options.turnTimeLimitMs ?? 0;
    this.isHotSeat = options.isHotSeat ?? false;
    this.ownerPlayerId = options.ownerPlayerId ?? null;
    this.saveState();
  }

  /** True when the given id corresponds to a seat in this room's game state. */
  public hasPlayer(playerId: string): boolean {
    return this.state.players.some(p => p.id === playerId);
  }

  /**
   * Attach a PubSubManager so this room can receive a cross-instance
   * STATE_UPDATE / EVENTS streams and re-broadcast to local connections.
   * In single-instance mode this is null (messages delivered directly).
   */
  public setPubSub(pubsub: PubSubManager): void {
    this.pubsub = pubsub;
    if (this.connections.size > 0 && this.pubsub) {
      this.pubsub.subscribe(this.id, msg => this.deliverRemoteMessage(msg));
    }
  }

  public async saveState() {
    const data = {
      id: this.id,
      gameType: this.gameType,
      state: this.state,
      isHotSeat: this.isHotSeat,
      ownerPlayerId: this.ownerPlayerId,
      turnStartedAt: this.turnStartedAt,
      turnTimeLimitMs: this.turnTimeLimitMs,
      sessionTokens: Array.from(this.sessionTokens.entries()),
      tokenIssuedAt: Array.from(this.tokenIssuedAt.entries()),
      disconnectedAt: Array.from(this.disconnectedAt.entries()),
      lastActivity: this.lastActivity
    };
    await RedisStore.set(`room:${this.id}`, JSON.stringify(data, redisReplacer));
  }

  // Restore state from Redis (used by RoomManager)
  public loadState(data: any) {
    this.state = data.state;
    this.sessionTokens = new Map(data.sessionTokens);
    this.tokenIssuedAt = new Map(data.tokenIssuedAt || []);
    this.disconnectedAt = new Map(data.disconnectedAt || []);
    this.lastActivity = data.lastActivity;
    this.turnStartedAt = data.turnStartedAt ?? this.turnStartedAt;
    // `isHotSeat`/`ownerPlayerId` are `readonly` fields set by the constructor,
    // so restore them via the optional snapshot-backed constructor values
    // (see RoomManager.initFromRedis) rather than direct reassignment.
    (this as { isHotSeat: boolean }).isHotSeat = data.isHotSeat === true;
    (this as { ownerPlayerId: string | null }).ownerPlayerId = data.ownerPlayerId ?? null;
  }

  public getState(): S {
    return this.state;
  }

  public addConnection(playerId: string, connection: IClientConnection) {
    const existing = this.connections.get(playerId);
    if (existing && existing !== connection && typeof (existing as { close?: () => void }).close === 'function') {
      (existing as { close: () => void }).close();
    }
    const wasEmpty = this.connections.size === 0;
    this.connections.set(playerId, connection);
    if (wasEmpty && this.pubsub) {
      this.pubsub.subscribe(this.id, msg => this.deliverRemoteMessage(msg));
    }
    if (wasEmpty) {
      this.startTurnTimer();
    }
    this.disconnectedAt.delete(playerId);
    this.lastActivity = Date.now();
    this.saveState();
    this.broadcastState();
  }

  public removeConnection(playerId: string) {
    this.connections.delete(playerId);
    if (this.connections.size === 0) {
      if (this.pubsub) {
        this.pubsub.unsubscribe(this.id);
      }
      this.stopTurnTimer();
    }
    this.disconnectedAt.set(playerId, Date.now());
    this.saveState();
  }

  public closeAllConnections() {
    for (const conn of this.connections.values()) {
      if (typeof conn.close === 'function') {
        conn.close();
      }
    }
    this.connections.clear();
    this.stopTurnTimer();
    if (this.pubsub) {
      this.pubsub.unsubscribe(this.id);
    }
  }

  /**
   * Start the per-room turn timer. It ticks every second and force-advances
   * the active player's turn once it exceeds `turnTimeLimitMs`.
   */
  private startTurnTimer() {
    if (this.turnTimer || this.turnTimeLimitMs <= 0) return;
    this.turnTimer = setInterval(() => this.checkTurnTimeout(), 1000);
    if (this.turnTimer.unref) {
      this.turnTimer.unref();
    }
  }

  private stopTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /**
   * Called every second. If the active player has exceeded the turn time limit,
   * dispatch the game-appropriate forced-turn action. On a successful dispatch
   * the timer is re-armed inside `dispatch`; on a rejected force (e.g. Catan is
   * in a sub-phase like ROBBER_PLACEMENT) we re-arm here so we do not spam.
   */
  private checkTurnTimeout() {
    if (this.turnTimeLimitMs <= 0) return;
    const state = this.state as unknown as { status?: string; activePlayerId?: string; currentPlayerIndex?: number; players?: ReadonlyArray<{ id: string; status?: string }>; turnPhase?: string };
    // Only enforce the timer while a game is actively in progress; otherwise
    // (lobby, finished) never force a turn. The timer itself is kept alive by
    // the connection lifecycle (started on first connection, stopped on last).
    if (!state || (state.status && state.status !== 'IN_PROGRESS')) {
      return;
    }
    if (this.connections.size === 0) {
      this.stopTurnTimer();
      return;
    }
    if (Date.now() - this.turnStartedAt < this.turnTimeLimitMs) return;

    const activeId = state.activePlayerId ?? (state.players && state.players[state.currentPlayerIndex || 0]?.id);

    // Catan: only force during MAIN_TURN (sub-phases are mandatory and must not
    // be auto-advanced; the reducer also rejects FORCE_END_TURN there).
    if (this.gameType === 'catan' && state.turnPhase && state.turnPhase !== 'MAIN_TURN') {
      this.turnStartedAt = Date.now();
      return;
    }

    if (!activeId) {
      this.turnStartedAt = Date.now();
      return;
    }

    let forcedAction: unknown;
    if (this.gameType === 'monopoly' || this.gameType === 'catan') {
      forcedAction = { type: 'FORCE_END_TURN', playerId: activeId };
    } else if (this.gameType === 'scotland-yard') {
      forcedAction = { type: 'SKIP_TURN', playerId: activeId };
    } else {
      this.turnStartedAt = Date.now();
      return;
    }

    const beforeState = this.state;
    this.dispatch(forcedAction as A);
    // If the force did not change the turn (rejected), re-arm to avoid spam.
    if (this.state === beforeState) {
      this.turnStartedAt = Date.now();
    }
  }

  public dispatch(action: A) {
    this.lastActivity = Date.now();
    if (!this.engine.isValidAction(this.state, action)) {
      this.sendRejected(action.playerId, 'INVALID_ACTION');
      return;
    }
    const result = this.engine.reduce(this.state, action, this.rng);
    if (!result.success) {
      this.sendRejected(action.playerId, result.error);
      return;
    }
    this.state = result.data.nextState;
    this.turnStartedAt = Date.now();
    this.saveState();
    this.broadcastState();
    if (result.data.events.length > 0) {
      this.broadcastEvents(result.data.events);
    }
  }

  /**
   * Deliver a message published by a remote server instance. The message
   * carries the raw authoritative state plus any events produced by the
   * originating reduce(). We re-project per local player (state) and
   * deliver (events), mirroring the local-instance broadcast ordering.
   */
  private deliverRemoteMessage(message: RoomBroadcastMessage) {
    this.state = message.state as S;
    if (message.events && message.events.length > 0) {
      this.broadcastRemoteState(message.timer);
      this.broadcastRemoteEvents(message.events as E[]);
    } else {
      this.broadcastRemoteState(message.timer);
    }
  }

  private broadcastRemoteEvents(events: E[]) {
    const payload = JSON.stringify({ type: 'EVENTS', events });
    for (const conn of this.connections.values()) {
      conn.send(payload);
    }
  }

  private sendRejected(playerId: string, error: string) {
    let conn = this.connections.get(playerId);
    if (!conn && this.isHotSeat && this.ownerPlayerId) {
      conn = this.connections.get(this.ownerPlayerId);
    }
    if (conn && typeof conn.send === 'function') {
      conn.send(JSON.stringify({ type: 'ACTION_REJECTED', error }));
    }
  }

  private broadcastState() {
    const hasProjection = typeof this.engine.getStateForPlayer === 'function';
    const timer = this.timerMeta();
    for (const [pid, conn] of this.connections.entries()) {
      const stateForPlayer = hasProjection
        ? this.engine.getStateForPlayer!(this.state, playerId(pid))
        : this.state;
      const payload = JSON.stringify({ type: 'STATE_UPDATE', state: stateForPlayer, timer });
      conn.send(payload);
    }
    if (this.pubsub) {
      this.pubsub.publish(this.id, { state: this.state, timer });
    }
  }

  private broadcastRemoteState(timer?: unknown) {
    const hasProjection = typeof this.engine.getStateForPlayer === 'function';
    const t = timer ?? this.timerMeta();
    for (const [pid, conn] of this.connections.entries()) {
      const stateForPlayer = hasProjection
        ? this.engine.getStateForPlayer!(this.state, playerId(pid))
        : this.state;
      const payload = JSON.stringify({ type: 'STATE_UPDATE', state: stateForPlayer, timer: t });
      conn.send(payload);
    }
  }

  private timerMeta() {
    return {
      turnStartedAt: this.turnStartedAt,
      turnTimeLimitMs: this.turnTimeLimitMs
    };
  }

  private broadcastEvents(events: E[]) {
    const payload = JSON.stringify({ type: 'EVENTS', events });
    for (const conn of this.connections.values()) {
      conn.send(payload);
    }
    if (this.pubsub) {
      this.pubsub.publish(this.id, { state: this.state, events, timer: this.timerMeta() });
    }
  }

  public getAvailablePlayerId(): string | null {
    const allPlayerIds = this.state.players.map(p => p.id);
    for (const id of allPlayerIds) {
      if (!this.connections.has(id) && !this.sessionTokens.has(id)) return id;
    }
    return null;
  }

  public issueSessionToken(playerId: string): string {
    const token = crypto.randomUUID();
    this.sessionTokens.set(playerId, token);
    this.tokenIssuedAt.set(playerId, Date.now());
    this.saveState();
    return token;
  }

  public revokeSessionToken(playerId: string) {
    this.sessionTokens.delete(playerId);
    this.tokenIssuedAt.delete(playerId);
    this.saveState();
  }

  public verifySessionToken(playerId: string, token: string): boolean {
    return this.sessionTokens.get(playerId) === token;
  }
}
