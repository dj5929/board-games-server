import { playerId } from '../src/types';
import { describe, it, expect } from 'vitest';
import { IPlayer } from '../src/types';

describe('Engine Core Types', () => {
  it('should allow creating objects satisfying IPlayer', () => {
    const player: IPlayer = { id: playerId('p1') };
    expect(player.id).toBe('p1');
  });
});
