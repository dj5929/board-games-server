import { IGameEngine, IGameEvent, IGameState, IPlayerAction } from '@packages/engine-core';

/**
 * A server-side player strategy. Given the *full* authoritative state (the
 * strategy may call `engine.reduce` to simulate consequences), the acting
 * player's id, and the room's engine, it produces a single legal action.
 *
 * The invocation site (`BotController`) re-validates the returned action via
 * `engine.isValidAction` before dispatching, so a strategy bug can never
 * corrupt a game — worst case the move is safely skipped.
 */
export interface IBotStrategy<
  TState extends IGameState = IGameState,
  TAction extends IPlayerAction = IPlayerAction,
  TEvent extends IGameEvent = IGameEvent
> {
  decide(
    state: TState,
    playerId: string,
    engine: IGameEngine<TState, TAction, TEvent>
  ): TAction;
}