# 🚀 Universal Multiplayer Board Game Platform

A modular, multi-game platform supporting classic board games, powered by **TypeScript**, **React**, **Vite**, and **Fastify**.

This monorepo project currently implements the rules and logic for:
- 🎩 **Monopoly**
- 🐑 **Catan**
- 🕵️ **Scotland Yard**

## 🏗️ Architecture

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
- **Real-Time Multiplayer**: WebSocket synchronization for instant action reflection.
- **Strict Validation**: Zod schemas used to validate every action both on the server and client.
- **Audio & Visual Polish**: Procedural Web Audio effects, dynamic 3D CSS dice rolls, and animated tokens.
- **Interactive UI**: Rich contextual HUDs, robust trading modals, property management interfaces, and a dynamic event log.
- **TDD Backed**: Comprehensive test suites for game engines guaranteeing rule enforcement (e.g., Monopoly's complex edge cases like debt collection and even-build rules).
- **Optimized & Pure Engine**: Deterministic pure state machines with shallow cloning for ultra-fast, garbage-collection-friendly game loop performance.

## 📄 License

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.
