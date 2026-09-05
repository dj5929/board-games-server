# Universal Multiplayer Board Game Platform (Agent Rules)

**Current Focus:** Automated Computer AI Players (Phase 35) — in progress. Step 1 infrastructure COMPLETE: `botSeats` seat flags on `Room` (persisted in Redis snapshots, excluded from `getAvailablePlayerId`), `RoomManager.allRooms()` iterator, `BotController` (1-second sweep over live rooms; re-validates each strategy action via `engine.isValidAction` before dispatch through the standard `Room.dispatch` pipeline), `POST /rooms` accepts `bots: string[]`, and a new `@packages/ai` workspace (`IBotStrategy`). Step 2 COMPLETE: `MonopolyBot` heuristic strategy (responds to trades, laddered debt resolution pay→sell→mortgage→bankrupt, jail card/fine escape, buy/build/unmortgage/end turn — every candidate engine-validated) registered in `server.ts` and verified end-to-end via a bot-vs-bot `BotGameplay.test.ts`. Step 3 COMPLETE: `ScotlandYardBot` (Mr. X flees the nearest detective via BFS hop-distance, preferring reserve tickets and double moves when they buy real separation — never through a reveal turn; detectives chase the revealed position or the `mrXLog`-deduced region, never blocking a teammate) registered in `server.ts`. Step 4 COMPLETE: `CatanBot` per-phase heuristics (token/distance-aware initial placement, exact-count most-abundant discards, VP-leader robber placement, main-turn ladder city→settlement→dev-card→knight→bank-trade→end, favorable-only trade responses) registered in `server.ts` and verified end-to-end via a bot-vs-bot `BotGameplay.test.ts`. Prior phases complete: 34 (Performance & Load Optimization — five batches of UI code-split/memo + server serialization dedup/coalescing + Redis rehydration + engine incremental recomputation + UI derived-data memoization; Post-Phase-34 fix: Monopoly now transitions `LOBBY → IN_PROGRESS` on its first successful action — see FIXES.md #20), 33 Turn Timer / AFK Management, 32 Containerization (incl. an automated git-push-triggered VPS deploy via `.github/workflows/deploy.yml` — see README "Production Deployment" / PROJECT_TRACKER Phase 32), 31 Redis persistence & server hardening.
**Local dev:** The server reads Redis if available (`REDIS_URL`) but also runs without it (single-instance, in-memory). For dev with persistence, start `docker run -d --name redis -p 6379:6379 redis:alpine` before `npm run dev`. Ignore `dump.rdb` (Redis RDB artifact).
**Automated UI testing:** `puppeteer-core` (root dev dep) is used to drive a real Chrome via CDP for end-to-end browser tests against a running stack (`:5173` client + `:3000` server). See the `ui-testing` skill. Full 2-player local Monopoly game to Game Over has been automated and passes (see PROJECT_TRACKER Phase 34 Batch 1).
**Tracker:** See [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) for roadmap and status.
**Fixes:** See [FIXES.md](./FIXES.md) for identified issues, planned improvements, and implementation diffs.
**Coverage:** See [COVERAGE.md](./COVERAGE.md) for the test coverage matrix of all components. Regenerate with `npm run test:cov`.

## Agent Rules & Guidelines

To ensure the agent maintains full context without overflowing token limits, the rules and instructions for this repository are modularized into global rules, on-demand skills, and directory-scoped rules.

### Global Rules (`.agents/rules/`)
These apply globally to the entire repository and are always loaded:
* [mission-and-tech.md](.agents/rules/mission-and-tech.md) - Tech Stack & Folder Structure
* [architecture.md](.agents/rules/architecture.md) - Game Engine Immutability & Purity Rules
* [testing.md](.agents/rules/testing.md) - TDD Strictness & Testing Coverage Matrix
* [coding-style.md](.agents/rules/coding-style.md) - Typescript Conventions

### On-Demand Skills (`.agents/skills/`)
These skills are loaded progressively. The agent can use them when it requires context on a specific domain:
* [catan-engine](.agents/skills/catan-engine/SKILL.md) - Official Catan Engine Rules
* [monopoly-engine](.agents/skills/monopoly-engine/SKILL.md) - Official Monopoly Engine Edge-Case Rules
* [scotland-yard-engine](.agents/skills/scotland-yard-engine/SKILL.md) - Official Scotland Yard Engine Rules & Hidden-Movement / Same-Board Semantics
* [troubleshooting](.agents/skills/troubleshooting/SKILL.md) - Known Bugs & Workarounds
* [consolidate-command](.agents/skills/consolidate-command/SKILL.md) - Workflow for Consolidating Changes
* [agent-workflow](.agents/skills/agent-workflow/SKILL.md) - PRAR Execution Modes
* [relint-after-fix](.agents/skills/relint-after-fix/SKILL.md) - Thorough lint workflow after lint fixes
* [restart-servers](.agents/skills/restart-servers/SKILL.md) - Restart / kill running dev servers
* [ui-testing](.agents/skills/ui-testing/SKILL.md) - Spawn Chrome for UI testing

### Directory-Scoped Rules
Rules that apply only when working within specific packages:
* [Web Client UI Patterns](packages/web-client/AGENTS.md) - React HUD Injection Patterns

*Note: [FIXES.md](./FIXES.md) tracks identified bugs, type safety issues & planned improvements.*