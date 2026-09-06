---
name: ui-testing
description: >-
  Use this skill to spawn a Chrome browser and run automated testing on the user interface. Use this when the user asks to test the UI visually or interactively.
---

# UI Testing Skill

This skill guides the agent in running automated testing on the application's UI using a browser.

## Prerequisites

- The full stack must be running locally:
  - **Server:** `npx tsx src/server.ts` from `packages/server` (Fastify on `:3000`, WS on `ws://localhost:3000`).
  - **Client:** `npm run dev` from `packages/web-client` (Vite on `:5173`).
  - Optional persistence: `docker run -d --name redis -p 6379:6379 redis:alpine` (the server also runs in-memory without it).
- `puppeteer-core` is a root dev dependency (see `package.json`). A real Chrome/Edge install is used (no bundled browser):
  - `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`

## Process (puppeteer-core script)

1. Verify servers are up (`Test-NetConnection localhost -Port 5173/3000`).
2. Write a self-contained Node ESM script under `ui-tests/` (repo root). Launch Chrome via CDP:
   ```js
   import puppeteer from 'puppeteer-core';
   const browser = await puppeteer.launch({
     executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
     headless: true,
     args: ['--no-sandbox', '--disable-setuid-sandbox'],
   });
   const page = await browser.newPage();
   ```
3. Wire failure collectors on the page for a clean result: `console` (error type), `pageerror`, `requestfailed`, and `response` (status >= 400). Assert zero failures at the end.
4. Drive the page imperatively. Notes that matter in practice:
   - The Lobby lives at `http://localhost:5173`; the room the client navigates into does **not** change the URL (React state), so read the room UUID from the DOM: `document.body.innerText.match(/Room:\s*([0-9a-f-]{36})/)`.
   - `page.click('button:has-text("...")')` is **not** a valid selector out of the box — find buttons by text with `page.$$eval('button', (btns, t) => btns.find(b => b.textContent.trim().includes(t))?.click(), text)`.
   - Many headings/buttons are CSS-uppercased (e.g. `P1'S TURN`), so normalize innerText before string comparisons.
   - The Monopoly game starts in `LOBBY` and only reaches `IN_PROGRESS` after the human's first successful action (FIXES #20) — a browser test must have the human roll once before asserting server-side bot behavior.
5. Run it: `node ui-tests/ai-bots.e2e.mjs` (from repo root). The script prints per-assertion PASS lines and exits non-zero on failure.

## Reference: `ui-tests/ai-bots.e2e.mjs` (Phase 35 — AI players)

An end-to-end browser test for the Computer Players (Bots) feature. It:

1. Loads the Lobby and asserts the **"Computer Players (Bots)"** selector renders (`select[aria-label="Computer players"]`).
2. Selects `2 Players` + `1 Computer` for Monopoly and clicks **Create New Game**, capturing the `POST http://localhost:3000/rooms` payload to prove `bots:["p2"]` is sent (bots fill tail seats; the creator's first seat stays human).
3. Waits for the client to enter the room (WS through `ws://localhost:3000/rooms/{id}/ws?playerId=p1&token=...`) and asserts the human seat is `p1`.
4. Proves the **bot seat is excluded from joining**: `POST /rooms/{id}/join` returns 400 `Room is full` even though `p2` exists but no human connection holds it.
5. Proves the **BotController autonomously drives bot turns**: after the human rolls/ends once, the active turn reaches **P2; without any further clicks the bot resolves its own turn** (rolls, buys/develops, ends) and control returns to the human. Any `console`/network error fails the run.

Verified green on 2026-09-06 (two consecutive runs): lobby → room creation with `bots:["p2"]` → bot seat not joinable → bot auto-played its turn (e.g. bought Reading Railroad / St. Charles Place) with zero console/page/network failures.