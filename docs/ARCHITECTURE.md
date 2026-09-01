# 📐 Architecture Deep-Dive

> **Audience:** developers working on this repository. This document is the *nitty-gritty* companion to the high-level [README](../README.md). It describes, system-by-system, exactly how the platform is built: the pure game engines, the Fastify + WebSocket server, the React web client, the hidden-information rules, persistence/crash-recovery, and containerization.
>
> **Companion docs:** [FIXES.md](../FIXES.md) — identified bugs & implementation diffs · [COVERAGE.md](../COVERAGE.md) — test coverage matrix · [PROJECT_TRACKER.md](../PROJECT_TRACKER.md) — phase roadmap · [FINAL_AUDIT.md](../FINAL_AUDIT.md) — consolidated security audit (all findings resolved in Phase 31).

---

## 1. Big Picture

The platform is a **TypeScript npm-workspaces monorepo** with a strict architectural rule (see `.agents/rules/architecture.md`):

> **Game rules live in pure, immutable, deterministic state machines. No I/O, no timers, no randomness inside the engine — randomness is *injected* (`IRandomProvider`), and the WebSocket/UI layers are thin shells on top.**

The layers, from bottom to top:

```
┌──────────────────────────────────────────────────────────────┐
│  React web client  (packages/web-client)                      │
│  - Lobby (create/join, hot-seat vs online)                    │
│  - Room components: GameRoom / CatanRoom / ScotlandYardRoom   │
│  - Boards + HUDs, animations, sound, event log, toasts        │
├──────────────────────────────────────────────────────────────┤
│  Fastify + WebSocket server  (packages/server)                │
│  - Rooms, session tokens, CORS, rate limiting, WS auth        │
│  - Redis snapshotting & rehydration on boot                   │
│  - Zod re-validation of every inbound action                  │
├──────────────────────────────────────────────────────────────┤
│  Pure game engines  (engine-core + monopoly/catan/scotland)   │
│  - reducer(state, action, rng) → { nextState, events }        │
│  - optional getStateForPlayer() per-player projections        │
└──────────────────────────────────────────────────────────────┘
```

### The action lifecycle (verified end-to-end)

1. A player clicks a control in a board HUD inside a `*Room` component.
2. The component serializes an action and sends it over the single WebSocket it owns. In a local hot-seat room the **room owner's** single socket is reused for every seat — the server trusts that session to dispatch on behalf of any owned seat (see **§5.3**).
3. The server's WS handler parses the JSON, **forces `action.playerId` to the authenticated socket identity** (CRITICAL-1, anti-impersonation), validates it with the per-game Zod schema, then calls `Room.dispatch()`.
4. `Room.dispatch()` calls `engine.isValidAction()` (fast-fail gate) and then `engine.reduce()`.
5. The engine returns `{ success: true, data: { nextState, events } }` or `{ success: false, error }`.
6. On success the room stores the new state, snapshots it to Redis, broadcasts a `STATE_UPDATE` frame **per connection** (scrubbed by `getStateForPlayer` when the engine implements hidden info), and broadcasts an `EVENTS` frame.
7. On failure the responsible connection receives an `ACTION_REJECTED` frame.
8. The client queues the new state, plays animations/dice/sounds driven by `EVENTS`, then commits `STATE_UPDATE` to its React `useState` on a timer.

---

## 2. Repository Layout

```
packages/
├── engine-core/            # Shared engine interfaces, types, RNG contract, game configs
├── monopoly-engine/        # Monopoly rules engine (pure)
├── catan-engine/           # Catan rules engine (pure)
├── scotland-yard-engine/   # Scotland Yard rules engine (pure, hidden movement)
├── server/                 # Fastify + @fastify/websocket server, Redis persistence
└── web-client/             # React + Vite + Tailwind frontend
.github/workflows/ci.yml    # typecheck + lint + full test suite + production builds
Dockerfile / docker-compose.yml (.env.example, .dockerignore)
README.md, PROJECT_TRACKER.md, FIXES.md, COVERAGE.md, FINAL_AUDIT.md
```

---

## 3. `engine-core` — The Engine Contract

`packages/engine-core/src/` defines the smallest possible surface that all engines implement, so the server can treat every game identically.

### 3.1 Branded IDs (`types.ts`)

```ts
type Brand<K, T> = K & { __brand: T };
type PlayerId = Brand<string, 'PlayerId'>;
type PropertyId = Brand<string, 'PropertyId'>;
const playerId = (id: string): PlayerId;    // cast helper
const propertyId = (id: string): PropertyId;
```

Nominal typing keeps the engine layer from accidentally mixing player/property IDs with ordinary strings.

### 3.2 Result type

```ts
type Result<T, E> =
  | { success: true;  data: T }
  | { success: false; error: E };
```

Every state transition is a `Result<IStateTransition<S, E>, string>` — the `reduce()` never throws; rule failures are expressed as `error` strings.

### 3.3 Base contracts

- `IGameState { status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED'; readonly players: readonly IPlayer[] }`
- `IPlayerAction { type: string; playerId: PlayerId }`
- `IGameEvent { type: string }`
- `IStateTransition<S, E> { nextState: S; events: E[] }`

### 3.4 RNG inversion (Architecture Rule 4)

```ts
interface IRandomProvider { next(): number; }
```

Engines never call `Math.random()`. Randomness (die rolls, card shuffles, robber draws, Catan hex assignments) flows through the `IRandomProvider` argument of `getInitialState()` and `reduce()`. This makes every engine fully deterministic under test — tests stub the provider.

