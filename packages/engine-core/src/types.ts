export type Brand<K, T> = K & { __brand: T };
export type PlayerId = Brand<string, 'PlayerId'>;
export const playerId = (id: string) => id as PlayerId;

export type PropertyId = Brand<string, 'PropertyId'>;
export const propertyId = (id: string) => id as PropertyId;

export type Result<T, E> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Base types for game state
export interface IPlayer {
  id: PlayerId;
}

export interface IGameState {
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';
  readonly players: readonly IPlayer[];
}

// Base action that all games accept
export interface IPlayerAction {
  type: string;
  playerId: PlayerId;
}

// Base event that all games emit (e.g., for WebSocket broadcasting)
export interface IGameEvent {
  type: string;
}

// Result of a state transition
export interface IStateTransition<TState extends IGameState, TEvent extends IGameEvent> {
  nextState: TState;
  events: TEvent[];
}

// Random Number Generator interface (Rule 4: Invert Randomness)
export interface IRandomProvider {
  next(): number;
}
