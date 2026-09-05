# 🚀 Universal Multiplayer Board Game Platform - Master Tracker

This document tracks the high-level roadmap, detailed implementation specifications, and completion status for the entire Board Game Server project (focusing on both Monopoly and Catan engines).

---

## 🟢 Completed Phases & Implemented Features

### 🟢 Phase 1: Architecture & Modular Foundation (`@packages/engine-core`)
- Initialized NPM monorepo workspace with TypeScript project references.
- Defined strict, pure, immutable interfaces (`IGameEngine`, `IGameState`, `IPlayerAction`, `IGameEvent`).
- Standardized strict typing for `PlayerId`, `PropertyId`, and error payloads (`actionError`).

### 🟢 Phase 2: Monopoly Engine Core (`@packages/monopoly-engine`)
- Implemented deterministic state machine reducer with zero side-effects.
- Added core actions: `ROLL_DICE`, `END_TURN`.
- Full TDD coverage with injected Random Number Generator (`rng`) for deterministic tests.

### 🟢 Phase 3: WebSocket Server & Room Management (`@packages/server`)
- Built Fastify + `@fastify/websocket` server.
- Generic `Room` class wrapping `IGameEngine` instances with thread-safe action dispatch.
- Strict Zod validation schemas for all incoming client actions and messages.
- Automatic broadcast of game states and discrete events to connected room sockets.

### 🟢 Phase 4: React UI & Web Client MVP (`@packages/web-client`)
- Scaffolded Vite + React + Tailwind CSS client application.
- Implemented Lobby UI with HTTP endpoints to Create and Join rooms.
- Implemented real-time Game Room UI syncing state over WebSockets with optimistic controls.

### 🟢 Phase 5: Core Property & Rent Mechanics (Monopoly)
- Configured all 40 standard spaces in static `board.ts` with color groups, rents, and costs.
- Automated rent calculation and deduction upon landing on opponent-owned properties.
- Implemented `BUY_PROPERTY` action with player balance validation and ownership assignment.

### 🟢 Phase 6: Interactive Board UI & HUD Injection (Monopoly)
- Rendered live ownership badges with player color markers.
- Implemented contextual HUD controls in the center of the board.
- Added toast notification system for game events (`PROPERTY_BOUGHT`, `RENT_PAID`, `TAX_PAID`, `PASSED_GO`).

### 🟢 Phase 7 (Core): Advanced Rules & Cards Engine (Monopoly)
- **Passing GO:** Automated detection of board wrap-around with $200 award (`PASSED_GO` event).
- **Jail & Bailout:**
  - `GO_TO_JAIL` triggers on landing on space 30 or rolling doubles 3 consecutive times.
  - Escape via rolling doubles during turn or paying $50 bail via `PAY_JAIL_FINE`.
  - Max 3 turns in jail before forced fine payment on roll.
- **Taxes:** Automatic calculation and deduction for Income Tax ($200) and Luxury Tax ($100).
- **Chance & Community Chest Cards:**
  - Defined standard 16-card decks with programmatic effects (`MOVE_TO_POSITION`, `COLLECT_MONEY`, etc).
  - Built deterministic shuffle logic synced with engine RNG.
  - Interactive Modal UI to display drawn cards to players on the board.
  - Backward compatibility logic implemented to patch existing game states on-the-fly.
  - Fixed `COLLECT_FROM_PLAYERS` logic to handle negative money by properly creating individual debts.
  - 🟢 **Edge Cases & Safety:** Confirmed proper tracking of get-out-of-jail free cards, debt enforcement during bankrupt/poor card events, and the 3-doubles-in-a-row speeding rule.

### 🟢 Phase 8 (Core): Real Estate Economy & Property Actions (Monopoly)
- **Monopoly Set Detection:** Automatic double base rent calculation when an entire color group is owned with no houses.
- **House & Hotel Development:**
  - Implemented `BUY_HOUSE` and `SELL_HOUSE` actions.
  - Enforced even-build rule across color groups (cannot build on a property if others in the group have fewer houses).
  - Scaled tiered rents from 1-4 houses up to hotel (5).
  - Enforced strict component limits of exactly 32 houses and 12 hotels on the board.
- **Mortgage System:**
  - Implemented `MORTGAGE_PROPERTY` (receive 50% mortgage value, disables rent collection).
  - Implemented `UNMORTGAGE_PROPERTY` (pay back 50% mortgage value + 10% interest).
  - Validated that properties cannot be mortgaged if houses exist on that color set.