### 3.5 `IGameEngine<S, A, E>` (`IGameEngine.ts`)

| Member | Signature | Purpose |
| --- | --- | --- |
| `getInitialState` | `(playerIds: PlayerId[], rng: IRandomProvider) => S` | Build the fresh game (board, decks, ticket pools, turn order). |
| `reduce` | `(state, action, rng) => Result<IStateTransition<S,E>, string>` | The pure reducer; never mutates input; shallow-clones into a new state. |
| `isValidAction` | `(state, action) => boolean` | Cheap gate run *before* `reduce` so the server can reject early. |
| `getStateForPlayer?` | `(state, playerId) => S` | Optional per-player projection for hidden information (Mandatory for Scotland Yard; also implemented by Catan). |

### 3.6 Utilities (`utils.ts`)

- `shuffleArray<T>(array, rng): T[]` — **Fisher-Yates** (nondestructive copy) using the injected RNG. Used by Monopoly for Chance/Community Chest decks and by other engines for any card shuffling.

### 3.7 Game configs (`gameConfig.ts`)

```ts
type GameType = 'monopoly' | 'catan' | 'scotland-yard';
GAME_CONFIGS: {
  monopoly:       { minPlayers: 2, maxPlayers: 8 }
  catan:          { minPlayers: 3, maxPlayers: 4 }
  'scotland-yard':{ minPlayers: 3, maxPlayers: 6 }
}
isGameType(value: string): value is GameType   // runtime guard used by the server
```

`GAME_CONFIGS` drives both the Lobby's player-count selector *and* the server's create-room validation.

`packages/engine-core/src/index.ts` re-exports all of the above.

---

## 4. The Three Engines

All engines follow the same file pattern: `board.ts` (static board data), `types.ts` (state/action/event unions), `Engine.ts` (the `IGameEngine` implementation), `index.ts`. Static board data is derived from the shared `@packages/engine-core` types.

### 4.1 Monopoly (`packages/monopoly-engine`)

**Files:** `board.ts` (40-board-space graph, `BOARD_SPACES` + `BOARD_SPACES_MAP`), `cards.ts` (Chance & Community Chest decks), `MonopolyEngine.ts`, `types.ts`.

**State highlights:** `players[]` (money, `position`, `inJail`, `hasRolled`, `properties`, `houses`, `debt`, `getOutOfJailFreeCards[]`, `status: 'ACTIVE' | 'BANKRUPT'`), `bankMoney: number` (set to **`Infinity`** for the *unlimited* bank — a deliberate `number|'INFINITY'`-style choice that forced the JSON persistence workaround in `RedisStore`, see **§6.4**), `currentPlayerIndex`, `activeTrade` (on/off), `status` (`IN_PROGRESS` / `FINISHED`).

**Actions** (from `types.ts:38-53`):

```
ROLL_DICE, END_TURN, BUY_PROPERTY, PAY_JAIL_FINE, MORTGAGE_PROPERTY(propertyId),
UNMORTGAGE_PROPERTY(propertyId), BUY_HOUSE(propertyId), SELL_HOUSE(propertyId),
RESTART_GAME, PROPOSE_TRADE(toPlayerId, offeredProperties[], requestedProperties[],
offeredMoney, requestedMoney), ACCEPT_TRADE, REJECT_TRADE, CANCEL_TRADE,
USE_JAIL_CARD, PAY_DEBT, DECLARE_BANKRUPTCY
```

**Events:** `DICE_ROLLED` (with `dice1`, `dice2`, `position`), `TURN_ENDED` (`nextPlayerId`), `PROPERTY_BOUGHT`, `RENT_PAID`, `PASSED_GO`, `TAX_PAID`, `WENT_TO_JAIL` (`reason`), `PROPERTY_MORTGAGED`, `PROPERTY_UNMORTGAGED`, `CARD_DRAWN` (deck + text), `JAIL_CARD_USED`, `GAME_RESTARTED`, `PLAYER_BANKRUPT`, `TRADE_*`, `GAME_OVER`.

**Edge cases the engine enforces (verified):**
- `isValidAction` fast-fail gate (`MonopolyEngine.ts:783`): any action whose `playerId !== currentPlayer.id` is rejected (except `RESTART_GAME`, which is always legal so a stuck game can be reset).
- If a player is **in debt**, the only legal actions are `SELL_HOUSE`, `MORTGAGE_PROPERTY`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `PAY_DEBT`, `DECLARE_BANKRUPTCY`, `RESTART_GAME` — you *must* resolve the debt before normal play.
- `PAY_DEBT` requires `money >= debt.amount`; `DECLARE_BANKRUPTCY` is the escape hatch when you cannot.
- Turn advance skips `BANKRUPT` players (`while (...) status === 'BANKRUPT'`).
- `ROLL_DICE` requires `!hasRolled`; `END_TURN` requires `hasRolled`.
- Mortgage/unmortgage/buy-house check the owning player and even-build rules.
- `RESTART_GAME` → `GAME_RESTARTED` event; all players keep their seats but the board/decks/money reset.
- **`getStateForPlayer` is implemented but symmetric** (`MonopolyEngine.ts:900`) — it returns the state unchanged, because Monopoly has no hidden information. `Room.broadcastState()` still calls it, keeping the code path uniform.

### 4.2 Catan (`packages/catan-engine`)

