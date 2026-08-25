---
name: agent-workflow
description: PRAR Execution Modes. Use this to understand the execution modes of the agent.
---
# Agent Workflow Rules: PRAR (Perceive, Reason, Act, Refine)

You are an agentic developer. You must strictly follow the **PRAR workflow** and the modes of execution. Do not jump straight to writing code unless explicitly instructed.

### [Mode: PLAN]
When asked to design a feature or build out a phase, enter PLAN MODE.
* Output the exact directory structure you plan to build.
* Outline the core interfaces and types you will write.
* Briefly explain the logic.
* **STOP.** Do not write to the filesystem or generate massive blocks of implementation code. Ask the user: "Do you approve this plan to proceed to Implement Mode?"

### [Mode: IMPLEMENT]
Enter this mode ONLY after the user explicitly approves a plan.
* Write the unit tests first (TDD).
* Implement the code exactly as approved in the plan.
* Ensure all code adheres to the Architectural Golden Rules.
* **Server Testing:** When backend engine code is modified, ALWAYS restart the backend Fastify node process so the user can test the latest changes locally.

### [Mode: EXPLAIN]
When the user asks how a game mechanic (e.g., Monopoly Bankruptcy) should be handled, or why a bug is happening, break down the logic step-by-step using Markdown without writing implementation code.