### 🟢 Phase 9: Trading System (Monopoly)
- **Trade Proposal & Negotiation:** `PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, and `CANCEL_TRADE` actions allowing players to swap combinations of properties and cash safely.
- **Trade UI:** Interactive modal to select trade partner, offer assets, and request assets with clear acceptance/rejection states.

### 🟢 Phase 10 (Core): Rich Visual Board & Property Management Modal (Monopoly)
- Implemented 11x11 CSS Grid layout matching standard Monopoly proportions.
- Created interactive `PropertyManager` modal to inspect deeds, build/sell houses, and mortgage/unmortgage.
- Animated CSS bouncing player tokens for current positions.
- Differentiated special spaces (Chance, Community Chest, Tax) with distinct shiny gradient bars.
- Aligned player tokens parallel to property edges to preserve text readability.
- **Event Log:** Floating scrollable UI tracking historical game events (`DICE_ROLLED`, `PROPERTY_BOUGHT`, etc.).
- **Game Restart:** Configured engine support for `RESTART_GAME` to fully reset state, with a confirmation modal in the UI.
- **UI Layout:** Removed top generic header and migrated title to document `<title>` to maximize vertical screen real estate for the board.

### 🟢 Phase 11: Bankruptcy & Win Condition (Monopoly)
- **Debt Resolution State:** When an automated rent/tax deduction exceeds cash balance, transition player into `DEBT` state instead of direct failure.
- **Liquidation Flow:** Allow player to sell houses, mortgage properties, or trade to settle debt.
- **Bankruptcy Declaration:** If unable to settle debt, declare bankruptcy and transfer all remaining assets to creditor (or bank).
- **Game Over / Winner:** Automatically detect when only 1 active player remains and declare winner.

---


### 🟢 Phase 12: Audio & Visual Polish
- **Animations:** Replaced static grid cells with absolutely positioned tokens that interpolate space-by-space dynamically via precise CSS coordinate extraction. Added a 3D/CSS dice roll overlay animation.
- **Sound Effects:** Procedurally generated sound effects for dice rolls, turn chimes, cash transactions, and jail bars using the native browser Web Audio API (`SoundEngine.ts`).
- **Audio Control:** Implemented a global `<AudioToggle />` UI component mapped directly to the SoundEngine's muting state, verified by a full Vitest + React Testing Library test suite in the web client.
- **Event & State Synchronization:** Disconnected raw backend state updates from visual logic. The UI now securely buffers state updates and event popups (Chance cards, passing GO, etc.) behind a strict 1.5-second animation delay queue so they don't break immersion during dice rolls.
- **Engine Reliability:** Fixed comprehensive TypeScript strict-null index errors in `MonopolyEngine.ts` and updated the `GAME_OVER` definitions for graceful handling of tie-out bankruptcy scenarios.
- **Tooling & Configuration:** Resolved persistent Vite configuration type errors in the monorepo by safely casting plugin types, ensuring a clean `tsc` and lint execution across packages.
- **Lobby Adjustment:** Temporarily disabled Online Multiplayer mode to isolate hot-seat local testing.

### 🟢 Phase 13: Multi-Game Architecture & Catan Engine Core (`@packages/catan-engine`)
- 🟢 **Refactoring:** Dynamic engine loader in `packages/server/src/server.ts` supporting `gameType`.
- 🟢 **Lobby Update:** React UI game selector (Monopoly vs. Catan).
- 🟢 **Catan Engine:** Implement `@packages/catan-engine` with pure state reducers, matching `IGameEngine` architecture.
- 🟢 **Catan Core Actions:** Deterministic dice rolling and initial placement phase logic.

### 🟢 Phase 14: Catan Hex Grid UI & Client Integration
- 🟢 **Hex Grid UI:** Interactive CSS/SVG hex grid for Catan board rendering, coordinates parsing, and rendering tile types/numbers.
- 🟢 **Client Syncing:** Integrate the Catan engine into the web client React UI with optimistic state updates.
- 🟢 **Game Room Update:** Dynamic rendering of board depending on whether game type is `monopoly` or `catan`.

### 🟢 Phase 15: Catan Core Mechanics (Resources & Building)
- 🟢 **Resource Generation:** Automated calculation of resources (wood, brick, sheep, wheat, ore) based on dice roll and adjacent settlements. Verified 2x yields for cities.
- 🟢 **Building:** Implement `BUILD_ROAD`, `BUILD_SETTLEMENT`, and `UPGRADE_CITY` actions with resource deduction and coordinate validation.
- 🟢 **Piece Limits:** Guaranteed 5 settlement, 4 city, and 15 road limits for players.

---

### 🟢 Phase 16: Catan Trading System
- 🟢 **Maritime Trade:** Implement `TRADE_BANK` actions (4:1 standard, or 3:1/2:1 if owning ports).
- 🟢 **Player Trade:** Implement trade proposal, negotiation, and acceptance modals similar to Monopoly but for resources.
- 🟢 **Universal Rulebook UI:** Added a shared `RulebookModal` component and top-bar "Rules" button across both Monopoly and Catan game screens for quick reference to game objectives and mechanics.

### 🟢 Phase 17: Catan Advanced Logic (Robber & Development Cards)
- 🟢 **Robber Mechanics:** Implement action to move robber on a roll of 7, steal from adjacent players, and forced resource discarding for >7 cards.
- 🟢 **Development Cards:** Implement `BUY_DEV_CARD` and playing specific cards (Knight, Year of Plenty, Monopoly, Road Building).

### 🟢 Phase 18: Catan Awards, Win Condition & Polish
- 🟢 **Achievements:** Automated tracking and awarding of Longest Route (requires DFS pathfinding, min 5 roads) and Largest Army (min 3 knights).
- 🟢 **Win Condition:** Automatically declare winner upon reaching 10 Victory Points (including hidden VP cards, which can be played on the turn purchased to win).
- 🟢 **Audio & Visual Polish:** Catan-specific animations, dice rolls, and sound effects.

### 🟢 Phase 19: Edge Cases & Rule Enforcement
- 🟢 **Monopoly Edge Cases:** Implemented the 10% interest rule for mortgaged properties during bankruptcy, enforced the even-build/sell rule, blocked building and trading if properties are mortgaged or have buildings, and added the $50 jail fine mechanics on turns 1-3.
- 🟢 **Catan Edge Cases:** Restricted playing development cards to one per turn (excluding those bought the same turn). Automated 2 VP awards for the Longest Road and Largest Army achievements.
- 🟢 **Comprehensive Testing:** Added 100% test coverage for these edge case scenarios in `packages/monopoly-engine/__tests__/edge-cases.test.ts` and `packages/catan-engine/__tests__/edge-cases.test.ts`.
- 🟢 **Performance & Immutability:** Optimized Monopoly Engine CPU usage by replacing structured clones with shallow state cloning. Fixed critical immutability violations in Catan Engine robber placement.
- 🟢 **UI Synchronization:** Resolved UI mismatches for Catan engine updates, including robber placement logic when there are no valid victims, added missing toast notifications for advanced mechanics (discarding, moving robber, stealing, playing/buying dev cards), and fixed the Road Building development card edge case to allow optional single road placement.

### 🟢 Phase 20: Engine & Graph Architecture (`@packages/scotland-yard-engine`)
- 🟢 **Graph Generation:** Downloaded and parsed the AlexElvers dataset to programmatically generate the full 199-node map graph with typed connections (Taxi, Bus, Underground, Secret).
- 🟢 **Pure State Reducer:** Implemented the `ScotlandYardEngine` adhering strictly to `IGameEngine` interfaces.
- 🟢 **Core Logic:** Handles Mr. X vs Detective ticket limits, random initial positioning, ticket deduction, game loop turnover, and basic game over states (Detectives win if Mr. X is caught, Mr. X wins if he survives 24 turns or detectives are stuck).
- 🟢 **Integration:** Successfully integrated the engine into the Fastify backend's dynamic engine loader.
- 🟢 **Testing:** Added robust 100% test coverage for engine transitions and Game Over states.

### 🟢 Phase 21: Hidden Movement & Mechanics (`@packages/scotland-yard-engine`)
- 🟢 **Mr. X Hidden State:** Safely stripped Mr. X's position from `PLAYER_MOVED` events during hidden turns.
- 🟢 **Reveal Turns:** Fully automated revelation of Mr. X's position on turns 3, 8, 13, 18, and 24.
- 🟢 **Ticket Flow:** Enforced deduction of tickets from Mr. X and Detectives, accurately passing Detective-used tickets to Mr. X.
- 🟢 **Double Moves:** Integrated the unique Double Move ticket allowing Mr. X to perform two back-to-back transports seamlessly.

### 🟢 Phase 22: Map UI & Client Integration (`@packages/web-client`, `@packages/scotland-yard-engine`)
- 🟢 **Map Coordinates:** Transcribed 199 nodes for the Scotland Yard board, structured and exported as `scotlandYardPositions`.
- 🟢 **Interactive Map (`ScotlandYardBoard.tsx`):** Created a dynamic SVG map utilizing `react-zoom-pan-pinch` for fluid panning/zooming.
- 🟢 **Player Visibility:** Handled visibility logic for Detectives and Mr. X (visible on reveal turns or if local player is Mr. X).
- 🟢 **Game Room Integration (`ScotlandYardRoom.tsx`):** Connected the frontend to `ScotlandYardEngine` over WebSockets. Implemented Double Move dispatching and ticket selection.
- 🟢 **Engine Typings Update:** Refactored `ScotlandYardState.players` to an array to align perfectly with the core `IGameState` interface. Tests updated accordingly.

### 🟢 Phase 23: HUD & Specialized Tools
- 🟢 **Mr. X Travel Log:** Built the Travel Log UI allowing Detectives to accurately track Mr. X's history of tickets used.
- 🟢 **Ticket Inventory:** Added Detective ticket inventories for the HUD.
- 🟢 **Ticket Flow:** Ensured tickets seamlessly flow from Detectives to Mr. X upon usage, and added a specific dropdown selector for Mr. X to use Secret/Double tickets.

### 🟢 Phase 24: Win Conditions & Polish (`@packages/scotland-yard-engine`, `@packages/web-client`)
- 🟢 **Automated Win States:** Check if Mr. X is trapped (Detectives win) or if all Detectives are stuck without valid tickets (Mr. X wins).
- 🟢 **Thematic Polish:** Added distinct sound effects for `taxi`, `bus`, `underground`, and `secret`/`double` moves, along with a siren effect.
- 🟢 **Game Over Overlay:** Built a dramatic full-screen game over overlay natively distinguishing between a Detective Win or Mr. X Win.

---

### 🟢 Phase 25: Test Pipeline, CI/CD & Build Reliability
- 🟢 **Test Pipeline Health:** Deleted stale compiled `.js` test artifacts committed under `packages/*/{test,__tests__}` that crashed Vitest, added compiled-output patterns to `.gitignore`, and fixed the 7 failing engine assertions. `npm test` is fully green — 12 files / 81 tests in ~2s (previously 12/21 files failed and the suite took ~40s).
- 🟢 **Web-Client Compiles:** Resolved every `tsc -b` error in the client (missing `SoundEngine` import, undeclared `gameOver` state hook, `PlayerId` indexing of `pendingDiscards`, unused `TransportType`/`activePlayer`). Verified with a clean production `vite build`.
- 🟢 **Server Build & Start:** Added `tsconfig.build.json` (`rootDir: src`, `include: src/**`) so `tsc` emits a flat `dist/server.js`; wired `build` (`tsc -p tsconfig.build.json`) and `start` (`tsx dist/server.js`) scripts. `npm run build` and `npm start` both verified — server boots and listens on port 3000.
- 🟢 **Root Lint & CI/CD Pipeline:** Installed root `oxlint` with an `.oxlintrc.json` scoped to engines + server; rewrote the GitHub Actions workflow to run on Node 24 via `npm ci` + cache with typecheck, both lint passes, the full test suite, server build, and web-client build — removing all `|| true` masking so regressions fail the build.

### 🟢 Phase 26: Server Hardening & Security (`@packages/server`)
- 🟢 **Typed Engine Registry:** Replaced the `Record<string, any>` engine loader with `Record<string, IGameEngine<IGameState, IPlayerAction, IGameEvent>>` — no `any` remains in engine selection.
- 🟢 **Room Auth & Session Tokens:** Room IDs use `crypto.randomUUID()`; each joining player is issued a per-room session token; WebSocket connections require `?playerId=` + `token=` verified against the room; `getAvailablePlayerId` also excludes token-claimed slots. The web client threads `sessionToken` from Lobby → App → all three game rooms so connections are authenticated.
- 🟢 **RNG & CORS:** Gameplay RNG uses `crypto.randomInt` (unpredictable, anti-cheat); CORS restricted to `http://localhost:5173`.
- 🟢 **Observability:** All server logging (connection open/close, WebSocket errors, startup failures) is routed through `fastify.log` — no stray `console.*` calls.

### 🟢 Phase 27: Engine Rule Hardening & Anti-Exploit (`@packages/catan-engine`, `@packages/monopoly-engine`, `@packages/scotland-yard-engine`)
- 🟢 **Catan Turn-Phase Enforcement:** Rewrote `isValidAction` from a stub into full phase-aware validation (blocked when `FINISHED`; `DISCARD_RESOURCES` / `ACCEPT_TRADE` / `REJECT_TRADE` allowed for the relevant non-active player; `MOVE_ROBBER` gated to `ROBBER_PLACEMENT`; dev-card plays blocked when one was already played this turn). Added matching guards to `BUILD_SETTLEMENT` / `BUILD_ROAD` / `UPGRADE_CITY`.
- 🟢 **Catan `hasRolled` Turn Gate:** Added `hasRolled` to `ICatanState`; players must roll before ending their turn and may not roll twice in one turn (`alreadyRolled` guard).
- 🟢 **Catan Determinism & Immutability:** Replaced `Math.random()` trade/dev-card IDs with the injected `rng`; fixed `PLAY_ROAD_BUILDING` edge-ownership mutation to shallow-clone; removed dead inline VP increments (VP now always derived from the board by `checkWinConditionAndAwards`).
- 🟢 **Catan Piece-Limit & Placement Fixes:** Enforced the 15-road limit in `PLAY_ROAD_BUILDING`; allowed building a road connected via an empty vertex adjacent to the player's own road; changed starting resources from 10-of-each (debug) to 0, matching official Catan (the initial-placement phase that followed was later implemented in Phase 30).
- 🟢 **Catan Longest-Road Tie/Revoke Semantics:** When two players tie at the max road length and the current holder is not among them, the award is revoked (`owner = null`); when the holder *is* inside the tie, its length is refreshed. `checkWinConditionAndAwards` early-returns once the game is `FINISHED` so awards are never re-awarded post-game.
- 🟢 **Monopoly Infinite Bank:** Changed `bankMoney: 20580` → `bankMoney: Infinity` (unlimited bank per standard rules).
- 🟢 **Monopoly Chance-Card Rent Multipliers:** "Advance to nearest Railroad" now doubles the railroad rent; "Advance to nearest Utility" forces a 10x dice-roll rent.
- 🟢 **Monopoly Trade Safety:** `ACCEPT_TRADE` re-validates sufficient funds at acceptance time (rejects `PROPOSER_INSUFFICIENT_FUNDS` / `INSUFFICIENT_FUNDS`) and charges the 10% mortgage interest to the new owner when a mortgaged property is transferred.
- 🟢 **Monopoly End-Game Guard & Bankruptcy Cleanup:** `END_TURN` detects when only ≤1 active player remains and finishes the game (prevents the infinite bankrupt-player loop); `DECLARE_BANKRUPTCY` returns any Community Chest get-out-of-jail cards to the chest deck.
- 🟢 **Scotland Yard Determinism:** Replaced the biased `.sort(() => rng.next() - 0.5)` start-position shuffle with `shuffleArray`; made `reduce` call `ScotlandYardEngine.isValidAction` statically (removes fragile `this` binding).
- 🟢 **Testing:** Expanded `edge-cases.test.ts` (longest-road tie/revoke, empty-vertex road connectivity, phase-aware `isValidAction`, END_TURN guards, post-game award skip), `debt.test.ts` (bankruptcy card return, Infinity bank), and Catan `catan.test.ts`. Full suite green (242 tests); typecheck and lint clean.

### 🟢 Phase 28: Shared-Board Hidden Movement & Per-Player Projection (`@packages/scotland-yard-engine`, `@packages/server`, `@packages/web-client`, `@packages/engine-core`)
- 🟢 **Same-Board Visibility:** Fixed the shared hot-seat board so everyone (including Mr. X) can play together. Previously `ScotlandYardBoard.tsx` used `isLocal` (true for *all* local players in hot-seat), which leaked Mr. X's exact location to every detective and broke hidden movement. Mr. X's token is now hidden on the shared board except on reveal turns, during Mr. X's own active turn, or after game over — with a `MrXShadow` ("Mr. X is on the move...") indicator shown when hidden.
- 🟢 **Per-Player State Projection:** Added optional `getStateForPlayer?(state, playerId)` to the core `IGameEngine` interface for hidden-information engines. `ScotlandYardEngine` implements it to scrub Mr. X's `position` (set to sentinel `0`) for non-Mr-X viewers except on reveal turns / game-over; Mr. X always receives his true position.
- 🟢 **Server-Side Scrubbing:** `Room.broadcastState` now sends a projected `STATE_UPDATE` per connection (when the engine exposes `getStateForPlayer`) instead of one shared payload, so Mr. X's real location is never leaked over the WebSocket to opposing players.
- 🟢 **Testing:** Added 4 projection tests (Mr. X full state, detective scrubbing, reveal-turn preservation, game-over preservation) to `game-flow.test.ts`. Full suite green (242 tests), typecheck and lint clean.
- 🟢 **Agent Context Refactor:** Renamed `GEMINI.md` → `AGENTS.md` (and `packages/web-client/GEMINI.md` → `AGENTS.md`) so any LLM agent tooling can discover the rules/skills via a standard filename.

### 🟢 Phase 29: Per-Game Player Count Rules & Scotland Yard Board Polish (`@packages/engine-core`, `@packages/server`, `@packages/web-client`, all engines)
- 🟢 **Shared Game Config:** Added `engine-core/src/gameConfig.ts` exporting `GAME_CONFIGS` (with `minPlayers`/`maxPlayers`) and the `GameType` union + `isGameType` guard. Ranges verified against official rules: **Monopoly 2–8**, **Catan 3–4**, **Scotland Yard 3–6**.
- 🟢 **Dynamic Lobby Player Selector:** `Lobby.tsx` now renders the Players dropdown from the selected game's range (previously a hardcoded 2/3/4 for every game) and re-clamps the current selection into range when switching games. Scotland Yard can now request 5–6 players (was capped at 4 by the old dropdown).
- 🟢 **Server-Side Validation:** `POST /rooms` validates `playerCount` against the per-game range, returns a clean `400` with a descriptive message for out-of-range values (previously accepted any count; Scotland Yard threw an uncaught 500), and defaults to `minPlayers` when omitted.
- 🟢 **Engine-Level Validation (defense in depth):** `MonopolyEngine` / `CatanEngine` / `ScotlandYardEngine` each throw on invalid counts in `getInitialState` — Monopoly "2 to 8", Catan "3 to 4", Scotland Yard updated from 2–6 to 3–6.
- 🟢 **Scotland Yard Map Fit-to-Screen:** `ScotlandYardBoard.tsx` now measures its container (`ResizeObserver`) and computes an `initialScale = min(w/1600, h/1200)` so the entire map is visible without scrolling and fills the viewport; renders the zoom wrapper only after measurement to avoid a mount-time scale race. The container/SVG sizing and the room's height chain were fixed so the board no longer collapses into a small rectangle.
- 🟢 **Gentler Zoom:** Wheel/pinch zoom step reduced from `0.05` to `0.005` so a single scroll tick produces a subtle zoom instead of a large jump; `minScale` lowered to `0.1` and `limitToBounds` disabled for free panning.
- 🟢 **Ms. X Node Input Obscured:** In `ScotlandYardRoom.tsx` the destination-node input switches to `type="password"` (placeholder "Hidden (Mr. X)") during Mr. X's active turn so nearby detectives cannot read the node number he is entering.
- 🟢 **Migration of Catan tests to 3+ players** and new validation tests (Monopoly 2/8 accept + reject boundaries, Catan 3/4 accept + reject boundaries, Scotland Yard 3–6) plus a server `400` rejection test and Lobby dropdown-range tests. Full suite green (250 tests), typecheck and lint clean.

---

### 🟢 Phase 30: Catan Initial Placement & Online Multiplayer (`@packages/catan-engine`, `@packages/server`, `@packages/web-client`, `@packages/monopoly-engine`)
- 🟢 **Catan Initial Placement Phase:** Replaced the debug "empty-board `MAIN_TURN` start" with the full official setup flow (`getInitialState` now begins in `INITIAL_PLACEMENT_1`). Implemented `PLACE_INITIAL_SETTLEMENT` and `PLACE_INITIAL_ROAD` reducer cases with complete validation: Phase 1 placement in forward order p1→pN (free settlement + adjacent road each), Phase 2 in reverse order pN→p1 (second settlement + road), distance rule enforced, no resources granted at setup, and the pending road must connect to the just-placed settlement. The player who placed first in Phase 2 (player PN) rolls first. Added `placementOrder` / `placementIndex` / `placementStep` / `pendingRoadVertex` to `ICatanState`.
- 🟢 **Catan Tests Migrated:** Moved all existing tests to an `initMainTurn` helper (preserving prior behavior) plus a new 6-test `initial-placement.test.ts` suite covering the full two-round order, distance rule, road-follows-settlement, and first-roller determination.
- 🟢 **Placement UI:** `CatanRoom.tsx` now sends `PLACE_INITIAL_SETTLEMENT` on vertex clicks and `PLACE_INITIAL_ROAD` on edge clicks during placement (no dice/build mode required), sets the board's clickable mode from `placementStep`, shows a placement-target HUD banner, and hides Roll Dice / End Turn / build actions during setup. Server `schemas.ts` already whitelists both placement actions for WebSocket.
- 🟢 **Online Multiplayer Re-enabled:** Restored the Lobby's **Online** mode and Join Room flow end-to-end across machines (the client session-token plumbing was already in place from Phase 26). In Online mode, room creation auto-joins only the creator seat (`[playerIds[0]]`); the Join section calls `POST /rooms/:roomId/join`. Removed the prior `@ts-ignore` and `_`-prefixed dead code. Added Lobby tests for online-create (creator-only seat), join-by-id, join-error (404 room not found alert).
- 🟢 **Engine Validation Hardening (`isValidAction`):** Fixed the Monopoly and Catan `isValidAction` fallthrough from `return true` to `return false` so unknown or wrongly-timed action types are rejected at the server gate (defense-in-depth), while keeping `ROLL_DICE` / `END_TURN` explicitly valid and adding a dedicated Monopoly `BUY_PROPERTY` branch.
- 🟢 **Observability Completion:** `RoomManager`'s periodic idle-room cleanup now logs through an injectable logger (wired to `fastify.log.info` in `server.ts`) instead of `console.log` — completes the Phase 26 guarantee that no `console.*` calls remain in the server.
- 🟢 **Artifact Hygiene:** Removed stale compiled `.js` test/source artifacts and extended `.gitignore` (`*.tsbuildinfo`, `packages/*/src/*.js`, test `.js`, etc.) so future `tsc`/build runs no longer re-pollute the tree or break Vitest.
- 🟢 **Verification:** Full suite green (**26 test files / 259 tests**), `tsc --noEmit` typecheck clean, oxlint clean (root + web-client), and both `@packages/server` and `web-client` production builds pass.

### 🟢 Phase 31: State Persistence & Server Hardening (`@packages/server`)
- 🟢 **Redis Persistence (CRITICAL-6):** Integrated `ioredis` to safely persist state. The `RedisStore.ts` wrapper flushes updated room states to a Redis hash after every `reduce()`. The `RoomManager` rehydrates active rooms on boot, granting true crash-recovery capability (with in-memory Map fallback for local dev).
- 🟢 **Network Resilience & Capacity (MED-2):** Added `@fastify/rate-limit` for HTTP routes to prevent room spam. Implemented a Token-Bucket Rate Limiter natively on WebSocket connections, dropping bursts above 20 tokens (10/sec refill) and returning `ACTION_REJECTED`.
- 🟢 **Connection Lifecycle (MED-5, MED-9):** Added Ping/Pong heartbeats to safely detect dropped TCP connections. Unredeemed session tokens now expire after a 5-minute TTL. Actively disconnected players will automatically trigger a generic `FORFEIT` / `END_TURN` after a 5-minute timeout.
- 🟢 **Performance & RNG Tweaks (LOW-2, 4, 5, 6):** Upgraded `CryptoRandomProvider.next()` to produce cryptographically secure 32-bit floats. Replaced all collision-prone `Math.random` UI toast/event IDs across the React client with `crypto.randomUUID()`. Precomputed a constant-time `BOARD_SPACES_MAP` to optimize Monopoly's space lookups.
- 🟢 **Security Audit Fixes:** Validated and successfully patched all 18 security/systems audit findings across Catan, Monopoly, and Scotland Yard engines.

---

## 🟢 Infrastructure & Deployment (Phase 32)
- 🟢 **Containerization:** Containerized the Fastify server and Vite client with multi-stage Dockerfiles and a `docker-compose.yml`.
  - `packages/server/Dockerfile` — Multi-stage (Node 24 alpine): builds the server to `dist/server.js` via `tsc` (compiling referenced `@packages/*` sources), then a slim runtime stage installs prod deps (incl. `tsx`, moved to a prod dep so `tsx dist/server.js` can transpile the `.ts` workspace entry points) and runs the identical command used locally.
  - `packages/web-client/Dockerfile` — Multi-stage: builds the Vite bundle (with `VITE_API_URL` as a build arg) and serves static assets via nginx with an SPA-fallback config.
  - `docker-compose.yml` — Orchestrates `redis` (with `appendonly` persistence + healthcheck), `server`, and `client`; wires `REDIS_URL`, `PORT`, `HOST`, and `CORS_ORIGIN` envs; publishes server :3000 and client :5173.
  - `.env.example` documents `CLIENT_ORIGIN` / `CLIENT_API_URL`.
- 🟢 **Env-Driven Configuration:** `packages/server/src/server.ts` now reads `PORT` (default 3000), `HOST` (default `0.0.0.0` for container networking), and `CORS_ORIGIN` (comma-separated allow-list; default `http://localhost:5173,http://localhost:8080`). Verified the preflight `Access-Control-Allow-Origin` reflects the configured origin and rejects untrusted origins.
- 🟢 **Containerization Verified (live):** Docker engine + compose plugin installed on the dev machine; `docker compose build` builds both images and `docker compose up -d` runs `redis` + `server` + `client`. Verified: client serves on :5173, server API creates rooms on :3000, WebSocket auth + per-player Scotland Yard projection work, CORS allow-list blocks untrusted origins, and room state is persisted to Redis (`redis-cli KEYS room:*`).
- 🟢 **Crash-Recovery Bug Fixed (found in container test):** `RoomManager.initFromRedis` rehydrated rooms with an empty player list, so `Room`'s constructor threw (`engine.getInitialState([])` → "requires X players") and **no room ever survived a restart**. The `Room` constructor now accepts an optional persisted `initialState` snapshot. Verified live: restart the server container → previously-created rooms rehydrate and remain joinable.
- 🟢 **Automated VPS Deployment (git-push triggered):** Added `.github/workflows/deploy.yml` — on every push to `main` (or `workflow_dispatch`) it SSHes into the production VPS (via `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`/`VPS_PORT` secrets) and runs `docker compose up -d --build`, with a concurrency guard so only one deploy runs at a time. The workflow shallow-clones/pulls the repo into `/opt/board-game-server`, loads the server-side `.env` (never committed), rebuilds only changed layers, and prunes dangling images. `.env.production.example` documents the production-only overrides (`CLIENT_ORIGIN`, `CLIENT_API_URL`, optional `TURN_TIME_LIMIT_MS`); `.dockerignore` now excludes `.env*` from build contexts. Full local + production deployment flow documented in `README.md` "Production Deployment" and `docs/ARCHITECTURE.md` §9.
- 🟢 **Persistence `Infinity` Bug Fixed (found in container test):** `JSON.stringify` converts Monopoly's `bankMoney: Infinity` to `null`, so persisted rooms came back with a broken bank. Added `redisReplacer`/`redisReviver` (tagged-`Infinity` streaming) in `RedisStore.ts`; verified the snapshot stores `"__JSON_INFINITY__"` and rehydration restores the real value.
- 🟢 **Client Build Fix (pre-existing bug):** The production `web-client` build was failing because `EventLogEntry`/`Toast.id` were typed `number` while Phase 31 replaced `Math.random` with `crypto.randomUUID()` (string). Updated the types to `string` in `GameRoom.tsx` / `CatanRoom.tsx` so `tsc -b` passes again.
- 🟢 **Redis Pub/Sub Adapter:** Added `PubSubManager.ts` — a Redis Pub/Sub adapter enabling scalable WebSocket room broadcasting across multiple server instances. The `RedisStore` now exposes `duplicateClient()` for a dedicated subscriber connection. `Room` publishes `{state, events}` to its per-room Redis channel after every reduce() and delivers remote messages to local connections with per-player projection (re-projected via `getStateForPlayer`, preserving hidden-information guarantees). Subscription lifecycle follows the local connection count: the first local connection subscribes to the room channel, the last removes the subscription. In single-instance mode (no `REDIS_URL`) it remains a no-op so behavior is unchanged. Cross-instance delivery verified with `ioredis-mock` (2-instance publish→deliver, channel isolation, unsubscribe) plus Room-level subscription-lifecycle/remote-delivery/publish tests. Full suite green (297 tests), typecheck, root lint, and server build all pass.
- 🟢 **Security & Systems Audit:** All open findings from the final audit have been fully resolved in Phase 31.

---

## 🟢 Turn Timer / AFK Management (Phase 33)
- 🟢 **Engine forced-turn actions (pure reducers):** Added game-appropriate timeout actions to each engine, unit-tested in dedicated `turn-timer.test.ts` suites:
  - Monopoly: `FORCE_END_TURN` — advances to the next active player (skipping bankrupt players) and emits `TURN_TIMED_OUT`; valid regardless of `hasRolled` but blocked while the active player has an unresolved debt.
  - Catan: `FORCE_END_TURN` — emits `TURN_TIMED_OUT`; **only valid during `MAIN_TURN`** — never during sub-phases (e.g. `ROBBER_PLACEMENT`) or initial placement, which are mandatory and must not be auto-advanced. Cancels any active trade on force-end.
  - Scotland Yard: `SKIP_TURN` — skips the active player without moving and emits `TURN_SKIPPED`; handles stuck detectives (advances to the next movable player) and ends the game with an Mr X win if all detectives are stuck.
- 🟢 **Server-side per-room turn timer (`Room.ts`):** Each room tracks `turnStartedAt` (reset on every successful `dispatch`), and a `setInterval` tick (started on first connection, cleared on last/close, `unref()`'d) auto-dispatches the game's forced action once the active turn exceeds `turnTimeLimitMs`. Timeout is enforced only while a game is `IN_PROGRESS`; a rejected force (e.g. Catan sub-phase) re-arms rather than spamming. Both `turnStartedAt` and `turnTimeLimitMs` are persisted via Redis and restored on rehydration.
- 🟢 **Env-driven limit:** `TURN_TIME_LIMIT_MS` (default `0` = disabled) is read in `server.ts`, passed through `RoomManager` into every new/rehydrated room. Wiring: server → `Room` constructor option → room.
- 🟢 **STATE_UPDATE broadcasts `timer` metadata:** Every `STATE_UPDATE` now carries `{ turnStartedAt, turnTimeLimitMs }` (local and cross-instance via Pub/Sub) so clients render a live countdown.
- 🟢 **Client `TurnTimer` component + integration:** New `TurnTimer.tsx` renders a live countdown (mm:ss) with a color-coded bar (blue = opponent, yellow = your turn, red + pulse = <25% left), driven by the server-sent timer metadata; integrated into `GameRoom.tsx` (Monopoly), `CatanRoom.tsx`, and `ScotlandYardRoom.tsx`. Added `TURN_TIMED_OUT`/`TURN_SKIPPED` event feedback across all three clients.
- 🟢 **Security in schema whitelist:** Added `FORCE_END_TURN` (Monopoly/Catan) and `SKIP_TURN` (Scotland Yard) to the server action schemas. The forced actions are **system-initiated**: clients never send them; the server generates them internally on timeout, so the anti-impersonation `playerId` rewrite and `isValidAction` guard still apply.
- 🟢 **Verification:** New tests cover engine reducers, server schema whitelisting, Room timer metadata/reset/auto-forfeit/disabled, and the `TurnTimer` component. Full suite green (323 tests), root typecheck + lint clean, server and web-client production builds pass.
- 🟢 **Post-Phase Follow-up (Final Audit LOW-9, `fix:`):** The Monopoly turn timer was actually **never firing** — `MonopolyEngine.getInitialState` returned `status: 'LOBBY'` and the reducer never transitioned to `'IN_PROGRESS'`, while `Room.checkTurnTimeout` gates the forced-turn dispatch on `state.status === 'IN_PROGRESS'`, so Monopoly silently bypassed AFK enforcement (Catan/Scotland Yard start `IN_PROGRESS` and were unaffected). Fixed in `MonopolyEngine.reduce`: the first successful action now moves `LOBBY → IN_PROGRESS` (guards run first so rejected/unknown actions keep LOBBY; `RESTART_GAME` returns to LOBBY and re-enters on the next action). The `Room.test.ts` AFK tests now drive the real flow (`dispatch ROLL_DICE` → assert `IN_PROGRESS` → advance time) instead of hand-forcing the status field, and 2 engine regression tests were added to `turn-timer.test.ts` (first-action transition + restart round-trip). Docs: `FIXES.md` Completed Fix #20 + stale "NOT YET DONE" markers for MED-5/9 and LOW-2/3/4/5/6 now marked done (implemented in Phases 31/33). Reference suite green (314 tests), typecheck + lint clean.

---

## 🟢 Performance & Load Optimization (Phase 34)

A codebase-wide performance review was completed and all identified optimizations across **game load** (server + engine) and **UI** (web client) have been implemented across five batches: UI code-splitting + board memoization (Batch 1), server serialization dedup + immersive save coalescing (Batch 2), Redis rehydration (SCAN/batched/parallel/deferred, Batch 3), engine incremental recomputation (Batch 4), and UI derived-data memoization + batched token DOM + dead-hook resolution (Batch 5).

### 🟡 Batch 1 (COMPLETE): UI Code-Splitting & Bundle Optimization
- 🟢 **`React.lazy` + `Suspense` (`App.tsx`):** The three game rooms (Monopoly `GameRoom`, `CatanRoom`, `ScotlandYardRoom`) and the `Lobby` are now lazily loaded. A single `<Suspense>` wraps routing with a lightweight `LoadingFallback`. Users only download the game they choose — verified in the production build, where the rooms now emit as separate chunks (`GameRoom` 35 kB, `CatanRoom` 39 kB, `ScotlandYardRoom` 30 kB) instead of one monolithic bundle.
- 🟢 **Vite `manualChunks` (`vite.config.ts`):** Added a chunk-splitting function. `react`/`react-dom` go to `vendor-react` (224 kB, cached across all games); `react-zoom-pan-pinch` (Scotland Yard only) is isolated; the engine packages are per-room. All game code is code-split from the vendor baseline so Monopoly/Catan users never load the Scotland Yard zoom lib.
- 🟢 **`Dice3D` CSS extraction (`Dice3D.tsx` + `index.css`):** The static inline `<style>` tag (perspective, dice faces, `@keyframes rolling`) was moved into a single static block in `index.css`, eliminating per-mount style-tag injection and duplicated CSS recalculation. `Dice3D` is now wrapped in `React.memo`.
- 🟢 **Board component memoization:**
  - `MonopolyBoard` — wrapped in `React.memo`; the 40-space grid was extracted into a memoized `BoardSpaces` sub-component keyed only on `ownership` + `players` (no full re-render of every cell when only players move).
  - `CatanBoard` — wrapped in `React.memo`; the `HexPolygon`, `VertexNode`, and `EdgeNode` sub-components are each memoized.
  - `ScotlandYardBoard` — wrapped in `React.memo`; the fully-static SVG graph (199 nodes + all edges) was extracted into a memoized `StaticGraph` component that never re-renders; player tokens are isolated in a memoized `PlayerTokens` component that only updates when positions/roles change.
- 🟢 **Verification:** Full web-client suite green (42 tests), root typecheck clean, root lint + web-client lint clean (only pre-existing `exhaustive-deps` warnings remain), and the production `vite build` succeeds with the new code-split chunk layout.
- 🟢 **Automated browser UI verification (Chrome via CDP):** Added `puppeteer-core` (`package.json` dev-time dep) to drive a real Chrome instance against the running stack (Vite `:5173` + Fastify `:3000` + Docker `redis:alpine` on `:6379`). Ran two end-to-end browser tests, both green:
  - **Smoke test:** Lobby loads → create a 2-player Monopoly room → navigates into a live game room with a valid room UUID and a successful WebSocket connect to `ws://localhost:3000/rooms/{id}/ws?playerId=p1&token=...`. No CORS errors, no console/network failures.
  - **Full 2-player local game to completion:** Autonomously drove every turn of a Hot-Seat Monopoly game (Roll Dice → conditionally Buy / Pay Debt / Pay Jail Fine / Use Jail Card / Bankrupt → End Turn) for 52 turn-advances (~137 UI cycles) until **Game Over**. p2 won by bankrupting p1 (p1 landed on p2's Kentucky Ave, hit $0, and used the Bankrupt action). Verified correct turn order, doubles granting extra rolls, Chance/Community-Chest modals, conditional button enable/disable, and the debt→bankruptcy win path. **Zero console/page errors across the entire run.**

### Server: serialization & broadcast hot-path
- 🟢 **Deduplicate `JSON.stringify` per action (Batch 2, `Room.ts`):** `broadcastState()`/`broadcastRemoteState()` no longer serialize once per connected connection for non-projection games (Monopoly, 2–8 players). For games without `getStateForPlayer`, the full state is identical for every player, so the whole `STATE_UPDATE` payload is serialized **once per dispatch and the same string is reused for all connections** (was N serializations). Hidden-info games (Catan / Scotland Yard) still re-project per player, but the pubsub publish also reuses the raw state object rather than re-serializing. Verified: existing broadcast/order tests unchanged.
- 🟢 **Debounce / dirty-flag `saveState()` (Batch 2, `Room.ts`):** `saveState()` now writes the snapshot immediately on the first call in a scheduling tick (preserving write-ordering so a later rehydration read observes it) and coalesces any further calls within the same microtask turn into a single trailing flush — collapsing bursts (room creation constructor write + token issuance, multiple connection events) into one final Redis write instead of many back-to-back serialized writes. On the rehydrate path the constructor's redundant "write-back-what-we-just-read" is skipped entirely (`isRehydrated`).

### Server: boot rehydration
- 🟢 **Replace Redis `KEYS` with `SCAN` (Batch 3, `RedisStore.ts`):** `getKeys` now uses `SCAN` with a `COUNT` batch, incrementally iterating `room:*` instead of the O(N)-over-keyspace, blocking `KEYS`. Memory and server blocking both stay bounded even with tens of thousands of rooms. (In-memory dev store path unchanged.)
- 🟢 **Parallelize rehydration (Batch 3, `RoomManager.ts`):** `initFromRedis` now reads raw snapshots in bounded `Promise.allSettled` batches (50 rooms per batch) and builds all rooms concurrently, instead of one sequential `await` round-trip per room (10k rooms = 10k sequential GETs before). Malformed entries are skipped and logged without aborting the batch.
- 🟢 **Remove redundant rehydration write (Batch 3, `Room.ts`):** The rehydrate path no longer writes the exact snapshot it just read back to the store — the constructor skips `saveState()` when given a persisted `initialState` (`isRehydrated`).
- 🟢 **Defer rehydration off the critical startup path (Batch 3, `server.ts`):** `start()` now listens first, then kicks off `roomManager.initFromRedis` in the background (guarded with a `.catch`), so time-to-serve is immediate and persisted rooms become joinable as they restore.

### Engine: reduce recomputation (Batch 4)
- 🟢 **Gate `checkWinConditionAndAwards` to VP-affecting actions (`CatanEngine.ts`):** The global longest-road DFS + VP recount + largest-army recount (previously 21 call sites) now only runs on the 10 actions that can change victory points / roads / armies: `PLACE_INITIAL_SETTLEMENT`, `PLACE_INITIAL_ROAD`, `BUILD_SETTLEMENT`, `BUILD_ROAD`, `UPGRADE_CITY`, `BUY_DEV_CARD`, `PLAY_KNIGHT`, `PLAY_ROAD_BUILDING`, `END_TURN`, `FORCE_END_TURN`. Pure-resource / trade / discard / robber actions (`ROLL_DICE`, `DISCARD_RESOURCES`, `MOVE_ROBBER`, `TRADE_BANK`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `PLAY_YEAR_OF_PLENTY`, `PLAY_MONOPOLY`, `CANCEL_TRADE`) skip the recompute entirely — they cannot change VP/road/army. Game-over is detected on the action that actually reaches 10 VP.
- 🟢 **Lazy board cloning (`CatanEngine.ts`):** `reduce` no longer clones the whole board (19 hexes + 54 vertices + 72 edges) on every action. The board starts as the shared read-only original and `ensureBoard()` materializes a shallow clone only on the 8 board-mutating actions (initial settlement/road, build settlement/road, upgrade city, move robber, play knight, road-building), then swaps the reference held by `nextState.board` (clone-on-mutate / structural sharing).
- 🟢 **Monopoly guard-before-clone (`MonopolyEngine.ts`):** `reduce` previously cloned the entire state (players, ownership, buildings, decks, active trade) before running the turn/debt guards — so every rejected action still paid the clone cost. Guards (player-not-found / not-your-turn / must-resolve-debt) now run against the read-only `currentState` first, and the state is cloned only after they pass; `currentPlayer` is re-resolved from the cloned players so mutations still hit the mutable copy.

### UI: bundle & code splitting
- ✅ **DONE (Batch 1)** — `React.lazy` + `Suspense` in `App.tsx` (lines 1-5): all three game rooms (Monopoly, Catan, Scotland Yard) now lazy-load as separate chunks; users only download the game they choose (~60-70% initial-bundle cut).
- ✅ **DONE (Batch 1)** — Vite `manualChunks` (`vite.config.ts`): engine packages split into vendor chunks and `react-zoom-pan-pinch` (only used by Scotland Yard) isolated out of the Monopoly/Catan bundle.

### UI: rendering & memoization
- ✅ **DONE (Batch 1)** — Memoized the board components: `ScotlandYardBoard.tsx` (199-node graph + hundreds of SVG edges extracted into a never-re-rendering `StaticGraph`; tokens isolated in memoized `PlayerTokens`), `CatanBoard.tsx` (memoized `HexPolygon`/`VertexNode`/`EdgeNode`), `MonopolyBoard.tsx` (40-space grid extracted into `BoardSpaces` keyed only on ownership + players).
- ✅ **DONE (Batch 5)** — Memoized derived data, removing per-render linear scans:
  - `GameRoom.tsx` — the active player's owned-property list (was `ownership` filter + `BOARD_SPACES.find` per property each render) is now a `useMemo` keyed on `ownership` + `activePlayerId`; the event log `[...eventLog].reverse()` is computed once per log change via `useMemo`.
  - `CatanRoom.tsx` — robber victims (was a per-render vertex scan while the modal was open) is a `useMemo` keyed on `robberHexId`/`state`/`activePlayerId`; reversed event log memoized.
  - `MonopolyBoard.tsx` — the 40-space render loop's per-space `players.findIndex` replaced with a precomputed `playerId → color index` `Map` (`useMemo`).
  - `TradeManager.tsx` — the per-property `BOARD_SPACES.filter(colorGroup)` + building-check replaced with a precomputed "color groups with buildings" `Map`, so `isTradable` is an O(1) lookup.
  - `CatanTradeManager.tsx` — the bank exchange rate is computed once per board/player via `useMemo` (single vertex walk) instead of one full vertex walk per resource per render (`getBankExchangeRate` is now an O(1) map lookup).
- ✅ **DONE (Batch 5)** — Batched token DOM work: `MonopolyBoard` now does a single shared measurement pass (one `ResizeObserver` on the board container + one `getBoundingClientRect` sweep of all 40 spaces) and passes a `spaceCoords` map down; `PlayerToken` no longer queries the DOM, calls `getBoundingClientRect`, or registers its own (up to 4) resize listeners — it just reads its space's coordinates and applies its index offset.

### UI: misc cleanup
- ✅ **DONE (Batch 1)** — Hoisted `Dice3D` `<style>` to `index.css` (`Dice3D.tsx`:61): the static keyframe `<style>` tag is no longer injected on every mount; `Dice3D` is wrapped in `React.memo`.
- ✅ **DONE (Batch 5)** — Dead hooks resolved: `useToasts.ts` is now adopted by both `GameRoom` and `CatanRoom` (its `{ toasts, addToast }` interface matches their inline toast handling exactly, de-duplicating the identical logic), and the non-matching `useGameSocket.ts` / `useEventLog.ts` hooks (whose interfaces don't line up with the rooms' bespoke socket/event-log logic) were **deleted** along with their now-orphaned tests.

### Recommended implementation order (lowest risk → highest reward)
1. ✅ **DONE (Batch 1)** — `React.lazy` + `Suspense` + Vite `manualChunks` + board memoization + `Dice3D` CSS extraction.
2. ✅ **DONE (Batch 2)** — Deduplicate serialization: one payload serialization per dispatch reused across per-player broadcast + pubsub, with a dirty/coalescing flag on `saveState` (and skipped redundant constructor write on rehydrate).
3. ✅ **DONE (Batch 3)** — Rehydration: `SCAN` + parallelize in batches + skip redundant constructor write + defer off critical startup path.
4. ✅ **DONE (Batch 1)** — Memoize the three boards + derived data and cut per-render scans.
5. ✅ **DONE (Batch 4)** — Engine recomputation: gate Catan `checkWinConditionAndAwards` to VP-affecting actions, lazy Catan board clone-on-mutate, and Monopoly guard-before-clone.
6. ✅ **DONE (Batch 5)** — UI derived-data memoization (`GameRoom`/`CatanRoom`/`MonopolyBoard`/`TradeManager`/`CatanTradeManager`), single shared token measurement pass in `MonopolyBoard`, and dead-hook resolution (adopt `useToasts`, delete `useGameSocket` + `useEventLog`).

---

## 🟢 Automated Computer AI Players (Phase 35)

Server-side AI "bots" that fill seats and play automatically, so players can start rooms with fewer humans, practice solo, or demo games that run themselves. Bots are a **server-layer** concern: the game engines are untouched (pure state machines remain human-only APIs). Driven by a new `@packages/ai` workspace (pluggable per-game strategies implementing `IBotStrategy<TState,TAction,TEvent>`) and a `BotController` that sweeps all live rooms once per second.

### 🟢 Step 1 (COMPLETE): `botSeats` infrastructure + `BotController` + room API
- 🟢 **`Room` AI-seat flag (`packages/server/src/Room.ts`):** New `botSeats: ReadonlySet<string>` option + `isBot(playerId)` helper + `getEngine()` accessor, mirroring the existing `isHotSeat`/`ownerPlayerId` pattern exactly.
  - `getAvailablePlayerId()` now **skips bot seats** — a bot's seat is permanently occupied and is never handed to a joining human.
  - **Persistence:** `botSeats` is written into the Redis snapshot (`writeSnapshot`) and restored on boot (`loadState` + the `RoomManager.initFromRedis` constructor path), exactly like the hot-seat flags. Rehydrated rooms keep their AI seats across restarts.
- 🟢 **`RoomManager.allRooms()` iterator:** exposes every live room to the controller sweep.
- 🟢 **`BotController` (`packages/server/src/BotController.ts`):**
  - 1-second `setInterval` sweep (same cadence as the Phase 33 turn timer, `unref()`'d so it never holds the process open).
  - On each tick, per room: skip non-`IN_PROGRESS` states and rooms with no bots; resolve the active seat using the room's own turn convention (`activePlayerId` OR `currentPlayerIndex`, mirroring `checkTurnTimeout`); if the active seat is a bot, ask that game's strategy for a move.
  - **Safety:** the returned action is re-validated with `engine.isValidAction` before `room.dispatch`, and `strategy.decide` is wrapped in try/catch — a buggy strategy can never corrupt a game or crash the sweep; worst case the move is skipped and retried next tick.
  - Bot actions go through the **identical** `Room.dispatch` pipeline as human WebSocket messages (validate → reduce → snapshot → broadcast), so ordering and persistence guarantees are unchanged. Registered strategies are injectable (`registerStrategy`), exposing `tick()`/`start()`/`stop()` for tests.
- 🟢 **`POST /rooms` accepts `bots: string[]` (`packages/server/src/server.ts`):** the room API now accepts which seat ids are AI-controlled; non-existent ids are ignored; `botController` (module singleton) starts on server boot.
- 🟢 **Testing (TDD):** New `BotController.test.ts` (no-op for human turns / not-in-progress rooms; strategy dispatched through the real pipeline with authoritative state + real engine; invalid-strategy safety-skip; throwing-strategy tolerance; start/stop interval lifecycle) plus Room bot-seat tests, RoomManager `allRooms` + rehydration tests, and HTTP tests asserting bot seats are never joinable and bogus ids are ignored.
- 🟢 **Verification:** Full suite green (**30 files / 328 tests**), root typecheck clean, root lint clean (scope extended to `packages/ai`), `@packages/server` production build passes.

---

## 🔮 Future Additions (Post-MVP)

