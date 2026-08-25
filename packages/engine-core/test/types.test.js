"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../src/types");
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Engine Core Types', () => {
    (0, vitest_1.it)('should allow creating objects satisfying IPlayer', () => {
        const player = { id: (0, types_1.playerId)('p1') };
        (0, vitest_1.expect)(player.id).toBe('p1');
    });
});
