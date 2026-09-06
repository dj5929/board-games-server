import { IGameEngine, IGameState, IPlayerAction, IGameEvent, IRandomProvider, playerId } from '@packages/engine-core';
import crypto from 'node:crypto';
import { RedisStore, redisReplacer } from './RedisStore';
import type { PubSubManager, RoomBroadcastMessage, ChatMessage } from './PubSubManager';

/** Hard cap on a single chat line. Longer messages are rejected before they
 *  are ever relayed, keeping the broadcast stream light and the log readable. */
export const MAX_CHAT_LENGTH = 500;

/** Build a validated ChatMessage from a raw inbound payload, or null when the
 *  payload is not a usable chat line (missing/blank/non-string/oversized text).
 *  The sender identity is supplied by the authenticated socket — never trusted
 *  from the client message itself. */
export function createChatMessage(
  raw: unknown,
  senderId: string,
  senderRole: 'player' | 'spectator',
  roomId: string
): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = (raw as { text?: unknown }).text;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CHAT_LENGTH) return null;
  return {
    id: crypto.randomUUID(),
    roomId,
    senderId,
    senderRole,
    text: trimmed,
    sentAt: Date.now()
  };
}

export interface IClientConnection {
  send(data: string): void;
  close?(): void;
}

/** Sentinel player id passed to `getStateForPlayer` for spectators. It never
 *  matches a real seat, so every engine produces its fully-hidden projection
 *  (Monopoly decks, Catan dev cards, Scotland Yard Mr. X position). */
export const SPECTATOR_PLAYER_ID = '__spectator__';

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
  /** Seats controlled by the server-side AI (`BotController`) rather than a
   *  human connection. Bot seats are never handed out to joining clients and
   *  never hold session tokens or WebSocket connections. */
  botSeats?: ReadonlyArray<string>;
  /** Rooms opted into the public browser directory (`GET /rooms`) so players
   *  can discover and join them from the Lobby without the room id. */
  isPublic?: boolean;
}

