import { IRandomProvider } from '../src/types';

/**
 * Shared DeterministicRNG for all engine tests.
 *
 * - `values` are cycled through in order. When the list is exhausted
 *   it wraps back to the start.
 * - If no values are provided, `next()` always returns 0.
 */
export class DeterministicRNG implements IRandomProvider {
  private index = 0;

  constructor(private values: number[] = [0]) {}

  next(): number {
    const val = this.values[this.index % this.values.length]!;
    this.index++;
    return val;
  }

  /** Reset the counter so the same sequence can be replayed. */
  reset(): void {
    this.index = 0;
  }
}
