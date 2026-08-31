# Universal Multiplayer Board Game Platform — Test Coverage

Coverage is measured with **Vitest + `@vitest/coverage-v8`**. Regenerate the report with:

```
npm run test:cov
```

Current baseline: **259 tests / 26 test files passing** (`npm test`). Lint (`npm run lint` + web-client lint) and typecheck (`tsc --noEmit -p tsconfig.json`) are clean.

## Component Summary

| Component | Tests | Stmts | Branch | Funcs | Lines |
|---|---|---|--:|--:|--:|--:|
| All files | — | 92.86% | 84.80% | 85.52% | 95.45% |
| [catan-engine](#catan-engine) | 46+ | 91.96% | 83.71% | 96.82% | 97.48% |
| [monopoly-engine](#monopoly-engine) | 98+ | 96.82% | 89.56% | 95.83% | 98.88% |
| [scotland-yard-engine](#scotland-yard-engine) | 36+ | 98.75% | 96.29% | 100% | 100% |
| [server](#server) | 24+ | 93.10% | 84.31% | 91.17% | 94.24% |
| [web-client](#web-client) | 33+ | ~66–100% (per-file) | — | — | — |

> Coverage is reported over the files exercised by the test run's import graph (Vitest `all: false` default). Data-only/type modules (`board.ts`, `cards.ts`, `positions.ts`, `index.ts`/`types.ts` shims) that the production server imports register at or near 100% because boot-steps execute their top-level statements. Aggregate statement counts: **2018/2173 stmts, 1133/1336 branches, 254/297 funcs, 1784/1869 lines**.

## catan-engine

`CatanEngine.ts` now includes the official two-round **initial placement** reducers (`PLACE_INITIAL_SETTLEMENT` / `PLACE_INITIAL_ROAD`) — the uncovered lines are the new placement/distance-rule guard short-circuits and the `PLAY_KNIGHT` no-victim path.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/CatanEngine.ts` | 92.91% | 85.33% | 100% | 99.41% |
| `src/board.ts` | 85.85% | 57.69% | 80% | 85.54% |

Notable coverage: initial-placement order (forward/reverse), distance rule, road-follows-settlement, first-roller selection, longest-road dethrone/tie handling, settlement connectivity, `isValidAction` phase gating, `END_TURN` guards, post-game award re-check.

## monopoly-engine

`MonopolyEngine.ts` gained a dedicated `BUY_PROPERTY` `isValidAction` branch and a strict `return false` default for unknown action types. The uncovered `886-893` lines are the new guard branches.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/MonopolyEngine.ts` | 96.81% | 89.56% | 95.83% | 98.87% |

Notable coverage: mortgage/unmortgage guards, even-building rule, house buy/sell guards, card-deck wraps (RR/utility), trade-with-buildings blocks, mortgaged-property trade interest, jail mechanics, `END_TURN` single-active-game-over, bankruptcy/creditor transfers, get-out-of-jail card return to deck, `isValidAction` build-limit and trade validation matrices.

## scotland-yard-engine

All engine logic at 100% statements/functions/lines; branch misses are guard short-circuits.

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/ScotlandYardEngine.ts` | 98.57% | 96.19% | 100% | 100% |
| `src/utils.ts` | 100% | 96.66% | 100% | 100% |

Notable coverage: hidden-movement per-player projection (Mr. X scrub, reveal-turn/game-over preservation), double moves, ticket flow, reveal turns, win conditions.

## server

Unit + integration coverage of the full HTTP and WebSocket surface. `server.test.ts` drives `buildApp()` through real HTTP injection (`fastify.inject`) and a live WebSocket round-trip over a real `ws` client, plus error paths (400/404, close codes `1008`, `ERROR` reply, no-broadcast on invalid actions, connection cleanup).

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/Room.ts` | 97.61% | 75% | 100% | 100% |
| `src/RoomManager.ts` | 100% | 66.66% | 100% | 100% |
| `src/server.ts` | 88.31% | 90.90% | 76.92% | 89.33% |

## web-client

React hooks/utilities are heavily covered; `App`, `Lobby`, and `GameRoom` cover the production flows with a stubbed `WebSocket`. `Lobby.tsx` coverage is high (93.75% stmts) after adding Online-mode and join-room tests. Heavier board components are left to the automated UI testing workflow (`.agents/skills/ui-testing`).

| File | Stmts | Branch | Funcs | Lines |
|---|--:|--:|--:|--:|
| `src/App.tsx` | 66.66% | 100% | 60% | 66.66% |
| `src/components/GameRoom.tsx` | 67.79% | 57.57% | 40.38% | 68.48% |
| `src/components/Lobby.tsx` | 93.75% | 77.77% | 92.85% | 97.72% |
| `src/hooks/useGameSocket.ts` | 96.96% | 81.25% | 100% | 100% |
| `src/utils/SoundEngine.ts` | 100% | 96.42% | 100% | 100% |

## Known Exceptions

* **`catan-engine/src/board.ts` (~86%):** a confirmed-dead perimeter branch (`outerEdges` port-trace, ~lines 146-167) — every board edge has exactly 2 adjacent hexes, so the branch is unreachable without source changes.
* **`server/src/server.ts` `start()`:** the production entrypoint (port listener) is not covered by tests; it requires a live external process. All app logic lives in `buildApp()`, which is fully exercised through `fastify.inject` and real WebSocket clients.
* **Board/room components** (`CatanRoom`, `MonopolyBoard`, `PropertyManager`, `TradeManager`, `Dice3D`, `ScotlandYardBoard`, etc.) are validated through the automated UI/WebSocket QA workflow (`.agents/skills/ui-testing`) rather than unit tests.
* Coverage is reported on the test-run import graph only (`all: false`), so files not imported by the tests are not row-listed here.

## Contributing

Keep the coverage matrix accurate: after adding or changing tests, regenerate with `npm run test:cov` and update this file (`.agents/rules/testing.md` requires the same).
