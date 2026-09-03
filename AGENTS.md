# Universal Multiplayer Board Game Platform (Agent Rules)

**Current Focus:** Performance & Load Optimization (Phase 34) — Batch 1 (UI code-splitting, Vite `manualChunks`, board memoization, `Dice3D` CSS extraction) completed; Batches 2–4 (server serialization dedup, Redis rehydration, engine incremental recomputation) remaining. Prior phases complete: 32 Containerization (incl. an automated git-push-triggered VPS deploy via `.github/workflows/deploy.yml` — see README "Production Deployment" / PROJECT_TRACKER Phase 32), 33 Turn Timer / AFK Management, 31 Redis persistence & server hardening.
**Local dev:** The server reads Redis if available (`REDIS_URL`) but also runs without it (single-instance, in-memory). For dev with persistence, start `docker run -d --name redis -p 6379:6379 redis:alpine` before `npm run dev`. Ignore `dump.rdb` (Redis RDB artifact).
**Automated UI testing:** `puppeteer-core` (root dev dep) is used to drive a real Chrome via CDP for end-to-end browser tests against a running stack (`:5173` client + `:3000` server). See the `ui-testing` skill. Full 2-player local Monopoly game to Game Over has been automated and passes (see PROJECT_TRACKER Phase 34 Batch 1).
**Tracker:** See [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) for roadmap and status.
**Fixes:** See [FIXES.md](./FIXES.md) for identified issues, planned improvements, and implementation diffs.
**Audits:** The consolidated security & systems audit is [FINAL_AUDIT.md](./FINAL_AUDIT.md). All 18 findings cataloged across the codebase have now been verified and fully fixed in Phase 31.
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