---
name: consolidate-command
description: Workflow for Consolidating Changes. Use this skill when requested to run the consolidate command.
---
# Rule: Consolidate Command

When the user gives the command "Consolidate" or asks to consolidate changes, you must perform the following actions:

1. **Review Recent Changes**: Analyze the tasks, feature implementations, and code modifications you have recently completed in the current session.
2. **Update Trackers**: Open and update `PROJECT_TRACKER.md`, `README.md`, and `AGENTS.md` (the generic agent-context file, previously `GEMINI.md`, that any LLM agent tooling can consume) to accurately reflect these newly completed changes. Ensure that the project overview, tracker progress, and agent context are all perfectly aligned.
3. **Status Management**: Add detailed bullet points under the appropriate Phase sections. If a phase is fully completed, ensure its status is updated to 🟢 (Completed). If it was in the "Active & Remaining Roadmap", move it up to the "Completed Phases & Implemented Features" section.
4. **Consistency**: Ensure that the tracker accurately mirrors the exact state of the codebase. Do not list features as completed if they are only partially implemented.

