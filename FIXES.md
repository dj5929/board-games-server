# 🛠️ Codebase Fixes & Improvements

This document tracks identified bugs, type safety issues, and planned improvements across the Board Game Server project.

## 🟢 Completed Fixes

### 1. `PlayerId` Type Import Error
- **Location:** `packages/web-client/src/components/CatanDevCardManager.tsx`
- **Issue:** The `PlayerId` type was incorrectly imported from `@packages/catan-engine`, which does not re-export it.
- **Fix:** Updated the import statement to pull `PlayerId` directly from `@packages/engine-core`.
- **Status:** 🟢 Fixed

### 2. Catan Engine Robber Placement Immutability Violation
- **Location:** `packages/catan-engine/src/CatanEngine.ts`
- **Issue:** The `MOVE_ROBBER` and `PLAY_KNIGHT` actions mutated the `hasRobber` property on the `hex` objects in place instead of creating deep clones, violating the strict immutability guidelines.
- **Fix:** Swapped direct mutations for shallow clones mapping of specific target hex objects (`nextBoard.hexes[targetHexIndex] = { ...nextBoard.hexes[targetHexIndex]!, hasRobber: true };`).
- **Status:** 🟢 Fixed

### 3. Monopoly Engine Reducer CPU Usage Optimization
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts`
- **Issue:** The reducer utilized `structuredClone` on every game action, creating massive JSON serialization/deserialization CPU overheads during game loops.
- **Fix:** Replaced the deep cloning pattern with multi-level ES6 spread shallow cloning logic to drastically enhance loop efficiency.
- **Status:** 🟢 Fixed

### 4. Catan Robber Victim Modal Freeze
- **Location:** `packages/web-client/src/components/CatanRobberVictimModal.tsx`
- **Issue:** The UI lacked a confirm button when placing the robber on a hex with no victims, causing the game to freeze.
- **Fix:** Added a fallback "Confirm Placement" button to dispatch `MOVE_ROBBER` / `PLAY_KNIGHT` without a target player.
- **Status:** 🟢 Fixed

### 5. Catan Missing Toast Notifications
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** Several advanced Catan engine events were processed silently, confusing players.
- **Fix:** Added toast notification UI for `RESOURCES_DISCARDED`, `ROBBER_MOVED`, `STOLEN_RESOURCE`, `DEV_CARD_BOUGHT`, and `DEV_CARD_PLAYED`.
- **Status:** 🟢 Fixed

### 6. Road Building UI Lock
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** The UI strictly required selecting exactly two roads to play the Road Building card, with no way to cancel or place just one road, causing a soft lock.
- **Fix:** Added a contextual "Finish (Build 1 Road)" and "Cancel Road Building" button in the Turn Actions menu to safely exit or submit a single road.
- **Status:** 🟢 Fixed

### 7. Catan Trade Manager Port Detection Bug
- **Location:** `packages/web-client/src/components/CatanTradeManager.tsx`
- **Issue:** The trade manager attempted to access `adjacentEdges` from the dynamic game state vertex, which only stores ownership data. This caused maritime trade port discounts to fail.
- **Fix:** Switched to referencing the static `boardGraph.vertices` to correctly look up adjacent edges and evaluate port ownership.
- **Status:** 🟢 Fixed

### 8. Catan Room Null Player Crash
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** The UI crashed when evaluating pending discards if the local player (`me`) was undefined (e.g. spectating).
- **Fix:** Added a null check before accessing `pendingDiscards[me.id]`.
- **Status:** ✅ Fixed

### 9. Scotland Yard Shared-Board Hidden-Movement Broken on Hot-Seat / Mr. X Position Leaked Online
- **Location:** `packages/web-client/src/components/ScotlandYardBoard.tsx`, `packages/server/src/Room.ts`, `packages/scotland-yard-engine/src/ScotlandYardEngine.ts`, `packages/engine-core/src/IGameEngine.ts`
- **Issue:** Two related problems made Scotland Yard not work as a hidden-movement game:
  1. In hot-seat ("everyone plays in the same board"), `ScotlandYardBoard.tsx` decided Mr. X's visibility via `isLocal` — but in hot-seat `localPlayerIds` contains *every* player, so Mr. X's exact location was always shown to all detectives, defeating the core hidden-movement mechanic.
  2. Online, `Room.broadcastState` sent the *same* full `ScotlandYardState` (including `players[0].position`) to every connection, leaking Mr. X's true location to detectives on every hidden turn. There was no per-player projection anywhere.
- **Fix:**
  1. **Shared-board visibility:** Mr. X's token is now hidden on a shared board except on reveal turns, during Mr. X's own active turn, or after game over. A `MrXShadow` ("Mr. X is on the move...") indicator is rendered when hidden.
  2. **Per-player projection:** Added optional `getStateForPlayer?(state, playerId)` to the core `IGameEngine` for hidden-information engines. `ScotlandYardEngine` implements it to scrub Mr. X's `position` (sentinel `0`) for non-Mr-X viewers except on reveal turns / game-over; Mr. X always receives his true position.
  3. **Server-side scrubbing:** `Room.broadcastState` sends a per-connection projected `STATE_UPDATE` when the engine exposes `getStateForPlayer`.
- **Status:** ✅ Fixed - 4 projection tests added to `game-flow.test.ts`; full suite (242 tests), typecheck, and lint green.

### 10. Catan Longest-Road Tie / Revoke & Post-Game Re-Award; Monopoly Bankrupt Card Cleanup
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (`checkWinConditionAndAwards`), `packages/monopoly-engine/src/MonopolyEngine.ts` (`DECLARE_BANKRUPTCY`)
- **Issue:** Several edge cases were handled incorrectly:
  1. When two players tied at the max road length and the current Longest Road holder was not one of them, the award was never revoked.
  2. When the holder *was* inside the tie, the recorded length was never refreshed.
  3. `checkWinConditionAndAwards` could re-award Longest Road / Largest Army after the game had already finished.
  4. In Monopoly, a player going bankrupt to the BANK kept their Community Chest get-out-of-jail-free cards instead of returning them to the deck.
- **Fix:**
  1. `checkWinConditionAndAwards` now revokes the award (`owner = null`, length reset) when a 2+ tie excludes the current holder, and refreshes the holder's length when they are inside the tie.
  2. Abort `checkWinConditionAndAwards` early when `status === 'FINISHED'` so no awards fire post-game.
  3. `DECLARE_BANKRUPTCY` pushes the bankrupt player's Community Chest jail-free cards back onto the chest deck and clears them from the player.
- **Status:** ✅ Fixed - added longest-road tie/revoke, post-game award-skip, and bankruptcy card-return tests to `edge-cases.test.ts` / `debt.test.ts`.

### 11. Scotland Yard Board Collapsed to a Tiny Rectangle / Zoom Too Sensitive
- **Location:** `packages/web-client/src/components/ScotlandYardBoard.tsx`, `packages/web-client/src/components/ScotlandYardRoom.tsx`
- **Issue:** After switching the board SVG to `width/height: 100%` for a "fit the screen" change, the board rendered as a small rectangle instead of filling the screen, because `react-zoom-pan-pinch` needs intrinsic content dimensions and the `h-full` chain resolved to `auto`. Separately, a single scroll tick zoomed too aggressively (`wheel.step: 0.05`).
- **Fix:**
   1. Restored the SVG's intrinsic `1600×1200` size and added a `ResizeObserver` that computes `fitScale = min(containerW/1600, containerH/1200)`, rendering the zoom wrapper only after the first measurement (avoids a mount-time scale race). The board now fills the viewport with the whole map visible - no scroll.
   2. Set the room's height chain to an explicit `h-[calc(100dvh-1.5rem)]` so every parent has a defined height.
   3. Reduced `wheel`/`pinch` `step` from `0.05` to `0.005`, lowered `minScale` to `0.1`, and disabled `limitToBounds` for free panning.
- **Status:** ✅ Fixed - full suite green, typecheck and lint clean.

### 12. Inconsistent / Missing Per-Game Player-Count Rules
- **Location:** `packages/engine-core/src/gameConfig.ts` (new), `packages/web-client/src/components/Lobby.tsx`, `packages/server/src/server.ts`, `packages/{monopoly,catan,scotland-yard}-engine/src/*Engine.ts`
- **Issue:** The Lobby offered a single hardcoded 2/3/4 Players dropdown for every game, the server accepted any `playerCount` (and Scotland Yard threw an uncaught 500 on bad counts), and the engines had no min/max enforcement (Scotland Yard used a 2–6 literal; Catan/Monopoly accepted any count). Official ranges were: **Monopoly 2–8**, **Catan 3–4**, **Scotland Yard 3–6**.
- **Fix:**
   1. Added a shared `GAME_CONFIGS` registry in `engine-core/src/gameConfig.ts` with each game's `minPlayers`/`maxPlayers`, the `GameType` union, and an `isGameType` guard.
   2. `Lobby.tsx` renders the Players dropdown from the selected game's range and re-clamps the current selection on game switch (Scotland Yard can now request 5–6).
   3. `POST /rooms` validates `playerCount` against the range, returns a clean 400 with a descriptive message, and defaults to `minPlayers` when omitted.
   4. `MonopolyEngine` (2–8), `CatanEngine` (3–4), and `ScotlandYardEngine` (updated 2–6 → 3–6) each throw in `getInitialState` on invalid counts.
   5. Migrated the ~25 Catan 2-player tests to 3 players (with turn-cycle fixes) and added validation tests at both engine and server layers, plus Lobby dropdown-range tests.
- **Status:** ✅ Fixed - full suite green (250 tests), typecheck and lint clean.

### 13. Catan Initial Placement Phase Not Implemented
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (`getInitialState`, `reduce`), `packages/catan-engine/src/types.ts`, `packages/server/src/schemas.ts`, `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** The game started directly in `MAIN_TURN` with an empty board (a documented simplification). The `PLACE_INITIAL_SETTLEMENT` / `PLACE_INITIAL_ROAD` action types were defined but had no reducer handler, so the official setup was unimplemented.
- **Fix:**
   1. `getInitialState` now begins in `INITIAL_PLACEMENT_1` and initializes `placementOrder` / `placementIndex` / `placementStep` / `pendingRoadVertex`.
   2. Added `PLACE_INITIAL_SETTLEMENT` and `PLACE_INITIAL_ROAD` reducer cases with full validation: Phase 1 forward order p1→pN (free settlement + adjacent road), Phase 2 reverse order pN→p1 (second settlement + road), distance rule enforced, no resources granted, pending road must connect to the just-placed settlement; player who placed first in Phase 2 (player PN) rolls first.
   3. `schemas.ts` whitelists both new actions for WebSocket.
   4. `CatanRoom.tsx` sends the placement actions on vertex/edge clicks during setup and shows a placement-target HUD banner (dice/build actions hidden).
- **Status:** ✅ Fixed — existing tests migrated to an `initMainTurn` helper; new 6-test `initial-placement.test.ts` suite added. Full suite green (259 tests), typecheck and lint clean. See Phase 30 in the tracker.

### 14. Online Multiplayer UI Still Disabled in Lobby
- **Location:** `packages/web-client/src/components/Lobby.tsx`
- **Issue:** Online mode (and the Join Room flow) had been temporarily disabled to isolate hot-seat testing; the Lobby still carried `@ts-ignore` and `_`-prefixed dead code from that period. The server join endpoint and client session-token plumbing existed (Phase 26) but the Lobby never wired them back up.
- **Fix:** Re-enabled the **Online** button and Join section. In Online mode, room creation auto-joins only the creator seat (`[playerIds[0]]`); Join inputs a room ID and calls `POST /rooms/:roomId/join`. Removed the `@ts-ignore` and dead `_` code via a clean rewrite.
- **Status:** ✅ Fixed — added Lobby tests for online-create (creator-only seat), join-by-id, and join-error (404 room-not-found alert). Full suite green (259 tests).

### 15. `isValidAction` Fallthrough Accepted Unknown Action Types (Monopoly/Catan)
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (`isValidAction`), `packages/catan-engine/src/CatanEngine.ts` (`isValidAction`)
- **Issue:** Both engines' `isValidAction` ended with `default: return true` (or an equivalent catch-all), meaning action types not explicitly validated were silently accepted at the server's dispatch gate.
- **Fix:** Changed the fallthrough default to `return false` in both engines. In Monopoly this required moving `ROLL_DICE`/`END_TURN` to explicit returns (`!hasRolled` / `hasRolled`) and adding a dedicated `BUY_PROPERTY` branch (space is a purchasable unowned property the player can afford).
- **Status:** ✅ Fixed — full suite green (259 tests), typecheck and lint clean.

### 16. RoomManager Idle-Cleanup Used `console.log` (Observability Gap)
- **Location:** `packages/server/src/RoomManager.ts`, `packages/server/src/server.ts`
- **Issue:** The periodic idle-room cleanup logged via `console.log`, the last remaining `console.*` call outside `fastify.log` (contradicting Phase 26's observability guarantee).
- **Fix:** `RoomManager` now takes an injectable logger (defaulting to `console`); `server.ts` wires it to `fastify.log.info` in `buildApp`.
- **Status:** ✅ Fixed — no stray `console.*` remains in server source.

### 17. Stale Compiled `.js` Artifacts Re-Entered the Tree (from `tsc -b`)
- **Location:** root (`tsconfig.tsbuildinfo`, `vitest.config.js`), `packages/*/src/*.js`, `packages/*/{test,__tests__}/*.js`
- **Issue:** Running `tsc -b` (e.g. web-client build) emitted compiled `.js`/`.d.ts` files next to their `.ts` sources, and root `tsc -b` could re-emit stale `.js` test files that Vitest then picked up and crashed on (the Phase 25 failure mode recurring).
- **Fix:** Deleted the emitted artifacts and extended `.gitignore` to exclude `*.tsbuildinfo`, `packages/*/src/*.js`, and the test `.js` patterns, so future builds never re-pollute the tree.
- **Status:** ✅ Fixed - full suite green (26 files / 259 tests).

### 18. Security & Integrity Hardening (Final Audit Findings)
- **Location:** `packages/server/src/server.ts`, `packages/server/src/Room.ts`, `packages/server/src/RoomManager.ts`, `packages/server/src/schemas.ts`, `packages/{catan,monopoly,scotland-yard}-engine/src/*Engine.ts`, `packages/catan-engine/src/types.ts`
- **Issue:** The `FINAL_AUDIT.md` findings (CRITICAL-1/2/3/4/5, MED-1/4/6/7/8, LOW-1, LOW-10) were open.
- **Fix:**
  1. **CRITICAL-1 (player impersonation):** The WebSocket handler now forces `action.playerId = <authenticated socket playerId>` before dispatch, ignoring any client-supplied value.
  2. **CRITICAL-2/3 (hidden-information leak):** Added `getStateForPlayer` to `CatanEngine` and `MonopolyEngine`. Catan hides opponents' dev-card details and the ordered dev deck. Monopoly hides the ordered chance/chest decks (count only). `Room.broadcastState` already projects per-connection via `getStateForPlayer` (Scotland Yard had it; the others now do too).
  3. **CRITICAL-4 (Road Building connectivity):** `PLAY_ROAD_BUILDING` now enforces that the first road connects to the player's network and the second connects to the network or the first road. Built the shared `isEdgeConnectedToNetwork` helper reused by `BUILD_ROAD`.
  4. **CRITICAL-5 (game-agnostic schema):** Split `actionSchema` into `monopolyActionSchema`, `catanActionSchema`, `scotlandYardActionSchema`, exposed as `actionSchemaByGame`. The server validates against the schema matching the room's `gameType`.
  5. **MED-1 (socket leak on idle cleanup):** `RoomManager` now calls `room.closeAllConnections()` before removing idle rooms.
  6. **MED-4 (silent rejection):** `Room.dispatch` now sends an `ACTION_REJECTED` message with the error back to the offending client.
  7. **MED-6 (orphaned sockets on reconnect):** `Room.addConnection` closes the stale socket for a `playerId` before replacing it.
  8. **MED-7 (SY identity check):** `ScotlandYardEngine.isValidAction` now asserts `action.playerId === activePlayerId`.
  9. **MED-8 (Monopoly double-roll):** `ROLL_DICE` reducer rejects with `ALREADY_ROLLED` when the current player has already rolled.
  10. **LOW-1 (schema strictness):** `DISCARD_RESOURCES` resource counts are `.int().nonnegative()`; Monopoly trade money is `.int().nonnegative()`; Catan `TRADE_BANK` amount is `.int().positive()`.
  11. **LOW-10 (dev-card shared reference):** `CatanEngine.reduce` deep-copies development cards while cloning players, so `END_TURN`'s `boughtThisTurn = false` no longer mutates shared references.
- **Status:** ✅ Fixed — added tests (server identity binding, ACTION_REJECTED, socket-close-on-reconnect/cleanup, schema per-game strictness, Catan Road Building connectivity + projections, Monopoly double-roll + projections, SY identity, Catan dev-card immutability). Full suite green (26 files / 284 tests), typecheck, lint, server build, and web-client `tsc -b` + tests all green.

---

## 🔴 Planned Improvements & Known Issues

### 🔴 CRITICAL: `npm test` Pipeline Broken (Stale Artifacts + Failing Assertions)
- **Location:** Repository-wide (`packages/*/test`, `packages/*/__tests__`)
- **Issue:** Two independent problems break `npm test` (12/21 test files fail):
  1. Stale compiled `.js` test artifacts are committed to git (`packages/*/test/*.test.js`, `packages/*/__tests__/*.test.js`, e.g. `packages/monopoly-engine/__tests__/cards.test.js`). Vitest picks them up and they crash with `MODULE_NOT_FOUND`.
  2. Seven genuine assertion failures in the current WIP engine edits (e.g. `packages/monopoly-engine/__tests__/debt.test.ts:141` expects bank `20630`, receives `Infinity`; multiple Catan `__tests__/edge-cases.test.ts` building / VP-card cases; `catan.test.ts` resource constraint cases).
- **Fix:**
  1. Delete all tracked `.js`/`.js.map` files under `test/` and `__tests__/` and remove them from git (`git rm`).
  2. Add compiled-output patterns to `.gitignore` so they never return.
  3. Fix the 7 failing engine assertions so the full suite is green.
- **Status:** 🟢 Fixed

### 🔴 CRITICAL: Web-Client Does Not Compile (Regression Introduced by Fix Pass)
- **Location:** `packages/web-client/src/components/ScotlandYardRoom.tsx`, `CatanRoom.tsx`, `ScotlandYardBoard.tsx`
- **Issue:** `tsc -b` in `web-client` fails with 8 errors. Six were introduced by the fix pass that touched the Scotland Yard/Catan rooms:
  1. `ScotlandYardRoom.tsx:39/43/45` — `SoundEngine` is referenced (transit/siren/victory sounds) but never imported from `../../utils/SoundEngine` (TS2304).
  2. `ScotlandYardRoom.tsx:41` — `setGameOver()` is called but no `gameOver` state hook is declared (TS2304). The old handler used `alert()`, so the overlay state was never created.
  3. `CatanRoom.tsx:211/292` — `discardingPlayerId` comes from `localPlayerIds.find(...)` (typed `string`), but `pendingDiscards` is `Record<PlayerId, number>` — invalid index (TS7053).
  Two more errors are pre-existing: `ScotlandYardBoard.tsx:3/16` unused `TransportType` import and unused `activePlayer` variable.
- **Fix:**
   1. `import { SoundEngine } from '../../utils/SoundEngine';`
   2. Declare `const [gameOver, setGameOver] = useState<{ winner: PlayerRole; reason: string } | null>(null);` and render a game-over overlay.
   3. Look up the discarding player via a `PlayerId`-typed variable (or cast the index) in `CatanRoom.tsx`.
   4. Remove the unused `TransportType` import and `activePlayer` variable in `ScotlandYardBoard.tsx`.
- **Status:** 🟢 Fixed — all 6 errors resolved: `SoundEngine` imported, `gameOver` state declared + overlay rendered (fixed overlay with "Return to Lobby"), `pendingDiscards` indexed via `as PlayerId` cast (and `discardingPlayerId` typed `PlayerId | undefined`), unused `TransportType`/`activePlayer` removed. `tsc -b` and the full `vite build` are green.

### 🔴 CRITICAL: Server Cannot Be Started / No Build Story
- **Location:** `packages/server` (`package.json`)
- **Issue:** `main` points at `src/server.ts`, there are no `dev`/`build`/`start` scripts, and no TS runtime (`tsx`/`ts-node`) is installed. The server package cannot actually be launched with plain `node`.
- **Fix:**
   1. Added `tsconfig.build.json` (`rootDir: "src"`, includes only `src/**/*`) so `tsc` emits `dist/server.js` (no nested `dist/src`).
   2. `build` → `tsc -p tsconfig.build.json`.
   3. `start` → `tsx dist/server.js` — runs the compiled output while `tsx` resolves the engine packages' extensionless `.ts` `main` imports (plain `node` cannot).
- **Status:** 🟢 Fixed — `npm run build` (workspace `@packages/server`) produces `dist/server.js`, and `npm start` boots and listens on `http://127.0.0.1:3000`. Note: a full `tsc` run earlier left stale `dist/src`/`dist/test` outputs; delete `dist/` and rebuild once to get the clean layout.

