import type { PlayerId, IPlayer, IGameState } from '@packages/engine-core';

export type TransportType = 'taxi' | 'bus' | 'underground' | 'secret';
export type PlayerRole = 'MR_X' | 'DETECTIVE';
export type GameStatus = 'IN_PROGRESS' | 'FINISHED';

export interface ScotlandYardPlayer extends IPlayer {
  id: PlayerId;
  role: PlayerRole;
  position: number;
  tickets: Record<TransportType, number> & { double?: number };
}

export interface ScotlandYardState extends IGameState {
  players: readonly ScotlandYardPlayer[];
  playerOrder: PlayerId[]; // Includes Mr X at index 0
  activePlayerId: PlayerId;
  currentTurn: number; // Max 24
  mrXLog: TransportType[];
  mrXRevealedTurns: number[]; // e.g. [3, 8, 13, 18, 24]
  status: GameStatus;
  winner?: PlayerRole;
}

export type ScotlandYardAction = 
  | { type: 'MOVE'; playerId: PlayerId; payload: { targetNode: number; ticketType: TransportType } }
  | { type: 'DOUBLE_MOVE'; playerId: PlayerId; payload: { move1: { targetNode: number; ticketType: TransportType }, move2: { targetNode: number; ticketType: TransportType } } };

export type ScotlandYardEvent = 
  | { type: 'PLAYER_MOVED'; payload: { playerId: PlayerId; targetNode?: number | undefined; ticketType: TransportType } }
  | { type: 'GAME_OVER'; payload: { winner: PlayerRole; reason: string } };
