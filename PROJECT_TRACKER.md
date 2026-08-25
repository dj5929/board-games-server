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

---

## 🟡 Active & Remaining Roadmap



### 🔴 Phase 17: Catan Advanced Logic (Robber & Development Cards)
- 🔴 **Robber Mechanics:** Implement action to move robber on a roll of 7, steal from adjacent players, and forced resource discarding for >7 cards.
- 🔴 **Development Cards:** Implement `BUY_DEV_CARD` and playing specific cards (Knight, Year of Plenty, Monopoly, Road Building).

### 🔴 Phase 18: Catan Awards, Win Condition & Polish
- 🔴 **Achievements:** Automated tracking and awarding of Longest Route (requires DFS pathfinding, min 5 roads) and Largest Army (min 3 knights).
- 🔴 **Win Condition:** Automatically declare winner upon reaching 10 Victory Points (including hidden VP cards, which can be played on the turn purchased to win).
- 🔴 **Audio & Visual Polish:** Catan-specific animations, dice rolls, and sound effects.

### 🔴 Phase 19: Infrastructure & Deployment
- 🔴 **Dockerization:** Containerize Fastify server and Vite client with Dockerfile and `docker-compose.yml`.
- 🔴 **Redis Pub/Sub Adapter:** (Optional) Scalable WebSocket room adapter across multiple server instances.
- 🔴 **CI/CD Pipeline:** GitHub Actions workflow for automated testing (`npm test`) and lint checks.

---

## 🔮 Future Additions (Post-MVP)
- 🔴 **Online Multiplayer Mode:** Re-enable online mode allowing players to join via Room IDs across multiple machines (UI temporarily disabled in Phase 12).
- 🔴 **Turn Timer / AFK Management:** Add a visual countdown timer to enforce active play and auto-kick/bankrupt AFK players.
- 🔴 **Auctions:** Automatically trigger an auction bidding phase when a player lands on an unowned property and declines to buy it.