---

### 🟠 HIGH: Root Has No Lint / CI
- **Location:** root `package.json`, `packages/*` (server + engines)
- **Issue:** oxlint is configured only in `web-client`. The server and engine packages have no linting, and there is no CI, so regressions (like the current broken test suite) ship unnoticed.
- **Fix:**
   1. Install `oxlint` in the root workspace and create a root `.oxlintrc.json` (retargeting `lint` to engines + server).
   2. Update CI workflow: remove `|| true` masking, pin Node to 24 (LTS), use `npm ci` + cache.
   3. Track `.github/` in git.
- **Status:** 🟢 Fixed — root `oxlint` installed, root `.oxlintrc.json` created, `lint` script scoped to `packages/{engine-core,monopoly-engine,catan-engine,scotland-yard-engine,server}` and exits cleanly (8 pre-existing unused-import warnings in engine test files remain, all warning-level). CI workflow rewritten: Node 24, `npm ci`, `npm run typecheck`, root lint, web-client lint, `npm test`, server build, web-client build — no `|| true` masks anywhere. Item 3 (committing `.github/`) happens on the next commit; it is currently untracked.

### 🟠 HIGH: Server Hardening (Typed Engine Registry, RNG, Auth, CORS)
- **Location:** `packages/server/src/server.ts`
- **Issue:** Several MVP shortcuts:
  1. `let engine: any` (line 26) — untyped engine selection.
  2. Room IDs via `Math.random().toString(36).substring(7)` — collision-prone; and the gameplay RNG is `Math.random` (line 16), which is predictable and forgeable in a networked game.
  3. `playerId` comes from a query param with no verification — any client can claim any existing player slot.
  4. CORS is `origin: '*'`.
