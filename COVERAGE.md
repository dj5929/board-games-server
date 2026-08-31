# Universal Multiplayer Board Game Platform — Test Coverage

Coverage is measured with **Vitest + `@vitest/coverage-v8`**. Regenerate the report with:

```
npm run test:cov
```

Current baseline: **238 tests / 25 test files passing** (`npm test`). Lint (`npm run lint`) and typecheck (`tsc --noEmit -p tsconfig.json`) are clean.

## Component Summary

| Component | Tests | Stmts | Branch | Funcs | Lines |
|---|---|---|--:|--:|--:|--:|
| [engine-core](#engine-core) | 1 | 100.00% | 100.00% | 100.00% | 100.00% |
| [catan-engine](#catan-engine) | 46 | 98.27% | 88.70% | 100.00% | 98.27% |
| [monopoly-engine](#monopoly-engine) | 98 | 100.00% | 95.64% | 100.00% | 100.00% |
| [scotland-yard-engine](#scotland-yard-engine) | 36 | 100.00% | 97.41% | 100.00% | 100.00% |
| [server](#server) | 24 | 96.68% | 94.92% | 95.45% | 96.68% |
| [web-client](#web-client) | 33 | 26.26% | 72.28% | 46.15% | 26.26% |

> The production server imports every engine package through its `index.ts`, so the full engine graph — including the data-only `positions.ts` and the `index.ts`/`types.ts` shims — is now executed (and measured) at **100%** statements. See [Known Exceptions](#known-exceptions) for the remaining gaps.

## engine-core

Pure type/interface definitions and static utility functions — fully exercised by all engines and the server.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/IGameEngine.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/index.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/types.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/utils.ts` | 100.00% | 100.00% | 100.00% | 100.00% |

## catan-engine

`CatanEngine.ts` is at **100%** of statements, functions, and lines (gap-closing pass). Remaining branch misses are guard-clause short-circuits (wrong-player / wrong-phase checks).

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/CatanEngine.ts` | 100.00% | 88.48% | 100.00% | 100.00% |
| `src/board.ts` | 88.37% | 91.67% | 100.00% | 88.37% |
| `src/index.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/types.ts` | 100.00% | 100.00% | 100.00% | 100.00% |

Notable coverage: longest-road dethrone/tie handling, settlement placement connectivity, isValidAction phase gating, END_TURN guards, post-game award re-check.

## monopoly-engine

`MonopolyEngine.ts` is at **100%** of statements, functions, and lines. Remaining branch misses are the guard short-circuits in the `reduce` pre-checks and `isValidAction`.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/MonopolyEngine.ts` | 100.00% | 95.64% | 100.00% | 100.00% |
| `src/board.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/cards.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/index.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/types.ts` | 100.00% | 100.00% | 100.00% | 100.00% |

Notable coverage: mortgage/unmortgage guards, even-building rule, house buy/sell guards, card-deck wraps (RR/utility), trade-with-buildings blocks, mortgaged-property trade interest, PAY_PLAYERS / repairs, jail mechanics, END_TURN single-active-game-over, bankruptcy/creditor transfers, get-out-of-jail card return to deck, INVALID_ACTION_TYPE/PLAYER_NOT_FOUND paths, isValidAction build-limit and trade validation matrices.

## scotland-yard-engine

All files — including the 798-line data-only `positions.ts` — are measured at **100%** statements, because the production server imports the package `index.ts` (boot-steps execute the top-level data statements). Branch misses are guard short-circuits in the engine.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/ScotlandYardEngine.ts` | 100.00% | 96.84% | 100.00% | 100.00% |
| `src/board.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/index.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/positions.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/types.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/utils.ts` | 100.00% | 100.00% | 100.00% | 100.00% |

## server

Unit + integration coverage of the full HTTP and WebSocket surface. `server.test.ts` drives `buildApp()` through real HTTP injection (`fastify.inject`) and a live WebSocket round-trip over a real `ws` client (create room → join → `ROLL_DICE` → `STATE_UPDATE`/`EVENTS`), plus error paths (400/404, close codes `1008`, `ERROR` reply, no-broadcast on invalid actions, connection cleanup on close).

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/Room.ts` | 100.00% | 95.00% | 100.00% | 100.00% |
| `src/RoomManager.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/schemas.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/server.ts` | 91.79% | 92.86% | 75.00% | 91.79% |

## web-client

React hooks/utilities are fully covered; `App`, `Lobby`, and `GameRoom` cover the production flows end-to-end with a stubbed `WebSocket` (simulated `STATE_UPDATE` / `EVENTS` / `ERROR` / close messages and socket-payload assertions). The heavier board components are left to the automated UI testing workflow (`.agents/skills/ui-testing`).

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/App.tsx` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/main.tsx` | 0.00% | 0.00% | 0.00% | 0.00% |
| `src/components/AudioToggle.tsx` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/components/GameRoom.tsx` | 68.13% | 62.35% | 100.00% | 68.13% |
| `src/components/Lobby.tsx` | 88.44% | 70.59% | 100.00% | 88.44% |
| `src/hooks/useEventLog.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/hooks/useGameSocket.ts` | 100.00% | 88.24% | 100.00% | 100.00% |
| `src/hooks/useToasts.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/utils/SoundEngine.ts` | 100.00% | 97.30% | 100.00% | 100.00% |
| `vitest.setup.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| boards/rooms: `CatanBoard`, `CatanDevCardManager`, `CatanDiscardModal`, `CatanRobberVictimModal`, `CatanRoom`, `CatanTradeManager`, `Dice3D`, `MonopolyBoard`, `PlayerToken`, `PropertyManager`, `RulebookModal`, `ScotlandYardBoard`, `ScotlandYardRoom`, `TradeManager`, `TradeNotification` | 0.00% | 0.00% | 0.00% | 0.00% |

## Known Exceptions

* **`catan-engine/src/board.ts` (~88%):** the uncovered statements are a confirmed-dead perimeter/branch (`outerEdges` port-trace, ~lines 146-169) — every board edge has exactly 2 adjacent hexes, so the branch is unreachable without source changes.
* **`server/src/server.ts` `start()`:** the production entrypoint (port listener) is not covered by tests; it requires a live external process. All app logic lives in `buildApp()`, which is fully exercised through `fastify.inject` and real WebSocket clients.
* **`web-client/src/main.tsx`:** the React entrypoint (`createRoot`) is not covered.
* **Board/room components:** `CatanRoom`, `MonopolyBoard`, `PropertyManager`, `TradeManager`, `Dice3D`, etc. are validated through the automated UI/WebSocket QA workflow (`.agents/skills/ui-testing`) rather than unit tests. `GameRoom.test.tsx` deliberately mocks these sub-components, so their lines do not count toward `GameRoom`'s own 68% coverage.

## Contributing

Keep the coverage matrix accurate: after adding or changing tests, regenerate with `npm run test:cov` and update this file (`.agents/rules/testing.md` requires the same).