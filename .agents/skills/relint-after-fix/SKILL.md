---
name: relint-after-fix
description: >-
  Use this skill to ensure a thorough linting workflow. It instructs the agent to always run a relint after completing lint fixes.
---

# Relint After Fix

Whenever you complete a set of lint fixes, you must always run the lint check again to ensure that no new lint errors were introduced and that all existing errors were correctly resolved.

## Steps
1. Make your code edits to fix the initial lint errors.
2. Run the project's lint command again (e.g. `npm run lint --workspaces --if-present` or `npm run typecheck` depending on the project configuration).
3. If new errors appear, fix them and repeat step 2.
4. Once the lint command passes without errors, you may consider the task complete.