export class Room<S extends IGameState, A extends IPlayerAction, E extends IGameEvent> {
  private state: S;
  private connections: Map<string, IClientConnection> = new Map();
  /** Chat line ids this instance has already relayed. Room publishes to its own
   *  Redis channel (so other instances re-broadcast), and Redis delivers the
   *  message to the publishing instance's own subscriber too — this set lets the
   *  local instance skip that echo instead of double-delivering a line. */
  private recentChatIds: Set<string> = new Set();
  /** Spectators observe the game through the hidden-info projection. They never
   *  hold a seat, never receive a session token and can never dispatch actions.
   *  Spectator tokens are in-memory only: like connections, they evaporate on a
   *  server restart and are not part of the persisted Redis snapshot. */
  private spectatorConnections: Map<string, IClientConnection> = new Map();
  private spectatorTokens: Map<string, string> = new Map();
  private pubsub: PubSubManager | null = null;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  // Dirty-flag persistence: back-to-back saveState() calls (constructor write +
  // token issuance, connection events, every dispatch's state write) coalesce
  // into a single Redis write per microtask turn instead of N serialized writes.
  private dirty = false;
  private saveScheduled = false;
  private isRehydrated = false;
  public turnStartedAt: number;
  public readonly turnTimeLimitMs: number;
  public sessionTokens: Map<string, string> = new Map();
  public tokenIssuedAt: Map<string, number> = new Map();
  public disconnectedAt: Map<string, number> = new Map();
  public lastActivity: number;
  public readonly isHotSeat: boolean;
  public readonly ownerPlayerId: string | null;
  public readonly botSeats: ReadonlySet<string>;
  public readonly isPublic: boolean;

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
    this.botSeats = new Set(options.botSeats ?? []);
    this.isPublic = options.isPublic ?? false;
    this.isRehydrated = !!initialState;
    // Skip the redundant persistence write on the rehydrate path: loadState()
    // has just read this exact snapshot from the store, so writing it straight
    // back is wasted work. Fresh rooms do persist their initial snapshot.
    if (!this.isRehydrated) {
      this.saveState();
    }
  }

  /** True when the given id corresponds to a seat in this room's game state. */
  public hasPlayer(playerId: string): boolean {
    return this.state.players.some(p => p.id === playerId);
  }

  /** True when the given seat is controlled by the server-side AI. */
  public isBot(playerId: string): boolean {
    return this.botSeats.has(playerId);
  }

  /** The game engine this room is running (used by the AI to explore legal moves). */
  public getEngine(): IGameEngine<S, A, E> {
    return this.engine;
  }

  /**
   * Attach a PubSubManager so this room can receive a cross-instance
   * STATE_UPDATE / EVENTS streams and re-broadcast to local connections.
   * In single-instance mode this is null (messages delivered directly).
   */
  public setPubSub(pubsub: PubSubManager): void {
    this.pubsub = pubsub;
    if (this.connectionCount() > 0 && this.pubsub) {
      this.pubsub.subscribe(this.id, msg => this.deliverRemoteMessage(msg));
    }
  }

  /**
   * Persist the room's current snapshot. The first call in a scheduling tick
   * writes immediately (preserving ordering so a subsequent rehydration read
   * observes the write), while any further calls within the same tick are
   * coalesced into a single microtask flush — collapsing bursts (e.g. a room
   * creation whose constructor save is quickly followed by token issuance,
   * or several connection events) into one final Redis write.
   */
  public saveState() {
    if (this.saveScheduled) {
      // A write already happened this tick; fold the latest mutations into the
      // pending microtask flush instead of issuing another serialization.
      this.dirty = true;
      return;
    }
    this.saveScheduled = true;
    this.dirty = false;
    this.writeSnapshot();
    queueMicrotask(() => {
      this.saveScheduled = false;
      if (this.dirty) {
        this.dirty = false;
        this.writeSnapshot();
      }
    });
  }

  private writeSnapshot() {
    const data = {
      id: this.id,
      gameType: this.gameType,
      state: this.state,
      isHotSeat: this.isHotSeat,
      ownerPlayerId: this.ownerPlayerId,
      botSeats: Array.from(this.botSeats),
      isPublic: this.isPublic,
      turnStartedAt: this.turnStartedAt,
      turnTimeLimitMs: this.turnTimeLimitMs,
      sessionTokens: Array.from(this.sessionTokens.entries()),
      tokenIssuedAt: Array.from(this.tokenIssuedAt.entries()),
      disconnectedAt: Array.from(this.disconnectedAt.entries()),
      lastActivity: this.lastActivity
    };
    void RedisStore.set(`room:${this.id}`, JSON.stringify(data, redisReplacer));
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
    (this as { botSeats: ReadonlySet<string> }).botSeats = new Set(data.botSeats ?? []);
    (this as { isPublic: boolean }).isPublic = data.isPublic === true;
  }

  public getState(): S {
    return this.state;
  }

  public addConnection(playerId: string, connection: IClientConnection) {
    const existing = this.connections.get(playerId);
    if (existing && existing !== connection && typeof (existing as { close?: () => void }).close === 'function') {
      (existing as { close: () => void }).close();
    }
    const noPlayers = this.connections.size === 0;
    const noClients = this.connectionCount() === 0;
    this.connections.set(playerId, connection);
    if (noClients && this.pubsub) {
      this.pubsub.subscribe(this.id, msg => this.deliverRemoteMessage(msg));
    }
    if (noPlayers) {
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
      this.stopTurnTimer();
    }
    if (this.connectionCount() === 0 && this.pubsub) {
      this.pubsub.unsubscribe(this.id);
    }
    this.disconnectedAt.set(playerId, Date.now());
    this.saveState();
  }

  /** Number of live WebSocket connections (players + spectators) to this room. */
  private connectionCount(): number {
    return this.connections.size + this.spectatorConnections.size;
  }

  public addSpectatorConnection(spectatorId: string, connection: IClientConnection) {
    const existing = this.spectatorConnections.get(spectatorId);
    if (existing && existing !== connection && typeof (existing as { close?: () => void }).close === 'function') {
      (existing as { close: () => void }).close();
    }
    const noClients = this.connectionCount() === 0;
    this.spectatorConnections.set(spectatorId, connection);
    if (noClients && this.pubsub) {
      this.pubsub.subscribe(this.id, msg => this.deliverRemoteMessage(msg));
    }
    // Spectators are not persisted and do not extend the room's activity TTL
    // (lastActivity) — they merely observe the broadcast stream.
    this.broadcastState();
  }

  public removeSpectatorConnection(spectatorId: string) {
    this.spectatorConnections.delete(spectatorId);
    if (this.connectionCount() === 0 && this.pubsub) {
      this.pubsub.unsubscribe(this.id);
    } else if (this.connectionCount() > 0) {
      // Notify the remaining players/spectators that the live count changed.
      this.broadcastState();
    }
  }

  public closeAllConnections() {
    for (const conn of this.connections.values()) {
      if (typeof conn.close === 'function') {
        conn.close();
      }
    }
    this.connections.clear();
    for (const conn of this.spectatorConnections.values()) {
      if (typeof conn.close === 'function') {
        conn.close();
      }
    }
    this.spectatorConnections.clear();
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
   *  carries the raw authoritative state plus any events produced by the
   *  originating reduce(). We re-project per local player (state) and
   *  deliver (events), mirroring the local-instance broadcast ordering.
   */
  private deliverRemoteMessage(message: RoomBroadcastMessage) {
    // Chat-only broadcasts never carry state or events.
    if (message.chat) {
      if (this.recentChatIds.has(message.chat.id)) return;
      this.markChatDelivered(message.chat.id);
      this.broadcastChatRemote(message.chat);
      return;
    }
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
    for (const conn of this.spectatorConnections.values()) {
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

  /** Serialize a STATE_UPDATE message for one recipient. `stateForConn` is the
   *  per-player projection (or the raw state when an engine has no hidden info),
   *  and `spectatorCount` reports the live observer tally on this instance. */
  private stateMessage(stateForConn: S, timer: unknown): string {
    return JSON.stringify({
      type: 'STATE_UPDATE',
      state: stateForConn,
      timer,
      spectatorCount: this.spectatorConnections.size,
    });
  }

  private broadcastState() {
    const hasProjection = typeof this.engine.getStateForPlayer === 'function';
    const timer = this.timerMeta();
    if (!hasProjection) {
      // No hidden info: the full state is identical for every player, so
      // serialize ONCE and reuse the same payload string for all connections.
      const payload = this.stateMessage(this.state, timer);
      for (const conn of this.connections.values()) {
        conn.send(payload);
      }
      for (const conn of this.spectatorConnections.values()) {
        conn.send(payload);
      }
    } else {
      for (const [pid, conn] of this.connections.entries()) {
        const stateForPlayer = this.engine.getStateForPlayer!(this.state, playerId(pid));
        conn.send(this.stateMessage(stateForPlayer, timer));
      }
      // Spectators always receive the fully-hidden projection (a sentinel id
      // that can never match a real seat).
      const spectatorState = this.engine.getStateForPlayer!(this.state, playerId(SPECTATOR_PLAYER_ID));
      const payload = this.stateMessage(spectatorState, timer);
      for (const conn of this.spectatorConnections.values()) {
        conn.send(payload);
      }
    }
    if (this.pubsub) {
      this.pubsub.publish(this.id, { state: this.state, timer });
    }
  }

  private broadcastRemoteState(timer?: unknown) {
    const hasProjection = typeof this.engine.getStateForPlayer === 'function';
    const t = timer ?? this.timerMeta();
    if (!hasProjection) {
      const payload = this.stateMessage(this.state, t);
      for (const conn of this.connections.values()) {
        conn.send(payload);
      }
      for (const conn of this.spectatorConnections.values()) {
        conn.send(payload);
      }
    } else {
      for (const [pid, conn] of this.connections.entries()) {
        const stateForPlayer = this.engine.getStateForPlayer!(this.state, playerId(pid));
        conn.send(this.stateMessage(stateForPlayer, t));
      }
      const spectatorState = this.engine.getStateForPlayer!(this.state, playerId(SPECTATOR_PLAYER_ID));
      const payload = this.stateMessage(spectatorState, t);
      for (const conn of this.spectatorConnections.values()) {
        conn.send(payload);
      }
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
    for (const conn of this.spectatorConnections.values()) {
      conn.send(payload);
    }
    if (this.pubsub) {
      this.pubsub.publish(this.id, { state: this.state, events, timer: this.timerMeta() });
    }
  }

  /** Relay one chat line to every local player and spectator, then publish it on
   *  the room's channel so other server instances deliver it to their own
   *  connections. Chat never touches the game state or the event stream. */
  public broadcastChat(message: ChatMessage) {
    this.markChatDelivered(message.id);
    this.broadcastChatRemote(message);
    if (this.pubsub) {
      this.pubsub.publish(this.id, { chat: message });
    }
  }

  /** Re-broadcast a chat line coming from another server instance. */
  private broadcastChatRemote(message: ChatMessage) {
    const payload = JSON.stringify({ type: 'CHAT_MESSAGE', message });
    for (const conn of this.connections.values()) {
      conn.send(payload);
    }
    for (const conn of this.spectatorConnections.values()) {
      conn.send(payload);
    }
  }

  /** Remember that a chat line was already relayed on this instance, capping the
   *  set so a long session never balloons memory. */
  private markChatDelivered(id: string) {
    if (this.recentChatIds.size >= 200) {
      this.recentChatIds.clear();
    }
    this.recentChatIds.add(id);
  }

  public getAvailablePlayerId(): string | null {
    const allPlayerIds = this.state.players.map(p => p.id);
    for (const id of allPlayerIds) {
      // Bots occupy their seats permanently: never offer a bot seat to a joiner.
      if (this.botSeats.has(id)) continue;
      if (!this.connections.has(id) && !this.sessionTokens.has(id)) return id;
    }
    return null;
  }

  /** How many human seats are still claimable (not bot-owned, not yet claimed
   *  by a connection or a session token). Drives the room browser's "Join" state. */
  public openSeatCount(): number {
    let count = 0;
    for (const p of this.state.players) {
      if (this.botSeats.has(p.id)) continue;
      if (!this.connections.has(p.id) && !this.sessionTokens.has(p.id)) count++;
    }
    return count;
  }

  /** Live number of seated player connections (spectators excluded). */
  public playerConnectionCount(): number {
    return this.connections.size;
  }

  /** Live number of connected spectators. */
  public spectatorConnectionCount(): number {
    return this.spectatorConnections.size;
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

  /** Issue a one-time spectator credential. The pair is intentionally in-memory
   *  only — spectators vanish with the connections on a server restart. */
  public issueSpectatorToken(): { spectatorId: string; token: string } {
    const spectatorId = `spectator-${crypto.randomUUID()}`;
    const token = crypto.randomUUID();
    this.spectatorTokens.set(spectatorId, token);
    return { spectatorId, token };
  }

  public revokeSpectatorToken(spectatorId: string) {
    this.spectatorTokens.delete(spectatorId);
  }

  public verifySpectatorToken(spectatorId: string, token: string): boolean {
    return this.spectatorTokens.get(spectatorId) === token;
  }
}
