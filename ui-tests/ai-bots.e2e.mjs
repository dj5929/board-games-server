/**
 * End-to-end browser test for Phase 35 (Automated Computer AI Players).
 *
 * Drives a real Chrome (via puppeteer-core/CDP) against the running stack:
 *   client  http://localhost:5173
 *   server  http://localhost:3000  (ws://localhost:3000)
 *
 * Coverage:
 *  1. Lobby renders the new "Computer Players (Bots)" selector.
 *  2. Selecting "2 Players" + "1 Computer" and clicking Create sends
 *     bots:["p2"] to POST /rooms (monopoly, hot-seat by default).
 *  3. The client navigates into a live game room for the human (p1).
 *  4. The room's server state assigns p2 as a bot seat and p2 is NOT joinable.
 *  5. The server-side BotController autonomously drives p2's turns through the
 *     same WS dispatch pipeline — turn alternation continues without any input
 *     from the human during p2's turns.
 *
 * Run: node ui-tests/ai-bots.e2e.mjs   (from repo root, with servers up)
 */
import puppeteer from 'puppeteer-core';
import { access } from 'node:fs/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CLIENT_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickButtonByText = async (page, text) => {
  const clicked = await page.$$eval('button', (btns, t) => {
    const el = btns.find((b) => b.textContent.trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  if (!clicked) throw new Error(`Button "${text}" not found`);
};
const retry = async (fn, { attempts = 60, delayMs = 500, label = 'condition' } = {}) => {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await fn();
      if (out) return out;
    } catch (e) {
      lastErr = e;
    }
    await sleep(delayMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastErr ? ` (${lastErr.message})` : ''}`);
};

// Collect console + network failures so "zero errors" is verifiable.
const failures = [];

async function main() {
  await access(CHROME);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') failures.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => failures.push(`[pageerror] ${err.message}`));
    page.on('requestfailed', (req) => failures.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`));
    page.on('response', (res) => {
      if (res.status() >= 400) failures.push(`[http ${res.status()}] ${res.url()}`);
    });

    console.log(`1) Opening lobby at ${CLIENT_URL}`);
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('text=Welcome to the Lobby', { timeout: 15000 });

    // -- 1. New bots selector is rendered --
    const playerSelect = await page.$('select[aria-label="Number of players"]');
    const botSelect = await page.$('select[aria-label="Computer players"]');
    if (!playerSelect || !botSelect) throw new Error('Lobby player/bot selects not rendered');
    console.log('   PASS: "Computer Players (Bots)" selector is present');

    // Default Monopoly min players is 2; enforce 2 players + 1 bot.
    await playerSelect.select('2');
    await botSelect.select('1');
    const botOptionText = await botSelect.$eval('option[value="1"]', (o) => o.textContent.trim());
    if (botOptionText !== '1 Computer') throw new Error(`Unexpected bot option label: "${botOptionText}"`);
    console.log('   PASS: selected 2 Players + 1 Computer');

    // Capture the POST /rooms payload to prove bots:["p2"] is sent.
    const postPayloadPromise = new Promise((resolve) => {
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().endsWith('/rooms')) {
          resolve(req.postData());
        }
      });
    });

    console.log('2) Clicking "Create New Game"');
    await clickButtonByText(page, 'Create New Game');

    const postData = await postPayloadPromise;
    if (!postData) throw new Error('POST /rooms payload was not captured');
    const sent = JSON.parse(postData);
    console.log(`   captured POST /rooms: ${postData}`);
    if (sent.bots?.length !== 1 || sent.bots[0] !== 'p2') {
      throw new Error(`Expected bots:["p2"] but got ${JSON.stringify(sent.bots)}`);
    }
    console.log('   PASS: bots:["p2"] was sent for a 2-player room');

    // -- 2. Client navigates into the game room --
    await page.waitForFunction(
      () => document.body.innerText.includes('Room:') && document.body.innerText.includes('You are playing as'),
      { timeout: 20000 }
    );
    const bodyText = await page.evaluate(() => document.body.innerText);
    const roomIdMatch = bodyText.match(/Room:\s*([0-9a-f-]{36})/);
    if (!roomIdMatch) throw new Error('No room UUID found on the page');
    const roomId = roomIdMatch[1];
    const isHumanP1 = bodyText.includes('p1');
    console.log(`   entered room ${roomId}; you are playing as p1: ${isHumanP1}`);
    if (!isHumanP1) throw new Error('Expected human seat p1 in hot-seat room');
    console.log('   PASS: client loaded the live room for the human');

    // -- 3. Server-side check: p2 is a bot seat (not joinable) --
    // There is no public "is this seat a bot" REST endpoint, so drive the join
    // API directly: with p1 taken by the owner, p2 must be excluded from a join.
    const joinRes = await fetch(`${API_URL}/rooms/${roomId}/join`, { method: 'POST' });
    const joinOutcome = await joinRes.text();
    console.log(`   POST /rooms/${roomId}/join -> HTTP ${joinRes.status} ${joinOutcome}`);
    if (joinRes.status === 200) {
      throw new Error(`Room arris incorrect: a bot seat (p2) was offered to a joiner: ${joinOutcome}`);
    }
    console.log('   PASS: bot seat p2 was NOT offered to a new joiner (room rejects/404)');

    // -- 4. Drive the human's (p1) turns until the bot (p2) auto-plays --
    // GameRoom renders "<playerId>'s Turn" (CSS-uppercased by `uppercase`). The
    // game starts in LOBBY and only moves to IN_PROGRESS after the human's first
    // ROLL_DICE (FIXES #20), so we must drive p1's turns before BotController acts.
    const getActiveTurn = () => page.evaluate(() => {
      const m = document.body.innerText.match(/^p[12]\s*'?s?\s*turn/mi);
      if (!m) return null;
      const norm = m[0].replace(/\s+/g, ' ').trim().toLowerCase();
      return norm.startsWith('p1') ? 'P1' : 'P2';
    });

    const clickEnabledButton = async (text) => {
      const clicked = await page.$$eval('button', (btns, t) => {
        const el = btns.find((b) => b.textContent.trim().includes(t));
        if (el && !el.disabled) { el.click(); return true; }
        return false;
      }, text);
      return clicked;
    };

    // Dismiss any Chance / Community Chest card modal that appears for the human.
    const dismissCardModal = async () => {
      await page.$$eval('button', (btns) => {
        const b = btns.find((x) => x.textContent.trim() === 'OK');
        if (b && !b.closest('button[disabled]')) b.click();
      });
    };

    const initialTurn = await getActiveTurn();
    console.log(`   initial active turn: ${initialTurn}`);
    if (initialTurn === null) {
      await retry(getActiveTurn, { label: 'initial turn to render' });
    }

    let p2TurnsObserved = 0;
    const start = Date.now();
    const TIMEOUT_MS = 60000;
    while (Date.now() - start < TIMEOUT_MS && p2TurnsObserved < 1) {
      await dismissCardModal();
      const turn = await getActiveTurn();
      if (turn === null) { await sleep(300); continue; }

      if (turn === 'P2') {
        p2TurnsObserved++;
        console.log('   [bot turn] active turn reached p2 (the server-side bot)');
        // Prove autonomy: the bot must resolve its own turn with NO clicks from us.
        const botStart = Date.now();
        const nextTurn = await retry(
          async () => {
            const t = await getActiveTurn();
            return t && t !== 'P2' ? t : null;
          },
          { attempts: 90, delayMs: 500, label: 'p2 (bot) resolving its own turn' }
        );
        const botPlayMs = Date.now() - botStart;
        if (nextTurn !== 'P1' && nextTurn !== null) {
          console.log(`   NOTE: after the bot turn the active player is "${nextTurn}" (expected p1; a bot doubles roll can keep the bot active)`);
        }
        console.log(`   PASS: the bot resolved its turn autonomously in ${botPlayMs}ms (no human input)`);
      } else {
        // p1's turn: roll, then end the turn once rolled.
        const rolled = await clickEnabledButton('Roll Dice');
        if (rolled) { await sleep(500); continue; }
        const ended = await clickEnabledButton('End Turn');
        if (ended) { await sleep(400); continue; }
        // p1 may be in a sub-state (jail fine prompt, etc.) — give it a beat.
        await sleep(400);
      }
    }

    if (p2TurnsObserved < 1) {
      throw new Error('p2 (bot) never had a turn within the timeout');
    }
    console.log('   PASS: human p1 drove its turns and the server-side bot p2 auto-played');

    // Give the loop a moment and take a sanity snapshot of the room state.
    await sleep(1500);
    const finalText = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('   room snapshot (first 600 chars):\n---\n' + finalText + '\n---');

    console.log('\n=== RESULT: PASS ===');
  } finally {
    // No DELETE route exists; the dev server here runs without Redis, so no
    // snapshot is persisted and the idle room simply stays in memory until the
    // dev server is restarted.
    await browser.close();
  }

  if (failures.length) {
    console.error('\nBrowser failures detected:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('No console/page/network failures detected.');
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err.message);
  if (failures.length) console.error('Browser failures:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exitCode = 1;
});