- **Fix:**
   1. Replace `Record<string, any>` with a typed engine registry (e.g. `Record<string, IGameEngine<IGameState, IPlayerAction, IGameEvent>>`) for typed engine selection.
   2. Consider a deterministic RNG for the `IRandomProvider` if reproducible gameplay is desired; a crypto RNG is the right call for anti-cheat.
   3. Issue `playerId`s and require tokens for WebSockets.
   4. Restrict CORS to known client origins.
- **Status:** 🟢 Fixed — items 1, 3, 4 implemented previously (`crypto.randomUUID()` room IDs + session tokens, token verification on the WS route, `getAvailablePlayerId` also excludes token-claimed slots, CORS locked to `localhost:5173`), and item 1 is now complete: engine selection is `Record<string, IGameEngine<IGameState, IPlayerAction, IGameEvent>>` (no `any`). Item 2 resolved by design decision: **crypto RNG retained (non-seeded)** — reproducible gameplay is an engine-level concern (engines accept an injected `rng` for tests); a seeded RNG would reintroduce predictability. `npm run typecheck` confirms the typed registry compiles with all three engines (method-bivariance makes the concrete engines assignable).

---

### 🟡 MEDIUM: Dependency Hygiene
- **Location:** root + all `packages/*/package.json`
- **Issue:** `npm outdated` reports major versions behind: Fastify 4.29 → 5.12, zod 3.25 → 4.5, vitest 1.6 → 4.1 (and `@vitest/coverage-v8`), plus a split TypeScript version (root 5.9 vs client 6.0, documented as intentional).
- **Fix:** Schedule a dependency upgrade pass (Fastify 5, zod 4, modern vitest), re-run the full suite, and re-verify the TS-version split is still necessary once Vite's requirement changes.
- **Status:** ✅ Fixed — major passes landed:
  1. **zod 3 → 4** (all five packages, deduped to a single `zod@4.5.4`): the only zod usage is `packages/server/src/schemas.ts`; `z.record(z.number())` needed the key type in v4 (`z.record(z.string(), z.number())`) on the `offer`/`request`/`resources` fields. `.parse()` + catch elsewhere is unchanged.
  2. **fastify 4.29 → 5.12** (+ `@fastify/cors` 8→11, `@fastify/websocket` 8.5→11.3): the websocket route handler signature changed from `(connection, req)` with `connection.socket` to `(socket, req)` where `socket` IS the raw `ws` WebSocket. `server.ts` updated to `socket.close/send/on`.
  3. **vitest 1.6 → 4.1** (+ `@vitest/coverage-v8` 4.1, deduped for both root and web-client against the single `vite@8.2`): the old `vitest.workspace.ts` file is removed in v4 — replaced with a root `vitest.config.ts` using `test.projects: ['packages/*']`. Web-client's `environment: 'jsdom'`/`globals`/`setupFiles` are now picked up per-project.
  4. **Vitest 4 typing fixes** in web-client tests: `vi.fn()` returns `Mock<Procedure | Constructable>` no longer assignable to concrete callback types, so mocks are now typed (`vi.fn<(args) => void>()`); `constructor(public url)` violated `erasableSyntaxOnly` (TS 6.0) and was rewritten to explicit field assignment; a `PlayerId` arg cast for `getInitialState`; and a mocked constructor kept as a separate typed mock for `.mock.results` access. `server/test/Room.test.ts` `mock.calls[N][0]` needed non-null assertions.
  - **Verified green:** full suite 250/250, `tsc --noEmit`, root oxlint, `test:cov` coverage, `@packages/server` build, and web-client `tsc -b` + `vite build`. The root `vitest.config.ts` emits a harmless forward-looking `configLoader: 'native'` ESM-in-CJS warning (root stays CommonJS for the engines). The intentional TS-version split (root 5.9 vs client 6.0) remains — re-verified it's still necessary since Vite 8/TS 6.0 require client-side `erasableSyntaxOnly`.