**Files:** `board.ts` (hex grid + vertices + edges coordinates), `CatanEngine.ts`, `types.ts`.

**State highlights:** `hexes` (resource types incl. `DESERT`, dice numbers), `vertices`/`edges` (structure owners), `players[]` (resources as per-resource count records, `developmentCards[]` with `{id, type, boughtThisTurn}`, victory points), `devCardDeck`, `turnPhase` (`ROLL_PHASE`, `DISCARD_PHASE`, `ROBBER_PLACEMENT`, `ACTION_PHASE`), `activePlayerId`, `robberHexId`, `winningPlayerId`, longest-road / largest-army tracking. Win condition: **10 victory points**.

**Phases inside a turn:** roll → (if 7: discard + move robber) → action phase (build/trade/play dev) → `END_TURN`.

**Actions** (`types.ts:81-104`): `ROLL_DICE`, `END_TURN`, `DISCARD_RESOURCES` (on a 7), `MOVE_ROBBER(hexId, targetPlayerId?)`, `BUY_DEV_CARD`, `PLAY_KNIGHT(hexId, targetPlayerId?)`, `PLAY_YEAR_OF_PLENTY(resource1, resource2)`, `PLAY_MONOPOLY(resource)`, `PLAY_ROAD_BUILDING(edgeId1, edgeId2?)`, `PLACE_INITIAL_SETTLEMENT(vertexId)`, `PLACE_INITIAL_ROAD(edgeId)`, `BUILD_SETTLEMENT(vertexId)`, `BUILD_ROAD(edgeId)`, `UPGRADE_CITY(vertexId)`, `TRADE_BANK(offerResource, requestResource, amount)` (4:1, improved by ports), `PROPOSE_TRADE(toPlayerId, offer{}, request{})`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CANCEL_TRADE`.

**Events:** `DICE_ROLLED` (`dice1, dice2, total`), `TURN_ENDED`, `RESOURCES_DISCARDED`, `ROBBER_MOVED`, `STOLEN_RESOURCE`, `DEV_CARD_BOUGHT`, `DEV_CARD_PLAYED`, `SETTLEMENT_BUILT`, `ROAD_BUILT`, `CITY_UPGRADED`, `RESOURCES_RECEIVED`, `TRADE_*`, `GAME_OVER`.

**Hidden-info projection (`getStateForPlayer`, `CatanEngine.ts:980`):**
- The `devCardDeck` array is replaced with a same-length array of `'HIDDEN'` stubs (only the *count* is visible, never the ordered contents).
- Opponents' `developmentCards` become `{ id: 'HIDDEN', type: 'KNIGHT', boughtThisTurn: false }` stubs — the *number* is visible, but played-status and card types are not.
- Each player sees their own cards fully.

### 4.3 Scotland Yard (`packages/scotland-yard-engine`)

**Files:** `positions.ts` (London map node coordinates), `board.ts` (graph of nodes + edges with `TransportType`), `ScotlandYardEngine.ts`, `types.ts`, `utils.ts`.

**State highlights:** `players[]` with `role: 'MR_X' | 'DETECTIVE'`, `position` (map node index), `tickets` (`{ taxi, bus, underground }`, plus `secret` and `double` for Mr. X), `playerOrder` (Mr. X always index 0, then detectives), `activePlayerId`, `mrXLog` (per-move record of the ticket type used; **target node is omitted** from the log so detectives can't reconstruct the path), `mrXRevealedTurns: number[]` = **`[3, 8, 13, 18, 24]`**, `winner`/`reason`, `status`.

**Actions (only two):**
- `MOVE { playerId, payload: { targetNode, ticketType } }`
- `DOUBLE_MOVE { playerId, payload: { move1, move2 } }` — Mr. X's special 2x move token.

**Events:** `PLAYER_MOVED` (`targetNode` present only on reveal turns / game over, else `undefined`), `GAME_OVER` (`winner`, `reason`).

**Win conditions:** Mr. X wins by surviving **24 moves** (`mrXLog.length >= 24`); detectives win by landing on Mr. X's node (`detective.position === mrX.position`), or if Mr. X runs out of tickets / tries an illegal move.

**The crown jewel — hidden movement (`getStateForPlayer`, `ScotlandYardEngine.ts:259`):**
1. **Mr. X himself** (and anyone seated at `playerOrder[0]`) gets the *true* state.
2. On a **reveal turn** (`mrXRevealedTurns.includes(mrXLog.length)`) **or when the game is over**, every detective sees Mr. X's real position.
3. Otherwise Mr. X's `position` is replaced with **sentinel `0`** — node 0 does not exist on the board, so the client renders "Mr. X is on the move…" instead of a location. Similarly `PLAYER_MOVED` events pass `targetNode: undefined` on non-reveal moves.

This single projection is what makes hidden movement work *both* in online mode (each detective connects as their own seat) *and* on the shared hot-seat board.

---

## 5. The Server (`packages/server`)

### 5.1 Runtime configuration (env-driven, Phase 32)

| Env var | Default | Meaning |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Bind address (must be `0.0.0.0` inside Docker). |
| `PORT` | `3000` | HTTP + WS port. |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:8080` | **Comma-separated** allowlist for `@fastify/cors`; the client (Vite dev) and the nginx-served container both connect cross-origin. |
| `REDIS_URL` | *(unset)* | `ioredis` connection; when unset the server falls back to an in-memory snapshot store (see §6.2). |

### 5.2 `buildApp()` (`server.ts`)

