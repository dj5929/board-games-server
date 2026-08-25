# Project Mission & Tech Stack
We are building a highly performant, browser-based multiplayer board game platform. 
* **Language:** TypeScript (Strict Mode) / Node.js
* **Backend:** Fastify, WebSockets (`ws` or `socket.io`)
* **Core Engine:** Pure, immutable state-reducer functions (No side effects)
* **Frontend:** React, Vite, Tailwind CSS, HTML5 Canvas/SVG for boards
* **Validation:** Zod (for validating all WebSocket payloads and actions)
* **Testing:** Vitest (Aiming for 100% coverage on engine state transitions)

## Project Structure (Monorepo)
Follow this structure when creating files:
```text
.
├── packages/
│   ├── engine-core/              # Abstract game interfaces and room primitives
│   ├── monopoly-engine/          # Monopoly-specific state machine and rules
│   ├── catan-engine/             # Catan-specific state machine and rules
│   ├── server/                   # WebSocket server & room management
│   └── web-client/               # React UI, Lobbies, and Game Boards
```
