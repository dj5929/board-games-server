import { IGameEngine, IGameState, IPlayerAction, IGameEvent, IRandomProvider, playerId } from '@packages/engine-core';

export interface IClientConnection {
  send(data: string): void;
}

export class Room<S extends IGameState, A extends IPlayerAction, E extends IGameEvent> {
  private state: S;
  private connections: Map<string, IClientConnection> = new Map();
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
  }

  public getState(): S {
    return this.state;
  }

  public addConnection(playerId: string, connection: IClientConnection) {
    this.connections.set(playerId, connection);
    this.lastActivity = Date.now();
    this.broadcastState();
  }

  public removeConnection(playerId: string) {
    this.connections.delete(playerId);
  }

  public dispatch(action: A) {
    this.lastActivity = Date.now();
    if (!this.engine.isValidAction(this.state, action)) {
      return;
    }
    const result = this.engine.reduce(this.state, action, this.rng);
    if (!result.success) return;
    this.state = result.data.nextState;
    this.broadcastState();
    if (result.data.events.length > 0) {
      this.broadcastEvents(result.data.events);
    }
  }

  private broadcastState() {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: this.state });
    for (const conn of this.connections.values()) {
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
      if (!this.connections.has(id)) return id;
    }
    return null;
  }
}