- Registers `@fastify/websocket`, `@fastify/cors` (origin allowlist), and `@fastify/rate-limit` (**max 100 requests / minute** per IP globally).
- **`ENGINES` registry**: `'monopoly' → MonopolyEngine`, `'catan' → CatanEngine`, `'scotland-yard' → ScotlandYardEngine`, all boxed into `IGameEngine<IGameState, IPlayerAction, IGameEvent>`.
- `CryptoRandomProvider` — RNG backed by `crypto.randomBytes` (cryptographically strong; used inside engines for shuffling *and* for room state).
- Routes:

| Route | Method | Purpose |
| --- | --- | --- |
| `/rooms` | POST | Create a room. Body `{ gameType?, playerCount? }`. Validates `isGameType` + player-count bounds from `GAME_CONFIGS`. Generates `playerIds = ['p1','p2',…]`, `roomId = crypto.randomUUID()`, creates `new Room(...)` with `getInitialState`, auto-issues a session token for `p1`. Returns `{ roomId, playerIds, gameType, playerId, sessionToken }`. |
| `/rooms/:roomId/join` | POST | Claim the next free seat. `Room.getAvailablePlayerId()` finds the first `playerId` with no active connection *and* no issued token. Returns `{ playerId, gameType, sessionToken }`. `404` if room missing, `400` if full. |
| `/rooms/:roomId/ws` | GET (WS) | The multiplayer socket. See §5.3. |

### 5.3 The WebSocket handler (verified, `server.ts:96-177`)

The connection lifecycle is deliberately strict:

1. **Room exists?** else close `1008 'Room not found'`.
2. **Query auth:** `?playerId=` + `?token=` are required; else close `1008 'playerId and token required in query'`.
3. **Session verification:** `room.verifySessionToken(playerId, token)` — the token is a per-seat `crypto.randomUUID()` issued at create/join and persisted in Redis; anything else → close `1008 'Invalid session token'`.
4. **Register connection** via `room.addConnection(playerId, { send, close })`.
5. **Per-connection token-bucket rate limiter:** starts with 10 tokens, refills **10 tokens/second** up to a **20-token burst**; on exhaustion the client gets an `{ type: 'ERROR', error: 'Rate limit exceeded' }` frame and the message is dropped.
6. **Heartbeat:** server `ping()`s every 30 s and calls `socket.terminate()` if no `pong` is received.
7. **Inbound actions:** `JSON.parse` → per-game `actionSchema.parse()` (Zod). **CRITICAL-1:** the server *overwrites* `playerId` with the authenticated socket's identity before dispatch, so no client can impersonate another seat — **with one exception**: in a **hot-seat room** the room **owner's** session (the single shared browser) may dispatch on behalf of *any* seat:
   ```ts
   let dispatchPlayerId = playerId;
   const claimed = action.playerId;
   if (room.isHotSeat && playerId === room.ownerPlayerId && claimed && room.hasPlayer(claimed)) {
     dispatchPlayerId = claimed;          // owner drives any of its seats
   }
   room.dispatch({ ...action, playerId: dispatchPlayerId } as ...);
   ```
   Online joiners in the same hot-seat room stay strictly bound to their own identity. Malformed/unparseable/invalid-schema payloads → `{ type: 'ERROR', error: 'Invalid payload' }`.
8. **Close/error:** `room.removeConnection(playerId)` records `disconnectedAt` and snapshots; the abandoned-seat sweep in `RoomManager` handles reconnection claims.

### 5.4 `Room` (`Room.ts`) — one per game, generic over `<S, A, E>`

State kept by every room:

- `state: S` — the authoritative current game state.
- `connections: Map<playerId, IClientConnection>` — live sockets.
- `sessionTokens: Map<playerId, string>` + `tokenIssuedAt` — seat credentials.
- `disconnectedAt: Map<playerId, number>` — when each seat last dropped.
- `lastActivity: number` — drives idle eviction.

Key methods:

- **`dispatch(action)`** — the single entry point for every game action:
  1. `lastActivity = now`; fast-fail `isValidAction()` → `ACTION_REJECTED 'INVALID_ACTION'` (to the acting connection only).
  2. `engine.reduce(state, action, rng)`; on `success:false` → `ACTION_REJECTED <engine error>` (e.g. `'Not your turn'`).
  3. Adopt `nextState`, **snapshot to Redis**, then broadcast.
- **`broadcastState()`** — *per-connection* `STATE_UPDATE`: if the engine implements `getStateForPlayer`, each seat receives its own scrubbed projection; otherwise everyone gets the full state. This is the single point where hidden information is enforced on the wire.
- **`broadcastEvents(events)`** — one `EVENTS` frame (identical, public list) to every connection, always emitted *after* the corresponding `STATE_UPDATE` so the client's animation queue knows what changed.
- **`saveState()` / `loadState(data)`** — JSON round-trip of `{ id, gameType, state, sessionTokens[], tokenIssuedAt[], disconnectedAt[], lastActivity, isHotSeat, ownerPlayerId }` into Redis under `room:<id>` using `JSON.stringify(state, redisReplacer)`; the hot-seat flags are restored by `initFromRedis` so a restarted server keeps the owner-session dispatch rule (see §5.3).
- **`issueSessionToken` / `revokeSessionToken` / `verifySessionToken`** — seat-credential lifecycle; every mutation also snapshots.
- **`getAvailablePlayerId()`** — first seat with no connection *and* no token: guarantees a rejoining player can never be double-booked and an online joiner only fills genuinely-empty seats.
- **`addConnection(playerId, conn)`** — replaces & closes any stale duplicate socket for the same seat, clears `disconnectedAt`, snapshots, and immediately broadcasts the fresh state so the reconnecting player is caught up.
- **`removeConnection(playerId)`** — records `disconnectedAt`, snapshots (allows reconnect later without re-issuing a token).
- **`closeAllConnections()`** — used on room eviction.

