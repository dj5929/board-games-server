export type GameType = 'monopoly' | 'catan' | 'scotland-yard';

export interface GameConfig {
  readonly id: GameType;
  readonly label: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  'monopoly': {
    id: 'monopoly',
    label: 'Monopoly',
    minPlayers: 2,
    maxPlayers: 8
  },
  'catan': {
    id: 'catan',
    label: 'Catan',
    minPlayers: 3,
    maxPlayers: 4
  },
  'scotland-yard': {
    id: 'scotland-yard',
    label: 'Scotland Yard',
    minPlayers: 3,
    maxPlayers: 6
  }
};

export function isGameType(value: string): value is GameType {
  return value in GAME_CONFIGS;
}
