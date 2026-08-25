# 🚀 Universal Multiplayer Board Game Platform

A modular, multi-game platform supporting classic board games, powered by **TypeScript**, **React**, **Vite**, and **Fastify**.

This monorepo project currently implements the rules and logic for:
- 🎩 **Monopoly**
- 🐑 **Catan** (In Progress)

## 🏗️ Architecture

The platform is designed around strict, immutable, pure functional state machines for game engines, ensuring deterministic gameplay and 100% testability.

### Packages
- `@packages/engine-core`: Shared interfaces (`IGameEngine`, `IGameState`, `IPlayerAction`) defining the pure state machine boundaries.
- `@packages/monopoly-engine`: Complete Monopoly ruleset with property management, trading, dice logic, jail rules, bankruptcy, and Chance/Community chest cards.
- `@packages/catan-engine`: (In Progress) Resource management, hex grid coordinate systems, building, and maritime trade.
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

## 📄 License

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.