### 5.5 `RoomManager` (`RoomManager.ts`) — room lifecycle

- `createRoom(room)` — rejects beyond **`MAX_ROOMS = 10_000`** with a `503`-style error.
- `getRoom(id)` / `removeRoom(id)` (also deletes the Redis key) / `start()` / `stop()`.
- **Idle cleanup cycle (every 5 minutes):** rooms with `now - lastActivity > ROOM_TTL_MS` (**30 minutes**) are evicted from memory *and* Redis.
- **Abandoned-player sweep (same cycle):** any seat with `disconnectedAt` older than the TTL is detached (its token rotated/removed from Redis snapshot) so the seat eventually frees up; a player who reconnects *before* then reclaims their seat via the persisted token.
- **`initFromRedis(ENGINES)` — boot-time rehydration (see §6.3):** lists `room:*` keys, parses each snapshot with `redisReviver`, and rebuilds `Room` objects with `new Room(id, gameType, engine, RNG, [], initialState=data.state)` — the **`initialState` constructor injection** (a Phase 32 fix; previously passing `[]` players made the `Room` constructor throw on `getInitialState([])`).

### 5.6 `schemas.ts` — Zod defense-in-depth

- `actionSchemaByGame[gameType]` is a discriminated union on `type`, with `playerId: z.string()` as the base field (`baseAction`).
- The **same schemas** are conceptually mirrored client-side (README claims "identical Zod schemas on client and server"); the server re-validates every frame regardless of client checks, so the client validation is a belt-and-suspenders UX layer and the server is the enforcement point.

### 5.7 Wire protocol (frame types, verified)

| Frame | Meaning | Payload |
| --- | --- | --- |
| `STATE_UPDATE` | Server → client, per seat | `{ type, state }` (projected) |
| `EVENTS` | Server → client, broadcast | `{ type, events: [...] }` |
| `ACTION_REJECTED` | server → the one acting client | `{ type, error }` |
| `ERROR` | server → client (ratelimit/payload) | `{ type, error }` |
| *(inbound)* | client → server | the raw action JSON (validated + playerId-forced) |

---

## 6. Persistence & Crash Recovery

### 6.1 Why Redis

Rooms are in-memory objects; without snapshots a server restart would destroy every game. Every authoritative mutation (`dispatch` success, connect/disconnect, token issue, activity stamp) triggers `Room.saveState()`, so Redis always holds the *latest* serialized truth under key `room:<roomId>`.

### 6.2 `RedisStore` (`RedisStore.ts`) — dual-backend store

```ts
const REDIS_URL = process.env.REDIS_URL;
new Redis(REDIS_URL)            // used when set…
const inMemoryStore = new Map() // …otherwise a Map fallback (dev / no Docker)
```

Uniform API: `set/get/del/getKeys(pattern)` (+ `isRedisConnected()`). `getKeys('room:*')` resolves to an in-memory regex match when Redis is absent.

### 6.3 Rehydration path (Phase 32 regression, fixed)

On boot `start()` runs `roomManager.initFromRedis(ENGINES)` **before** listening, so:

```
Room (memory) ──saveState()──▶ room:<id> (Redis JSON) ──initFromRedis()──▶ Room loaded with initialState
```

With real Redis the JSON snapshot uses `redisReplacer`; restore uses `JSON.parse(data, redisReviver)` + the `Room(id, gameType, engine, rng, [], initialState)` constructor path. Success logs `Rehydrated room <id> from Redis`; a corrupt key logs `[RoomManager] Failed to parse room …`. Only after restore does `server.listen()` bind — rehydrated rooms are live before the first client can connect, so reconnects land on the restored game.

### 6.4 `Infinity`/`NaN` persistence (`RedisStore.ts`)

`JSON.stringify` silently serializes `Infinity`/`NaN` to `null`, destroying Monopoly's `bankMoney: Infinity`. `redisReplacer` encodes them as tagged strings and `redisReviver` decodes them back:

- `Infinity` → `"__JSON_INFINITY__"` · `-Infinity` → `"-__JSON_INFINITY__"` · `NaN` → `"__JSON_NAN__"`

Regression tests in `packages/server/test/RoomManager.test.ts` lock both rehydration itself and the Infinity round-trip (see `FIXES.md`).

### 6.5 Eviction vs. reconnect semantics

A room is deletable only when it has been idle (no actions/connections) for 30 minutes. Disconnected-but-still-valid seats are kept (token persisted) so a network drop doesn't lose a seat; only after the TTL expires does the abandoned-seat sweep free the slot. This balances "players can come back" against "dead rooms don't leak memory."

---

## 7. The Web Client (`packages/web-client`)

### 7.1 Entry & routing (`App.tsx`)

`App` does NOT use `react-router` — it is a plain conditional render on a `useState<GameConfig | null>`:

```tsx
<GameConfig: { roomId, localPlayerIds, gameType, sessionToken }>
{!gameConfig ? <Lobby onJoinRoom={...}/> : gameType === 'monopoly' ? <GameRoom/> : gameType === 'catan' ? <CatanRoom/> : <ScotlandYardRoom/>}
```