---

### 🔵 LOW: Observability & Broadcast Efficiency
- **Location:** `packages/server/src/Room.ts`, `packages/server/src/server.ts`
- **Issue:** Room joins/dispatches/closes use `console.log` instead of the Fastify logger. Every action broadcasts the entire state via `JSON.stringify` to all members (fine for MVP, costly at scale).
- **Fix:**
   1. Route all logging (including the WS error handler and server start catch block) through `fastify.log`. Use `fastify.log.error(...)` with a formatted message to satisfy fastify's strict typing.
   2. Later, move to delta/checkpoint state sync and per-player projections.
- **Status:** 🟢 Fixed — connection open/close and the previously-missed WS `error` handler and `start()` catch now all log via `fastify.log` (no `console.*` left in `server.ts`). Item 2 (delta sync) is future work and was not attempted.

---

### 🔴 CRITICAL: Scotland Yard `MOVE`/`DOUBLE_MOVE` Missing from Zod Schema
- **Location:** `packages/server/src/schemas.ts`
- **Issue:** The Zod `actionSchema` discriminated union does not include `MOVE` or `DOUBLE_MOVE` action types. All Scotland Yard WebSocket actions fail Zod validation and return `Invalid payload`, making the game unplayable over WebSocket.
- **Fix:**
```diff
  z.object({ ...baseAction, type: z.literal('TRADE_BANK'), offerResource: z.string(), requestResource: z.string(), amount: z.number() }),
+ // Scotland Yard actions
+ z.object({ ...baseAction, type: z.literal('MOVE'), payload: z.object({ targetNode: z.number(), ticketType: z.string() }) }),
+ z.object({ ...baseAction, type: z.literal('DOUBLE_MOVE'), payload: z.object({
+   move1: z.object({ targetNode: z.number(), ticketType: z.string() }),
+   move2: z.object({ targetNode: z.number(), ticketType: z.string() })
+ }) }),
]);
```

