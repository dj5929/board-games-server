import type { IGameState, IPlayerAction, IGameEvent, IStateTransition, IRandomProvider, Result, PlayerId } from './types';

export interface IGameEngine<
  TState extends IGameState,
  TAction extends IPlayerAction,
  TEvent extends IGameEvent
> {
  // Generates the initial game state
  getInitialState(playerIds: PlayerId[], rng: IRandomProvider): TState;

  // Pure function for state transitions: (State, Action) => { State, Events }
  // RNG is injected here to keep logic deterministic and pure.
  reduce(currentState: Readonly<TState>, action: Readonly<TAction>, rng: IRandomProvider): Result<IStateTransition<TState, TEvent>, string>;

  // Validates if an action is legal in the current state
  isValidAction(currentState: Readonly<TState>, action: Readonly<TAction>): boolean;

  // Optional per-player projection of the authoritative state. Engines that
  // have hidden information (e.g. Scotland Yard's Mr. X location) implement
  // this so the server can broadcast a scrubbed view to each connection.
  // Returning the state unchanged is equivalent to not implementing it.
  getStateForPlayer?(currentState: Readonly<TState>, playerId: PlayerId): TState;
}