`AudioToggle` (mute on/off) is mounted app-wide.

### 7.2 `Lobby` (`Lobby.tsx`)

- Reads `GAME_CONFIGS[gameType]` directly from `@packages/engine-core` to drive:
  - the **game selector**, and
  - the **player-count slider** rendered as `maxPlayers - minPlayers + 1` steps starting at `minPlayers` (e.g. Catan 3–4, Scotland Yard 3–6, Monopoly 2–8).
- Two modes:
  - **`local` (hot-seat):** `POST /rooms` once with the chosen count; `localPlayerIds = data.playerIds` (**all** seats live in this browser).
  - **`online`:** same create but `localPlayerIds = [data.playerIds[0]]` — this browser only owns seat `p1`; friends join by room ID from other machines. (There is also an explicit **join** flow: `POST /rooms/:roomId/join`, which fails fast with "Room not found" (404) / "Room is full" (400).)
- The chosen mode copy explains the difference ("All players share this screen and take turns." vs "Connect from another machine to play together. You control the first seat.").

### 7.3 Networking helpers

- `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'` and `WS_URL = API_URL.replace(/^http/, 'ws')` — one env knob configures both fetch and sockets (Vite dev serves the client on 5173 with no proxy; the server is CORS-open only to the allowlisted origins).
- `hooks/useGameSocket.ts` is a **generic, re-usable socket hook** (`useGameSocket<TState, TEvent, TAction>`) that parses `STATE_UPDATE` / `EVENTS` / `ERROR` and exposes `sendAction`. **Important nuance:** it is *not* the one the room components use for gameplay — it does **not** attach `&token=` (and is tested as such in `hooks/__tests__/useGameSocket.test.ts`). The `*Room` components instead hand-roll their own authenticated socket (below) so that seat identity + session token are always in the URL.

### 7.4 Room components as smart containers (per-game at a glance)

Each `*Room` component:
1. Stores the single `WebSocket` in `wsRef` and opens it *once* (`useEffect [roomId, localPlayerIds]`):
   ```ts
   new WebSocket(`${WS_URL}/rooms/${roomId}/ws?playerId=${localPlayerIds[0]}&token=${sessionToken}`)
   ```
2. Owns the authoritative local UI state: `useState<S|null>` game state, error string, toasts, event log, modal flags, animation flags.
3. Implements **its own** `sendAction`-style dispatchers that serialize the action and `wsRef.current?.send(...)`.

### 7.5 The event → UI → animation pipeline (the trickiest client logic)

`GameRoom.tsx` (verified at lines 58–164) shows the canonical pattern:

- **State is not committed immediately.** On `STATE_UPDATE` the payload goes to `pendingStateRef.current` and a timer commits it to React `useState` after **50 ms** by default — long enough for the corresponding `EVENTS` frame to arrive and, if it's a dice-roll, to *extend* the window.
- `EVENTS` drives every piece of feedback:
  - `DICE_ROLLED` → plays dice sound, sets `diceRoll` (feeding `Dice3D`), sets `isAnimating`, **re-arms the state-commit timer to 1500 ms** so the board does *not* jump until the dice finish, then separately waits `1500 + (dice1+dice2)*200 ms` before clearing `isAnimating` (dice animation + token glide).
  - `PROPERTY_BOUGHT` / `RENT_PAID` / `PASSED_GO` / `TAX_PAID` → cash-register sound + toast + log line.
  - `WENT_TO_JAIL` → `playJailBars`.
  - `CARD_DRAWN` → toast/log; if the drawing player is local (`localPlayerIds.includes(...)`), opens the Chance/Community Chest card modal.
  - `GAME_RESTARTED` → resets `selectedPropertyId`.
  - Because **`EVENTS` always follows `STATE_UPDATE`**, a frame containing a `DICE_ROLLED` is split: the dice event is processed immediately, the *other* events are deferred by the committed 1500 ms so the on-screen sequence matches the physics of the board.
- **Toasts:** `addToast(msg)` assigns `id = crypto.randomUUID()` (a **string** — this `id` type bug was fixed in Phase 32: `Toast.id`/`EventLogEntry.id` were `number`), auto-dismisses after 4 s.
- **Event log:** every human-readable event is pushed to `eventLog` with a locale time stamp; a roll-up panel toggles it (`showEventLog`).
- **Dispatch identity (`activePlayerId`):** the component derives the actor from *state* (`state.players[state.currentPlayerIndex].id`) and sends that ID with the action. In an online room the server's CRITICAL-1 rewriting aligns it to the seat's own connection; in local hot-seat mode it is the **owner** session that drives every seat (see **§5.3**), so the claimed ID is honoured.

### 7.6 HUD injection pattern (`packages/web-client/AGENTS.md`)

- `*Room` (smart) vs `*Board` (dumb/presentational): boards receive the state via props and render interactive controls as `children` injected into the board center — e.g. `MonopolyBoard` receives the HUD (dice, buy/rent/jail/bankruptcy modals, trade panel) through `children`, keeping board geometry and game logic decoupled.
- **Token placement rules:** properties use solid color bars; special spaces (Chance, Community Chest, Income/Luxury Tax) use a multi-color *gradient* bar; corner cells (Go, Jail, Free Parking, Go to Jail) are colorless. Tokens on bar-cells sit along the bar's inner edge (parallel, centered); tokens on corners are centered.

