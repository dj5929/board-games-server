# Board Game Server — Final Consolidated Audit Report

This document is the consolidated result of reviewing `AUDIT_REPORT.md`, `DEEP_AUDIT_REPORT.md`, and `SECURITY_AUDIT_REPORT.md`, cross-referenced against `FIXES.md` and verified against the current state of the codebase.

Issues that were previously marked as fixed in `FIXES.md` have been removed. One issue regarding Scotland Yard secret tickets was determined to be a false positive (as it aligns with the official game rules) and has been excluded. Items marked ✅ Fixed below were resolved in the Security & Integrity Hardening pass (see Completed Fix #18 in `FIXES.md`); the remaining ⚠️ items represent verified, open issues.

---

## 1. Critical Flaws (High Risk)

### CRITICAL-1: Player Impersonation — Server Trusts Client `playerId`
- **Component:** Server (`packages/server/src/server.ts:113-118`)
- **Status:** ✅ **Fixed**. The WebSocket message handler now forces `action.playerId` to the authenticated socket identity (from the verified session token), ignoring any client-supplied value before dispatching.
- **Original:** The handler parsed an action payload and invoked `room.dispatch(action)` without cross-referencing the payload `playerId` against the socket's session.
- **Exploit:** Closed.

### CRITICAL-2: Hidden Information Broadcast Unfiltered (Catan & Monopoly)
- **Component:** Server & Engines (`Room.ts`, `CatanEngine.ts`, `MonopolyEngine.ts`)
- **Status:** ✅ **Fixed**. `CatanEngine` and `MonopolyEngine` now implement `getStateForPlayer`, which `Room.broadcastState()` applies per-connection. Catan hides opponents' dev-card details and scrubs the ordered dev deck; Monopoly scrubs the ordered chance/chest decks.
- **Exploit:** Closed for state broadcasts.

### CRITICAL-3: Information Leak via Public Event Broadcasting
- **Component:** Server (`Room.ts:64-69`)
- **Status:** ⚠️ **Partially addressed.** Per-player event filtering was not added; however the hidden-information events are scrubbed where they matter: Scotland Yard's `PLAYER_MOVED` event already omits Mr. X's exact position except on reveal turns (set as `undefined`), and Catan's `STOLEN_RESOURCE` / `RESOURCES_RECEIVED` are public knowledge per the official rules. `Room.broadcastEvents` still sends all events unfiltered to every connection.
- **Exploit:** Remaining risk is limited to any future hidden event added by an engine; no current event leaks hidden state.

### CRITICAL-4: Catan `PLAY_ROAD_BUILDING` Missing Connectivity Validation
- **Component:** Catan Engine (`CatanEngine.ts:846`)
- **Status:** ✅ **Fixed**. `PLAY_ROAD_BUILDING` now enforces connectivity: the first road must connect to the player's existing network, and the second road must connect to the network OR the first road. Uses the shared `isEdgeConnectedToNetwork` helper also used by `BUILD_ROAD`.
- **Exploit:** Closed.

### CRITICAL-5: Game-Agnostic Zod Schema / Optional Sub-Typed Fields
- **Component:** Server (`schemas.ts:21-30`)
- **Status:** ✅ **Fixed**. The single union was split into `monopolyActionSchema`, `catanActionSchema`, and `scotlandYardActionSchema` (exposed as `actionSchemaByGame`). The server validates against the schema matching the room's `gameType`. Trade sub-fields are no longer optional.
- **Exploit:** Closed.

### CRITICAL-6: No Persistence / Crash-Recovery
- **Component:** Server Architecture (`RoomManager.ts`)
- **Status:** **Verified Open** (Architectural limit). State is entirely in-memory. If the server crashes or restarts, every room and game is lost.

---

## 2. Medium Risk Issues

### MED-1: Socket Memory Leak on Idle Rooms
- **Component:** Server (`RoomManager.ts:43-51`)
- **Status:** ✅ **Fixed**. `RoomManager` cleanup now calls `room.closeAllConnections()` before deleting an idle room, closing its active WebSocket connections.

### MED-2: No Rate Limiting on WebSocket Messages
- **Component:** Server (`server.ts`)
- **Status:** **Verified Open**. A malicious client could flood the server with thousands of actions per second, causing CPU exhaustion.

### MED-3: No Room Capacity Limit
- **Component:** Server (`RoomManager.ts`)
- **Status:** **Verified Open**. `RoomManager` has no upper bound on the number of concurrent rooms, leaving it vulnerable to DoS attacks via room creation.

### MED-4: Silent Action Rejection (No Client Feedback)
- **Component:** Server (`Room.ts:41-43`)
- **Status:** ✅ **Fixed**. `Room.dispatch` now sends an `ACTION_REJECTED` message back to the offending client with the reducer error.

### MED-5: Unbounded Session-Token Claims (DOS)
- **Component:** Server (`server.ts`)
- **Status:** **Verified Open**. Reserved session tokens (issued during `POST /rooms/:roomId/join`) have no expiry time. An attacker can claim all seats in a room and never connect, permanently blocking legitimate players.

### MED-6: Reconnection Does Not Close Stale Sockets
- **Component:** Server (`Room.ts:29`)
- **Status:** ✅ **Fixed**. `Room.addConnection` now closes the existing socket for a `playerId` before replacing it, preventing orphaned connections.

### MED-7: Scotland Yard `isValidAction` Doesn't Validate Player Identity
- **Component:** Scotland Yard Engine (`ScotlandYardEngine.ts`)
- **Status:** ✅ **Fixed**. `isValidAction` now asserts `action.playerId === currentState.activePlayerId` for `MOVE`/`DOUBLE_MOVE`.

### MED-8: Monopoly `ROLL_DICE` Lacks Defense-in-Depth `hasRolled` Check
- **Component:** Monopoly Engine (`MonopolyEngine.ts`)
- **Status:** ✅ **Fixed**. The `ROLL_DICE` reducer now explicitly rejects with `ALREADY_ROLLED` when `currentPlayer.hasRolled` is already true.

### MED-9: No Disconnection Grace Period or Forfeit Timer
- **Component:** Server Architecture
- **Status:** **Verified Open**. Dropped players lose their socket but retain their seat indefinitely. The game stalls entirely for the remaining players.

### MED-10: Oversized Broadcast / Full-State Pushes
- **Component:** Server (`Room.ts:53-62`)
- **Status:** **Verified Open**. The entire game state is re-serialized and broadcast to all players on every action, which does not scale well for large boards or high-frequency actions.

---

## 3. Low Risk / Cosmetic Issues

### LOW-1: Catan Action Payloads Lack Strict Sanitization
- **Component:** Server (`schemas.ts:39, 46`)
- **Status:** ✅ **Fixed**.
  - `DISCARD_RESOURCES` values are now `.int().nonnegative()` (no negative values).
  - `TRADE_BANK` amount is now `.int().positive()` (no floats/zero). Monopoly trade money is `.int().nonnegative()`.

### LOW-2: Coarse RNG Precision
- **Component:** Server (`server.ts:15`)
- **Status:** **Verified Open**. `crypto.randomInt(0, 1000000) / 1000000` provides only 6 digits of decimal precision, unnecessarily restricting permutation space when shuffling large decks.

### LOW-3: Catan `calculateLongestRoad` DFS Exponential Memo Key
- **Component:** Catan Engine (`CatanEngine.ts:22-23`)
- **Status:** **Verified Open**. The memo key grows exponentially based on visited edges. While fine for standard boards, it is a theoretical performance bottleneck.

### LOW-4: Monopoly `BOARD_SPACES` Linear Search
- **Component:** Monopoly Engine (`MonopolyEngine.ts`)
- **Status:** **Verified Open**. Repeated use of `.find()` on the spaces array is O(n) per call instead of O(1) via map lookups.

### LOW-5: `Math.random` Used for Toast IDs (Collision Risk)
- **Component:** Web Client (`useEventLog.ts`, etc.)
- **Status:** **Verified Open**. Client logic uses `Date.now() + Math.random()` for log IDs, which can collide when multiple toasts are generated in the same tick.

### LOW-6: RNG ID Generation Consumes Entropy
- **Component:** Catan & Monopoly Engines
- **Status:** **Verified Open**. Trading/Dev card unique IDs consume from the injected gameplay RNG instead of using a standard UUID generator, complicating deterministic replays.

### LOW-7: `RoomManager` Singleton Prevents Multi-Instance Testing
- **Component:** Server (`RoomManager.ts:67`)
- **Status:** **Verified Open**. The singleton pattern prevents horizontal scaling and risks state leakage between test suites.

### LOW-8: CORS Hardcoded to Localhost
- **Component:** Server (`server.ts:22`)
- **Status:** **Verified Open**. `origin: ['http://localhost:5173']` remains hardcoded, creating a blocker for production deployment.

### LOW-9: Monopoly Remains in 'LOBBY' Status
- **Component:** Monopoly Engine
- **Status:** **Verified Open**. The initial state has `status: 'LOBBY'` but there is no mechanism to transition it to `'IN_PROGRESS'`.

### LOW-10: Catan Dev-Card Shared-Reference Mutation (Immutability Violation)
- **Component:** Catan Engine (`CatanEngine.ts:889-890`)
- **Status:** ✅ **Fixed**. `reduce` now deep-copies development cards while cloning players (`developmentCards: p.developmentCards.map(c => ({ ...c }))`), so `END_TURN`'s `boughtThisTurn = false` no longer mutates the previous state's card objects.

---

## 4. Actionable Testing Strategy

The current suite (26 files, ~260 tests) is strongest in per-engine reducer unit tests with an injected deterministic RNG (`DeterministicRNG`). **Gaps:** no property/fuzz-based tests, no end-to-end multi-player concurrency tests, and no server-layer validation tests against malicious payloads (identity binding, hidden-information scrubbing, malformed input).

### High-Value Integration Tests

> ✅ **Status update:** T1, T2, and T3 are now covered by the Security & Integrity Hardening pass (a `playerId`-forgery test, Catan/Monopoly projection tests, and Road-Building connectivity tests), and MED-4/6/1/7/8/LOW-1/LOW-10 have dedicated tests. Still NOT covered: the property/fuzz, deterministic-replay, concurrency-stress, and Zod-fuzz strategies below.

**T1 — WebSocket player-identity enforcement (covers CRITICAL-1).** Connect two fake WS clients to one room via `buildApp()`, then assert an action whose `playerId` differs from the socket's authenticated id is rejected with an `ERROR` and produces **no** state change. This is the test that would have first caught CRITICAL-1.

**T2 — Hidden-information projection (covers CRITICAL-2/3).** Feed crafted states into `broadcastState()`; assert each connection's serialized `STATE_UPDATE` contains only its own private data (dev-card hand / money). For Scotland Yard, assert detectives never receive Mr. X's `position` except on reveal turns or game-over.

**T3 — `PLAY_ROAD_BUILDING` connectivity (covers CRITICAL-4).** Attempt the action with disconnected edges; assert it is rejected with an actionable error rather than placing floating roads.

### Property / Fuzz Strategy

- **Action-stream fuzzing (`fast-check`).** Generate random legal/illegal action sequences per engine and assert invariants: (a) `reduce` never *throws* on any action (regression for the under-specified `PROPOSE_TRADE` crash), (b) `reduce` always resolves to a `Result` (success or clean error), (c) `isValidAction === true` ⟺ `reduce` succeeds (consistency between the two layers), (d) `reduce` never mutates its input state (catches LOW-10).
- **Deterministic replay.** Record `{action, rng}` pairs for a full game; replay from `getInitialState` with the same injected RNG; assert the final state is deep-equal — locks in the immutability guarantees and the injected-RNG design.
- **Concurrency/sequence stress.** Fire 100 invalid/out-of-turn actions interleaved with one valid action across multiple mocked clients via `Promise.all`; assert the room never throws, double-processes a single resource, or desynchronizes (guards future async gaps in the single-threaded event loop).
- **Zod fuzzing.** Feed random JSON to `actionSchema.parse()`; assert it either parses cleanly or throws a Zod error — never crashes the server handler.

### Lifecycle Strategy

Verify idle rooms are GC'd after TTL **and** that cleanup closes their open sockets (MED-1); a disconnected player's seat becomes reclaimable (MED-5/9); and duplicate connections for one id are handled without orphaned sockets (MED-6).

---

*Note: The issue regarding Scotland Yard secret-ticket validity incorrectly cited a rules deviation in the original DEEP_AUDIT_REPORT. In the official game, Mr. X is permitted to use a secret ticket for any transport (including the ferry/secret routes). This is mathematically represented by allowing the secret ticket to access `node.secret`, which operates exactly as intended.*
