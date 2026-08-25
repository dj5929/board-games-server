# Universal Multiplayer Board Game Platform (Agent Rules)

**Current Focus:** Multi-Game Architecture & Catan Core (Phase 13)
**Tracker:** See [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) for roadmap and status.
**Fixes:** See [FIXES.md](./FIXES.md) for identified issues, planned improvements, and implementation diffs.

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
* [troubleshooting](.agents/skills/troubleshooting/SKILL.md) - Known Bugs & Workarounds
* [consolidate-command](.agents/skills/consolidate-command/SKILL.md) - Workflow for Consolidating Changes
* [agent-workflow](.agents/skills/agent-workflow/SKILL.md) - PRAR Execution Modes

### Directory-Scoped Rules
Rules that apply only when working within specific packages:
* [Web Client UI Patterns](packages/web-client/GEMINI.md) - React HUD Injection Patterns

*Note: [FIXES.md](./FIXES.md) tracks identified bugs, type safety issues & planned improvements.*