### 7.7 Boards & specialized tools (component map)

- **`MonopolyBoard.tsx`** — 11×11 CSS-grid board; positions per space; `PlayerToken` per player animated into cell coordinates; deed card lookup via `BOARD_SPACES`.
- **`PropertyManager.tsx`** — property deeds; buy/house/mortgage/unmortgage against the owner; renders `SELL_HOUSE` / `MORTGAGE_PROPERTY` in debt-resolution flow.
- **`TradeManager.tsx`** + **`TradeNotification.tsx`** — the full `PROPOSE_TRADE → ACCEPT/REJECT/CANCEL_TRADE` lifecycle, money + property bundles, inbound-trade banners.
- **`Dice3D.tsx`** — CSS-3D dice roll (rotates/tumbles) keyed off `diceRoll`.
- **`CatanBoard.tsx`** — hex rendering from `catan-engine` `board.ts`; roads/settlements/cities; robber placement; hover-to-place during initial placement (`PLACE_INITIAL_SETTLEMENT`/`PLACE_INITIAL_ROAD`).
- **`CatanRoom.tsx`** — includes `DiscardModal` (`DISCARD_RESOURCES` on a 7), `RobberVictimModal` (choose `STOLEN_RESOURCE` target), `DevCardManager`, `TradeManager`; uses the same 50 ms / 1500 ms-dice commit pattern as GameRoom.
- **`ScotlandYardBoard.tsx`** — renders the London map from `positions.ts` as an SVG; wrapped in **`react-zoom-pan-pinch`** (`TransformWrapper`/`TransformComponent`) with +/- zoom buttons and `pinch={{ step: 0.005 }}`; detectives render `PlayerToken`s at nodes.
- **Scotland Yard hidden-movement rendering (verified, `ScotlandYardBoard.tsx:149-151`):**
  ```ts
  const isMrX = player.role === 'MR_X';
  const isRevealed = state.mrXRevealedTurns.includes(state.mrXLog.length);
  const isMrXActiveTurn = state.activePlayerId === player.id;
  ```
  Mr. X's token is drawn at his (possibly sentinel-`0` scrubbed) position **only** on a reveal turn, on his own active turn, or after game over; otherwise the board shows a `MrXShadow` ("Mr. X is on the move…") so detectives on a *shared* board still can't see him. (FIXES.md #9 documents the original bug where hot-seat `isLocal` leaked his exact cell.)
- **`ScotlandYardRoom.tsx`** — ticket panel (taxi/bus/underground/secret/2x), the `mrXLog` strip (ticket types + SECRET/2x markers), route picker, `MOVE`/`DOUBLE_MOVE` send with a `pendingDoubleMove` continuation so Mr. X can chain two hops before committing; balance buffers for hidden moves.
- **`AudioToggle.tsx`** — global muted flag stored alongside the `SoundEngine` singleton.

### 7.8 `SoundEngine` (`utils/SoundEngine.ts`) — procedural audio, zero assets

A lazy `AudioContext` singleton (`new (window.AudioContext || webkitAudioContext)()`, created on first use) synthesizes every effect with oscillators + gain envelopes — no audio files shipped:
- `playTurnChime` (two-tone sine chime), `playCashRegister` (square-wave double "cha-ching" with short envelope), `playDiceRoll` (filtered noise hits), `playJailBars` (sawtooth), plus the card/click foley used by the rooms.

---

## 8. Verified Findings & Known Limitations

### ✅ Hot-seat local mode: owner session acts for any seat *(fixed — regression from CRITICAL-1)*

In Phase 31 the **CRITICAL-1** impersonation hardening made the server rewrite every inbound action's `playerId` to the authenticated socket identity. Because local hot-seat mode opens **one** `WebSocket` (authenticated as `localPlayerIds[0] = p1`) and drives *all* seats over it, that hardening regressed hot-seat play: any action dispatched as `p2` during `p2`'s turn was rewritten to `p1` and rejected with `INVALID_ACTION`. A reproduce script against `localhost:3000` confirmed: `ROLL_DICE` (p1) → OK, `END_TURN` (p1) → OK, then `ROLL_DICE` as `p2` over the `p1` connection → `INVALID_ACTION`.

**Fix (Phase 32):** rooms created with `hotSeat: true` are flagged (`isHotSeat`) with the creator recorded as `ownerPlayerId`; the flags survive Redis rehydration. The WS dispatch rule then allows the **owner's session** to act for any seat it claims:

- `POST /rooms` with `{ hotSeat: true }` returns `isHotSeat: true`.
- The owner's single browser may dispatch as `p1`, `p2`, … — the server honours the claimed `playerId` instead of rewriting it.
- **Online joiners** in the same hot-seat room (mixed play) remain strictly bound to one-seat-one-token (CRITICAL-1 intact for non-owners).
- Action rejections for a seat with no live connection (the shared-browser case, e.g. an invalid move while driving `p2`) are routed to the **owner's** connection so the driving browser still gets `ACTION_REJECTED` feedback.
- Regression tests: owner claim honoured (rejected by the engine because it is not the claimed seat's turn), non-owner forged `playerId` ignored, create-room flag round-trip, and Room rehydration of the flags.

The Fixes tracking entry and README claim are updated accordingly.

### ✅ What is verified working (Phase 32 live-container checks)

- Ship-and-run via `docker compose up -d`; redis health-check gates server start; client served by nginx; CORS allows `:5173`/`:8080` and blocks others (preflight verified).
- Online seat flow: create (p1 token) → join (p2 token) → per-seat WS → turn order enforced per seat.
- Redis persistence: snapshots under `room:<id>`; server restart → `Rehydrated room … from Redis` → session tokens survive → seats reconnect; `bankMoney: Infinity` round-trips.
- Scotland Yard: per-player projection hides Mr. X until reveal turns; Catan dev-card/robber projections hold.

---

## 9. Containerization & Deployment (Phase 32)

### `docker-compose.yml`

Three services:

1. **`redis`** — `redis:7-alpine`, an anonymous/volumed data dir, and a `redis-cli ping` **healthcheck**; `server` declares `depends_on: redis: condition: service_healthy`.
2. **`server`** — built from `packages/server/Dockerfile`; ports `3000`; env sourced from `.env` / `.env.example` (`HOST=0.0.0.0`, `PORT=3000`, `CORS_ORIGIN=http://localhost:5173,http://localhost:8080`, `REDIS_URL=redis://redis:6379`).
3. **`client`** — built from `packages/web-client/Dockerfile`; **nginx** serving the static Vite build on `5173` (SPA `try_files` fallback, fixed `COPY packages/web-client/nginx.conf` path in Phase 32).

### `packages/server/Dockerfile`

Multi-stage, `node:24-alpine`. Installs with `npm ci --omit=dev` (this is why **`tsx` is a production dependency** of the server — the runtime executes TypeScript directly, so a dev-deps `tsx` would vanish in the `--omit=dev` prune and break the image; `package.json`/lockfile updated accordingly in Phase 32). Runs `node --import tsx` / `tsx` on the compiled entry.

### `packages/web-client/Dockerfile` + `nginx.conf`

Build stage: `npm ci` + `vite build`. Runtime stage: `nginx:alpine` + `dist/`. `nginx.conf` implements the SPA fallback and serves on the configured port. The built client talks cross-origin to `server:3000` (allowed by `CORS_ORIGIN`), so no reverse-proxy is required in the image.

### `.dockerignore` / `.env.example`

`.dockerignore` keeps `node_modules`, `dist`, `coverage`, git artifacts out of build contexts. `.env.example` documents `PORT`, `HOST`, `CORS_ORIGIN`, `REDIS_URL` for compose.

---

## 10. Testing & CI

- **Vitest workspace** (`vitest.workspace.ts`) covering engines (rule-level unit tests: Monopoly edge cases like debt collection & even-build rules, Catan initial placement + win conditions, Scotland Yard ticket/reveal semantics), server (HTTP + WS + `RoomManager` rehydration/Infinity regression), and client (component + `useGameSocket` hook tests under `packages/web-client/src/hooks/__tests__` and `components/__tests__`).
- **`npm run test:cov`** regenerates `COVERAGE.md`; full suite is **26 files / 285 tests** green as of Phase 32.
- **`npm run typecheck`** uses root TS 5.x for engines/server and the client's TS ~6.x (required by Vite 8).
- **`npm run lint`** root `oxlint` over engines + server.
- **GitHub Actions (`ci.yml`)** runs typecheck → lint → full tests → production builds for server & client on every push/PR. (The `dist`/CI artifacts are uncommitted by policy after commit `425f009`.)

---

## 11. Glossary & Quick References

- **Frame** — one JSON object over the WS: `STATE_UPDATE`, `EVENTS`, `ACTION_REJECTED`, `ERROR` (server→client); action object (client→server).
- **Seat** — a `p{n}` id in `room.playerIds`; a seat is *owned* by the browser holding its session token.
- **Session token** — per-seat `crypto.randomUUID()` persisted in the Redis snapshot; required in the WS URL.
- **Projection** — the output of `getStateForPlayer`, enforced once in `Room.broadcastState()`.
- **Rehydration** — rebuilding live `Room`s from `room:*` Redis snapshots at boot.
- **`redisReplacer`/`redisReviver`** — custom JSON (de)serializers keeping `Infinity`/`NaN` intact.
- **CRITICAL-1** — server-side `action.playerId := socket.auth.playerId` (anti-impersonation; Phase 31).

### Where the interesting code lives

| Concern | File |
| --- | --- |
| Engine contract / RNG / configs | `packages/engine-core/src/{IGameEngine,types,utils,gameConfig}.ts` |
| Engine implementations | `packages/*-engine/src/*Engine.ts` (+ `board.ts`, `types.ts`) |
| HTTP + WS app, routes, auth, ratelimit | `packages/server/src/server.ts` |
| Room state machine / broadcasting | `packages/server/src/Room.ts` |
| Room lifecycle / rehydration | `packages/server/src/RoomManager.ts` |
| Redis (de)serialization | `packages/server/src/RedisStore.ts` |
| Per-game action Zod schemas | `packages/server/src/schemas.ts` |
| Client routing / Lobby | `packages/web-client/src/{App,Lobby}.tsx` |
| Per-game smart rooms | `packages/web-client/src/components/*Room.tsx` |
| Boards & HUDs | `packages/web-client/src/components/*Board.tsx`, `PropertyManager.tsx`, `TradeManager.tsx`, `Dice3D.tsx` |
| Socket hook / toasts / log / audio | `packages/web-client/src/hooks/*.ts`, `utils/SoundEngine.ts` |
| Deployment | `docker-compose.yml`, `packages/server/Dockerfile`, `packages/web-client/Dockerfile` + `nginx.conf`, `.env.example` |