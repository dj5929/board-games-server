# 🚀 Universal Multiplayer Board Game Platform

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6.svg)
![Monorepo: npm workspaces](https://img.shields.io/badge/Monorepo-npm%20workspaces-8b5cf6.svg)

A modular, real-time, multiplayer board game platform that plays classic board games over the web. The project is a **TypeScript monorepo** combining a **React + Vite** web client, a **Fastify + WebSocket** server, and a set of dependency-free, **pure functional game engines** (one per game).

Games currently implemented:
- 🎩 **Monopoly** — complete ruleset: property management, trading, jail, bankruptcy, Chance/Community Chest cards. (2–8 players)
- 🐑 **Catan** — hex-grid building, resource management, maritime trading, robber, development cards, awards, win conditions. (3–4 players)
- 🕵️ **Scotland Yard** — hidden movement on a London map graph, ticket tracking, and Mr. X reveal mechanics, including a shared-board hot-seat mode where Mr. X's location stays hidden from detectives until a reveal turn. (3–6 players)

---

## ✨ Highlights

- **Pure, deterministic game engines** — each engine is an immutable state machine (a `reducer(state, action)`), making gameplay rules fully unit-testable and free of hidden side effects.
- **Real-time multiplayer** — WebSocket-driven rooms with crypto-random room IDs and per-session tokens to keep connections secure.
- **Per-game player rules** — the Lobby's player selector adapts to each game's official range (Monopoly 2–8, Catan 3–4, Scotland Yard 3–6), enforced at both the server and engine layers.
- **Defense in depth validation** — the same Zod schemas validate every action on both the client *and* the server.
- **Polish** — a rich React UI with contextual HUDs, animated tokens, procedural Web Audio sound effects, and a live event log.
- **Fully CI-backed** — GitHub Actions runs typecheck, lint, the full test suite, and production builds on every push/PR.

---

## 🚀 Quick Start

> **Prerequisites:** [Node.js](https://nodejs.org/) `>= 20` and **npm**.

```bash
# 1. Clone the repository
git clone <your-repo-url> && cd BoardGameServer

# 2. Install every package from the root (npm workspaces)
npm install

# 3. Start the game server (Fastify, watch mode) -> http://localhost:3000
npm run dev --workspace @packages/server

# 4. In a second terminal, start the web client (Vite) -> http://localhost:5173
npm run dev --workspace web-client
```

Open the web client URL, create a room, share the link/room ID with friends, and play!

### Useful Scripts

| Command | Description |
| --- | --- |
| `npm test` | Run the full Vitest suite (engines + server + client). |
| `npm run test:cov` | Run the test suite with coverage report. |
| `npm run typecheck` | Type-check all packages (root TS 5.x + client TS 6.x). |
| `npm run lint` | Lint engines + server via root `oxlint`. |
| `npm run dev --workspace @packages/server` | Start the Fastify server in watch mode (`tsx`). |
| `npm run dev --workspace web-client` | Start the Vite dev client on `http://localhost:5173`. |
| `npm start` (in `packages/server`) | Run the compiled server on `http://127.0.0.1:3000`. |

---

## 📁 Repository Structure

```
BoardGameServer/
├── packages/
│   ├── engine-core/            # Shared interfaces for the pure state machines
│   ├── monopoly-engine/        # Monopoly rules engine
│   ├── catan-engine/           # Catan rules engine
│   ├── scotland-yard-engine/   # Scotland Yard rules engine
│   ├── server/                 # Fastify + WebSocket multiplayer server
│   └── web-client/             # React + Vite + Tailwind frontend
├── .github/workflows/          # CI pipeline (typecheck, lint, test, build)
├── package.json                # npm workspace root
└── vitest.workspace.ts         # Vitest workspace definition
```

---

## 🗺️ Architecture

The platform is designed around strict, immutable, pure functional state machines for game engines, ensuring deterministic gameplay and 100% testability.

### Game & UI Data Flow

The following flowchart illustrates the lifecycle of a player action, from the UI through the network to the pure game engine, and back to the UI.

```mermaid
flowchart TD
    Player([👤 Player]) -->|Interacts| UI[💻 React UI Component]
    
    subgraph Web Client
        UI
        ZodClient[✅ Local Zod Validation]
        State[📦 React Context / Store]
    end
    
    UI -->|Dispatches Action| ZodClient
    ZodClient -->|WebSocket Emit| WSServer[🔌 Fastify WS Server]
    
    subgraph Server Node
        WSServer
        ZodServer[✅ Server Zod Validation]
        Room[🏠 Room Manager]
    end
    
    WSServer -->|Receives Action| ZodServer
    ZodServer -->|Validates Payload| Room
    
    subgraph Game Engine
        PureLogic[⚙️ Pure State Machine (Reducer)]
    end
    
    Room -->|Passes Current State + Action| PureLogic
    PureLogic -->|Returns New Immutable State| Room
    
    Room -->|Broadcasts New State| WSServer
    WSServer -->|WebSocket Push| State
    State -->|Triggers Re-render| UI
```

### 🔄 Step-by-Step Code Flow

1. **User Interaction (`@packages/web-client`)**: A player clicks a button (e.g., "Roll Dice"). The React component dispatches a predefined action object.
2. **Action Validation (Client-Side)**: Before sending, the client uses `zod` schemas to ensure the action payload is well-formed.
3. **Network Transport (`@packages/server`)**: The client emits a WebSocket event containing the action to the Fastify server.
4. **Server Validation**: The Fastify server receives the payload and re-validates it using the identical `zod` schemas to prevent malicious or malformed requests.
5. **Game Engine Processing (`@packages/*-engine`)**: The server passes the current game state and the validated action to the game engine's pure reducer function (e.g., `MonopolyEngine.reducer(state, action)`).
6. **Immutable State Update**: The pure reducer calculates the next state based on the game rules and returns a completely new, immutable state object. It *never* mutates the old state.
7. **Broadcast**: The server updates the room's current state and broadcasts this new state to all connected clients in the room via WebSockets.
8. **UI Re-render (`@packages/web-client`)**: The React application receives the new state, updates the global context/store, and triggers a re-render of the UI to reflect the new game reality (e.g., moving the player's token on the board).

### Packages
- `@packages/engine-core`: Shared interfaces (`IGameEngine`, `IGameState`, `IPlayerAction`) defining the pure state machine boundaries.
- `@packages/monopoly-engine`: Complete Monopoly ruleset with property management, trading, dice logic, jail rules, bankruptcy, and Chance/Community chest cards.
- `@packages/catan-engine`: Resource management, hex grid coordinate systems, building, maritime trade, robber mechanics, development cards, awards, and win conditions.
- `@packages/scotland-yard-engine`: Graph-based map navigation, hidden movement, ticket management, and Mr. X reveal mechanics.
- `@packages/server`: A Fastify + WebSocket (`@fastify/websocket`) server with robust Zod validation for room and game state synchronization.
- `@packages/web-client`: The frontend React application built with Vite and Tailwind CSS. Features highly interactive UIs, smooth CSS animations, floating event logs, Web Audio API sound effects, and robust optimistic state updates.

## ⚙️ Note on TypeScript Versions
This project uses different TypeScript versions in different packages intentionally:
- The root project and engine packages use `typescript@^5.3.3`.
- The `web-client` package uses `typescript@~6.0.2`. This is required for Vite 8 compatibility.

## 🛠️ Features
- **Real-Time Multiplayer**: WebSocket synchronization for instant action reflection, secured per-room session tokens (crypto-random room IDs + token-verified connections).
- **Strict Validation**: Zod schemas used to validate every action both on the server and client.
- **Audio & Visual Polish**: Procedural Web Audio effects, dynamic 3D CSS dice rolls, and animated tokens.
- **Interactive UI**: Rich contextual HUDs, robust trading modals, property management interfaces, and a dynamic event log.
- **TDD Backed**: Comprehensive test suites for game engines guaranteeing rule enforcement (e.g., Monopoly's complex edge cases like debt collection and even-build rules).
- **Optimized & Pure Engine**: Deterministic pure state machines with shallow cloning for ultra-fast, garbage-collection-friendly game loop performance.
- **CI/CD**: GitHub Actions workflow running typecheck, lint, the full test suite, and both production builds on every push/PR.

## 🚀 Development & Tooling

Workspace is an npm monorepo; install once from the root with `npm install`. See the [Quick Start](#quick-start) table above for common commands.

The server binds `http://localhost:3000`, serves CORS only to the Vite dev client (`localhost:5173`), and requires a valid `?playerId=` + `token=` pair for every WebSocket room connection.

## 📄 License

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.