- **Status:** 🟢 Fixed

### 🔴 CRITICAL: Scotland Yard Client Dispatches Missing `playerId`
- **Location:** `packages/web-client/src/components/ScotlandYardRoom.tsx` (lines 69-90)
- **Issue:** `handleMoveClick` dispatches `{ type: 'MOVE', payload }` and `{ type: 'DOUBLE_MOVE', payload }` without including `playerId`. The server Zod schema requires `playerId` on all actions.
- **Fix:** Add `playerId: state.activePlayerId` to every `dispatch()` call in `handleMoveClick`. Add a `if (!state) return;` guard at the top.

- **Status:** 🟢 Fixed

### 🔴 CRITICAL: Scotland Yard Client Listens for Wrong Event Type
- **Location:** `packages/web-client/src/components/ScotlandYardRoom.tsx` (line 37)
- **Issue:** The client listens for `data.type === 'GAME_EVENT'`, but the server broadcasts events as `{ type: 'EVENTS', events: [...] }`. The `GAME_OVER` overlay and `PLAYER_MOVED` sounds never trigger.
- **Fix:** Change `data.type === 'GAME_EVENT'` to `data.type === 'EVENTS'`, then iterate `data.events` array (matching the Monopoly/Catan client pattern):
```diff
-      } else if (data.type === 'GAME_EVENT') {
-        const ev = data.event;
-        if (ev.type === 'PLAYER_MOVED') {
+      } else if (data.type === 'EVENTS') {
+        for (const ev of data.events) {
+          if (ev.type === 'PLAYER_MOVED') {
```
- **Status:** 🟢 Fixed — the `EVENTS` handling is correct, and the missing `SoundEngine` import + `gameOver` state hook/overlay are now in place (see the "Web-Client Does Not Compile" entry above); `tsc -b` + `vite build` are green.

### 🔴 CRITICAL: Monopoly `END_TURN` Infinite Loop
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (lines 418-426)
- **Issue:** The `do...while` loop skipping bankrupt players has no guard — if all other players are bankrupt, it loops forever.
- **Fix:** Add an active player count check before the loop:
```diff
  case 'END_TURN': {
    currentPlayer.hasRolled = false;
    currentPlayer.doublesCount = 0;
+   const activePlayers = nextState.players.filter((p: IMonopolyPlayer) => p.status === 'ACTIVE');
+   if (activePlayers.length <= 1) {
+     nextState.status = 'FINISHED';
+     events.push({ type: 'GAME_OVER', winnerId: activePlayers.length === 1 ? activePlayers[0]!.id : null });
+     break;
+   }
    do {
```

- **Status:** 🟢 Fixed

---

