import { IGameEngine, IGameState, IPlayerAction, IGameEvent, IRandomProvider, playerId } from '@packages/engine-core';
import crypto from 'node:crypto';
import { RedisStore } from './RedisStore';

export interface IClientConnection {
  send(data: string): void;
  close?(): void;
}

export class Room<S extends IGameState, A extends IPlayerAction, E extends IGameEvent> {
  private state: S;
  private connections: Map<string, IClientConnection> = new Map();
  public sessionTokens: Map<string, string> = new Map();
  public tokenIssuedAt: Map<string, number> = new Map();
  public disconnectedAt: Map<string, number> = new Map();
  public lastActivity: number;

  constructor(
    public readonly id: string,
    public readonly gameType: string,
    private engine: IGameEngine<S, A, E>,
    private rng: IRandomProvider,
    initialPlayerIds: string[]
  ) {
    this.state = this.engine.getInitialState(initialPlayerIds.map(id => playerId(id)), this.rng);
    this.lastActivity = Date.now();
    this.saveState();
  }

  public async saveState() {
    const data = {
      id: this.id,
      gameType: this.gameType,
      state: this.state,
      sessionTokens: Array.from(this.sessionTokens.entries()),
      tokenIssuedAt: Array.from(this.tokenIssuedAt.entries()),
      disconnectedAt: Array.from(this.disconnectedAt.entries()),
      lastActivity: this.lastActivity
    };
    await RedisStore.set(`room:${this.id}`, JSON.stringify(data));
  }

  // Restore state from Redis (used by RoomManager)
  public loadState(data: any) {
    this.state = data.state;
    this.sessionTokens = new Map(data.sessionTokens);
    this.tokenIssuedAt = new Map(data.tokenIssuedAt || []);
    this.disconnectedAt = new Map(data.disconnectedAt || []);
    this.lastActivity = data.lastActivity;
  }

  public getState(): S {
    return this.state;
  }

  public addConnection(playerId: string, connection: IClientConnection) {
    const existing = this.connections.get(playerId);
    if (existing && existing !== connection && typeof (existing as { close?: () => void }).close === 'function') {
      (existing as { close: () => void }).close();
    }
    this.connections.set(playerId, connection);
    this.disconnectedAt.delete(playerId);
    this.lastActivity = Date.now();
    this.saveState();
    this.broadcastState();
  }

  public removeConnection(playerId: string) {
    this.connections.delete(playerId);
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
    this.saveState();
    this.broadcastState();
    if (result.data.events.length > 0) {
      this.broadcastEvents(result.data.events);
    }
  }

  private sendRejected(playerId: string, error: string) {
    const conn = this.connections.get(playerId);
    if (conn) {
      conn.send(JSON.stringify({ type: 'ACTION_REJECTED', error }));
    }
  }

  private broadcastState() {
    const hasProjection = typeof this.engine.getStateForPlayer === 'function';
    for (const [pid, conn] of this.connections.entries()) {
      const stateForPlayer = hasProjection
        ? this.engine.getStateForPlayer!(this.state, playerId(pid))
        : this.state;
      const payload = JSON.stringify({ type: 'STATE_UPDATE', state: stateForPlayer });
      conn.send(payload);
    }
  }

  private broadcastEvents(events: E[]) {
    const payload = JSON.stringify({ type: 'EVENTS', events });
    for (const conn of this.connections.values()) {
      conn.send(payload);
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
