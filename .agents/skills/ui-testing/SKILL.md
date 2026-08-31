---
name: ui-testing
description: >-
  Use this skill to spawn a Chrome browser and run automated testing on the user interface. Use this when the user asks to test the UI visually or interactively.
---

# UI Testing Skill

This skill guides the agent in running automated testing on the application's UI using a browser.

## Instructions

1. Identify the URL or local development server that needs to be tested. If a server is not running, you may need to start it first using the appropriate run command (e.g., `npm run dev`) in the background.
2. Use the `browser_subagent` tool to spawn a browser and perform the required automated testing tasks.
3. In the `Task` parameter of the `browser_subagent` tool, provide a highly detailed, actionable description of the test scenario. Tell the subagent what elements to click, type into, or navigate to, and state exactly what condition it should look for to stop and return.
4. Define a concise and descriptive `RecordingName` for the subagent session (e.g., `login_ui_test`).
5. After the `browser_subagent` returns, analyze its report or capture a screenshot to determine if the UI tests passed or failed.
6. Summarize the test outcome for the user.
