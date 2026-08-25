"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicRNG = void 0;
/**
 * Shared DeterministicRNG for all engine tests.
 *
 * - `values` are cycled through in order. When the list is exhausted
 *   it wraps back to the start.
 * - If no values are provided, `next()` always returns 0.
 */
class DeterministicRNG {
    values;
    index = 0;
    constructor(values = [0]) {
        this.values = values;
    }
    next() {
        const val = this.values[this.index % this.values.length];
        this.index++;
        return val;
    }
    /** Reset the counter so the same sequence can be replayed. */
    reset() {
        this.index = 0;
    }
}
exports.DeterministicRNG = DeterministicRNG;