### 🟠 HIGH: Monopoly Utility Chance Card Missing 10x Multiplier
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (rent resolution + MOVE_TO_NEAREST_UTIL)
- **Issue:** The Chance card "Advance to nearest Utility" should force a 10x dice roll rent, but the engine uses the standard 4x/10x based on utility count.
- **Fix:** Add a `cardRentMultiplier` local variable in `ROLL_DICE`. Set it to `'FORCE_10X_UTIL'` when `MOVE_TO_NEAREST_UTIL` fires. In the Utility rent calculation, check for the flag:
```diff
+ let cardRentMultiplier: 'DOUBLE_RR' | 'FORCE_10X_UTIL' | null = null;
  // ... in Utility rent:
  const utilOwned = ...;
+ if (cardRentMultiplier === 'FORCE_10X_UTIL') {
+   rent = (dice1 + dice2) * 10;
+ } else if (utilOwned === 1) rent = (dice1 + dice2) * 4;
  // ... in MOVE_TO_NEAREST_UTIL card action:
  currentPlayer.position = target;
+ cardRentMultiplier = 'FORCE_10X_UTIL';
```

- **Status:** 🟢 Fixed

### 🟠 HIGH: Monopoly Railroad Chance Card Missing Double Rent
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (rent resolution + MOVE_TO_NEAREST_RR)
- **Issue:** The Chance card "Advance to nearest Railroad" should double the railroad rent, but the engine uses standard railroad rent.
- **Fix:** Same `cardRentMultiplier` mechanism as above. Set to `'DOUBLE_RR'` and apply `rent *= 2` in railroad rent:
```diff
  if (rrOwned > 0) rent = 25 * Math.pow(2, rrOwned - 1);
+ if (cardRentMultiplier === 'DOUBLE_RR') rent *= 2;
  // ... in MOVE_TO_NEAREST_RR card action:
  currentPlayer.position = target;
+ cardRentMultiplier = 'DOUBLE_RR';
```

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan `isValidAction` Always Returns True (Stub)
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (lines 809-812)
- **Issue:** `isValidAction` only checks `playerId` matches active player, then returns `true` for every action type. This allows exploits like building during DISCARD_PHASE.
- **Fix:** Implement proper phase-aware validation:
```ts
isValidAction(currentState, action): boolean {
  if (currentState.status === 'FINISHED') return false;
  if (action.type === 'DISCARD_RESOURCES') return !!currentState.pendingDiscards[action.playerId];
  if (action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE')
    return !!currentState.activeTrade && currentState.activeTrade.toPlayerId === action.playerId;
  if (action.playerId !== currentState.activePlayerId) return false;
  switch (action.type) {
    case 'ROLL_DICE': return currentState.turnPhase === 'MAIN_TURN' && !currentState.hasRolled;
    case 'MOVE_ROBBER': return currentState.turnPhase === 'ROBBER_PLACEMENT';
    case 'BUILD_SETTLEMENT': case 'BUILD_ROAD': case 'UPGRADE_CITY':
    case 'TRADE_BANK': case 'BUY_DEV_CARD': case 'PROPOSE_TRADE': case 'CANCEL_TRADE':
      return currentState.turnPhase === 'MAIN_TURN';
    case 'PLAY_KNIGHT': case 'PLAY_YEAR_OF_PLENTY': case 'PLAY_MONOPOLY': case 'PLAY_ROAD_BUILDING':
      return currentState.turnPhase === 'MAIN_TURN' && !currentState.playedDevCardThisTurn;
    case 'END_TURN': return currentState.turnPhase === 'MAIN_TURN' && currentState.hasRolled;
    default: return true;
  }
}
```

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan Building Actions Don't Check Turn Phase
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (BUILD_SETTLEMENT, BUILD_ROAD, UPGRADE_CITY)
- **Issue:** These actions only check `action.playerId !== currentState.activePlayerId` but not `turnPhase`. Players can build during DISCARD_PHASE or ROBBER_PLACEMENT.
- **Fix:** Add `if (currentState.turnPhase !== 'MAIN_TURN') return { success: false, error: 'Cannot build now' };` after the active player check in each action.

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan `Math.random()` Violates Architecture Rule 4
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (lines 546, 619)
- **Issue:** Trade IDs and dev card IDs use `Math.random()` instead of the injected `rng`, making the engine non-deterministic.
- **Fix:** Replace `Math.random().toString(36).substring(7)` with `rng.next().toString(36).substring(2, 9)`.

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan `PLAY_ROAD_BUILDING` Immutability Violation
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (line 762)
- **Issue:** `nextBoard.edges[edgeId]!.owner = action.playerId` mutates the edge object directly instead of creating a shallow clone.
- **Fix:**
```diff
- nextBoard.edges[edgeId]!.owner = action.playerId;
+ nextBoard.edges[edgeId] = { ...nextBoard.edges[edgeId]!, owner: action.playerId };
```

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan `PLAY_ROAD_BUILDING` Doesn't Enforce Road Limit
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (PLAY_ROAD_BUILDING handler)
- **Issue:** `BUILD_ROAD` checks `playerRoads >= 15`, but `PLAY_ROAD_BUILDING` doesn't check the limit at all.
- **Fix:** Add road count check before placing:
```diff
+ const playerRoads = Object.values(nextBoard.edges).filter(e => e.owner === action.playerId).length;
  const edges = [action.edgeId1];
  if (action.edgeId2) edges.push(action.edgeId2);
+ if (playerRoads + edges.length > 15) {
+   return { success: false, error: 'Maximum roads reached' };
+ }
```

- **Status:** 🟢 Fixed

### 🟠 HIGH: Catan VP Inline Increments Are Dead Code
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (lines 406, 486)
- **Issue:** `activePlayer.victoryPoints += 1` is called inline in BUILD_SETTLEMENT and UPGRADE_CITY, but `checkWinConditionAndAwards` immediately recalculates VP from scratch, overwriting these. The inline increments have no effect.
- **Fix:** Remove the inline `activePlayer.victoryPoints += 1` lines to avoid confusion.

- **Status:** 🟢 Fixed

---

