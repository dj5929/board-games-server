import { IRandomProvider } from './types';

/**
 * Fisher-Yates shuffle: returns a new shuffled copy of the array.
 * Uses the injected RNG for deterministic testing (Architecture Rule 4).
 */
export function shuffleArray<T>(array: readonly T[], rng: IRandomProvider): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