### 🟡 MEDIUM: Monopoly `ACCEPT_TRADE` Doesn't Re-validate Funds
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (ACCEPT_TRADE handler)
- **Issue:** A player's money situation may change between proposal and acceptance. The trade could put a player into negative money.
- **Fix:** Add fund validation at acceptance:
```diff
  if (fromPlayer && toPlayer) {
+   if (fromPlayer.money < trade.offeredMoney) {
+     nextState.activeTrade = null;
+     return { success: false, error: 'PROPOSER_INSUFFICIENT_FUNDS' };
+   }
+   if (toPlayer.money < trade.requestedMoney) {
+     return { success: false, error: 'INSUFFICIENT_FUNDS' };
+   }
```

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Monopoly Trade Doesn't Handle Mortgage Transfer
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (ACCEPT_TRADE handler)
- **Issue:** Mortgaged properties are traded but per official rules, the new owner must immediately pay 10% interest on the mortgage value.
- **Fix:** After transferring each property, check if it's mortgaged and charge interest:
```diff
  trade.offeredProperties.forEach((propId) => {
    nextState.ownership[propId] = toPlayer.id;
+   if (nextState.mortgagedProperties[propId]) {
+     const space = BOARD_SPACES.find(s => s.id === propId);
+     if (space?.price) {
+       const interest = Math.ceil(Math.floor(space.price / 2) * 0.1);
+       toPlayer.money -= interest;
+       nextState.bankMoney += interest;
+     }
+   }
  });
```

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Catan `END_TURN` Allowed Without Rolling Dice
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (END_TURN handler) and `types.ts`
- **Issue:** No `hasRolled` flag exists, so players can end their turn immediately without rolling.
- **Fix:** Add `hasRolled: boolean` to `ICatanState`, set to `false` in `getInitialState`, `true` after `ROLL_DICE`, `false` on `END_TURN`. Check in `END_TURN`: `if (!currentState.hasRolled) return error`.

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Scotland Yard Biased Position Shuffle
- **Location:** `packages/scotland-yard-engine/src/ScotlandYardEngine.ts` (line 73)
- **Issue:** `.sort(() => rng.next() - 0.5)` is a biased shuffle — not uniform.
- **Fix:** Import and use `shuffleArray` from `@packages/engine-core`:
```diff
+ import { shuffleArray } from '@packages/engine-core';
  // ...
- const shuffledPositions = [...STARTING_POSITIONS].sort(() => rng.next() - 0.5);
+ const shuffledPositions = shuffleArray(STARTING_POSITIONS, rng);
```

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Scotland Yard `this` Reference Fragility in `reduce`
- **Location:** `packages/scotland-yard-engine/src/ScotlandYardEngine.ts` (line 148)
- **Issue:** `this.isValidAction(...)` depends on call context. If `reduce` is destructured, `this` will be `undefined`.
- **Fix:** Use `ScotlandYardEngine.isValidAction(...)` instead.

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Catan Starting Resources Are 10 Each (Debug Value)
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (line 144)
- **Issue:** `resources: { WOOD: 10, BRICK: 10, SHEEP: 10, WHEAT: 10, ORE: 10 }` — standard Catan starts players with 0 resources.
- **Fix:** Change all values to `0`.

- **Status:** 🟢 Fixed

### 🟡 MEDIUM: Catan Initial Placement Phase Not Implemented
- **Location:** `packages/catan-engine/src/CatanEngine.ts` (line 169)
- **Issue:** Game starts in `MAIN_TURN` but types define `INITIAL_PLACEMENT_1`/`INITIAL_PLACEMENT_2`. Actions `PLACE_INITIAL_SETTLEMENT` and `PLACE_INITIAL_ROAD` have no handler in `reduce`.
- **Status:** ✅ Resolved — implemented in Phase 30 (see Completed Fix #13 above). Game now begins in `INITIAL_PLACEMENT_1` with `PLACE_INITIAL_SETTLEMENT` / `PLACE_INITIAL_ROAD` reducers, a new `initial-placement.test.ts` suite, and placement UI.

---

### 🔵 LOW: Monopoly Finite Bank Money
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (line 41)
- **Issue:** `bankMoney: 20580` — standard Monopoly treats the bank as unlimited.
- **Fix:** Change to `bankMoney: Infinity`.

- **Status:** 🟢 Fixed

### 🔵 LOW: Monopoly Pass GO Edge Case
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts` (lines 150-155)
- **Issue:** The pass-GO check `if (currentPlayer.position < oldPosition)` relies on strict `<` comparison. With 2 dice (max roll 12), the standard board position wrap always satisfies this, so this is a cosmetic edge case that only matters for card-directed movements (which handle $200 separately).
- **Status:** Not a practical bug with current mechanics but code should be aware.

### 🔵 LOW: Scotland Yard `winner` Field Not in `IGameState`
- **Location:** `packages/scotland-yard-engine/src/types.ts` (line 22)
- **Issue:** `winner?: PlayerRole` is Scotland Yard-specific and not part of `IGameState`. Works fine via structural typing but is inconsistent with other engines.
- **Status:** Cosmetic inconsistency.

---

## 📝 Proposed Fixes for Final Audit Findings

The following fixes address the verified open issues outlined in `FINAL_AUDIT.md`.
**Update (Security & Integrity Hardening pass):** most findings below are now implemented — see Completed Fix #18 above. Items still marked **NOT YET DONE** remain open.

### 🔴 CRITICAL: Player Impersonation (CRITICAL-1)
- **Location:** `packages/server/src/server.ts`
- **Issue:** The WebSocket message handler does not cross-reference the `playerId` inside the JSON payload against the socket's authenticated session identity.
- **Proposed Fix:** Extract `playerId` from the verified session token upon WS connection. Force `action.playerId = session.playerId` before passing the action to `room.dispatch(action)`, ignoring any client-provided `playerId`.
- **Status:** ✅ Done

### 🔴 CRITICAL: Hidden Information Broadcast (CRITICAL-2 & CRITICAL-3)
- **Location:** `packages/server/src/Room.ts`, `CatanEngine.ts`, `MonopolyEngine.ts`
- **Issue:** Raw authoritative state and events are broadcasted to all clients, leaking dev card decks, chance decks, and hidden events.
- **Proposed Fix:** Implement `getStateForPlayer` in `CatanEngine` and `MonopolyEngine` to scrub decks (replace with counts) and hide opponents' private cards. Update `Room.ts` to implement `getEventsForPlayer` (or filter prior to broadcast) and filter private events (like `STOLEN_RESOURCE` details) before broadcasting.
- **Status:** ✅ State projection done (`getStateForPlayer` added to both engines; `Room` already broadcasts per-connection projections). Per-player *event* filtering was not added — Catan/Monopoly events are public by game rules and Scotland Yard already scrubs Mr. X's position inside its `PLAYER_MOVED` event.

### 🔴 CRITICAL: Catan `PLAY_ROAD_BUILDING` Missing Connectivity Validation (CRITICAL-4)
- **Location:** `packages/catan-engine/src/CatanEngine.ts`
- **Issue:** `PLAY_ROAD_BUILDING` skips connectivity validation.
- **Proposed Fix:** Extract connectivity validation from `BUILD_ROAD` into a helper function. Enforce that the first road connects to the existing network, and the second road connects to the network OR the newly placed first road.
- **Status:** ✅ Done

### 🔴 CRITICAL: Game-Agnostic Zod Schema (CRITICAL-5)
- **Location:** `packages/server/src/schemas.ts`
- **Issue:** A single discriminated union for all three games allows wrong-game or under-specified actions.
- **Proposed Fix:** Split `actionSchema` into game-specific schemas (`catanActionSchema`, `monopolyActionSchema`, `scotlandYardActionSchema`). Have the server validate against the specific schema matching the room's `gameType`. 
- **Status:** ✅ Done

### 🔴 CRITICAL: No Persistence / Crash-Recovery (CRITICAL-6)
- **Location:** `packages/server/src/RoomManager.ts`
- **Issue:** State is entirely in-memory.
- **Proposed Fix:** Integrate Redis. Write the serialized `gameState`, event log, and player map to a Redis hash on every `reduce()`. On startup, `RoomManager` should rehydrate rooms from Redis.

### 🟠 HIGH: WebSocket Rate Limiting & Room Capacity (MED-2, MED-3)
- **Location:** `packages/server/src/server.ts`, `RoomManager.ts`
- **Issue:** No limits on room creation or WebSocket actions, creating DoS vectors.
- **Proposed Fix:** Integrate `@fastify/rate-limit` for HTTP endpoints. Implement a token-bucket rate limiter per WebSocket connection. Cap `RoomManager.rooms.size` at a sensible limit (e.g., 10,000 rooms).
- **Status:** ⚠️ MED-3 done (room cap `MAX_ROOMS = 10000` added). MED-2 (WebSocket/HTTP rate limiting) **NOT YET DONE**.

### 🟠 HIGH: Socket Connection Leaks & Session Reconnection (MED-1, MED-6)
- **Location:** `packages/server/src/RoomManager.ts`, `Room.ts`
- **Issue:** Idle rooms are deleted but sockets aren't closed. Reconnections orphan old sockets.
- **Proposed Fix:** In `RoomManager` cleanup, iterate `room.connections.values()` and call `.close()` before deleting the room. In `Room.addConnection`, explicitly `close()` the existing socket for that `playerId` before replacing it.
- **Status:** ✅ Done

### 🟠 HIGH: Unbounded Session-Token Claims & Stalled Disconnects (MED-5, MED-9)
- **Location:** `packages/server/src/server.ts`, `Room.ts`
- **Issue:** Session tokens never expire if unredeemed. Disconnected players stall the game indefinitely.
- **Proposed Fix:** Add a TTL to reserved session tokens. Add a heartbeat (ping/pong) to WS connections to detect drops. Implement a forfeit timer (e.g., 5 mins) that skips a disconnected player's turn or transitions them to a forfeit state.
- **Status:** ⚠️ **NOT YET DONE**

### 🟡 MEDIUM: Action Guard Flaws (MED-7, MED-8, LOW-9)
- **Location:** `ScotlandYardEngine.ts`, `MonopolyEngine.ts`
- **Issue:** Scotland Yard action guard lacks active player identity check. Monopoly `ROLL_DICE` lacks `hasRolled` check. Monopoly gets stuck in 'LOBBY'.
- **Proposed Fix:** 
  - Scotland Yard: add `if (action.playerId !== currentState.activePlayerId) return false;`. 
  - Monopoly: add `if (currentPlayer.hasRolled) return { success: false, error: 'Already rolled' };` inside the `ROLL_DICE` reducer. Add a status transition from 'LOBBY' to 'IN_PROGRESS' when initialization is complete.
- **Status:** ✅ MED-7 & MED-8 done. LOW-9 (Monopoly LOBBY → IN_PROGRESS transition) **NOT YET DONE**.

### 🟡 MEDIUM: Silent Action Rejection (MED-4)
- **Location:** `packages/server/src/Room.ts`
- **Issue:** Reducer rejections are returned silently.
- **Proposed Fix:** When `room.dispatch(action)` returns `{ success: false, error }`, send an `{ type: 'ACTION_REJECTED', error }` message directly back to the offending client so the UI can display a toast.
- **Status:** ✅ Done

### 🔵 LOW: Zod Schema Strictness (LOW-1)
- **Location:** `packages/server/src/schemas.ts`
- **Issue:** `DISCARD_RESOURCES` accepts negative numbers, `TRADE_BANK` accepts floats.
- **Proposed Fix:** Use `.int().nonnegative()` for `DISCARD_RESOURCES` values and `.int().positive()` for `TRADE_BANK` amounts.
- **Status:** ✅ Done

### 🔵 LOW: Catan Dev-Card Immutability (LOW-10)
- **Location:** `packages/catan-engine/src/CatanEngine.ts`
- **Issue:** Mutating `boughtThisTurn = false` on a shared reference in `END_TURN`.
- **Proposed Fix:** In `END_TURN`, map the array to deep-copy the cards: `activePlayer.developmentCards = activePlayer.developmentCards.map(c => ({ ...c, boughtThisTurn: false }))`.
- **Status:** ✅ Done — cards are deep-copied during the player clone in `reduce`, so the shared reference is broken at the source.

### 🔵 LOW: Performance & Randomness Tweaks (LOW-2, LOW-3, LOW-4, LOW-5, LOW-6)
- **Location:** Server, Web Client, Engines
- **Issue:** Coarse RNG, exponential DFS memo, linear find, Math.random for IDs.
- **Proposed Fix:** 
  - Use `crypto.randomUUID()` for unique IDs instead of `Math.random` (LOW-5, LOW-6).
  - Precompute a `Map<string, BoardSpace>` for Monopoly spaces instead of using `.find()` on arrays (LOW-4).
  - Use a higher precision RNG for server shuffling (LOW-2).
- **Status:** ⚠️ **NOT YET DONE**

