/**
 * End-to-end browser test for Phase 37 (Public Room Browser).
 *
 * Drives two real Chrome pages (via puppeteer-core/CDP) against the running stack:
 *   client  http://localhost:5173
 *   server  http://localhost:3000  (ws://localhost:3000)
 *
 * Coverage:
 *  1. The Lobby renders the "Open Rooms" directory (empty state) and the
 *     "List this room in the public browser" checkbox (on by default).
 *  2. Creating a game sends isPublic:true and the room appears in the browser
 *     with an "Open" chip plus a live seat count.
 *  3. A second browser joins the room from the directory (Join button) and
 *     lands in the game as the second player.
 *  4. After the first player rolls, the entry flips to "Playing", shows
 *     "2/2 seats taken" and a disabled "Full" button.
 *  5. A third browser watches the full room from the directory (Watch button)
 *     and enters the spectator view.
 *  6. Creating a room with the visibility toggle off sends isPublic:false and
 *     that room never appears in the browser.
 *
 * Run: node ui-tests/rooms-browser.e2e.mjs   (from repo root, with servers up;
 *      ideally after a restart so the in-memory server starts with no rooms)
 */
import puppeteer from 'puppeteer-core';
import { access } from 'node:fs/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CLIENT_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const clickButtonByText = async (page, text) => {
  const clicked = await page.$$eval('button', (btns, t) => {
    const el = btns.find((b) => b.textContent.trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  if (!clicked) throw new Error(`Button "${text}" not found`);
};
const clickEnabledButton = async (page, text) =>
  page.$$eval('button', (btns, t) => {
    const el = btns.find((b) => b.textContent.trim().includes(t));
    if (el && !el.disabled) { el.click(); return true; }
    return false;
  }, text);
const clickByAriaLabel = async (page, label) => {
  const clicked = await page.$$eval('button', (btns, l) => {
    const el = btns.find((b) => b.getAttribute('aria-label') === l);
    if (el) { el.click(); return true; }
    return false;
  }, label);
  if (!clicked) throw new Error(`Button with aria-label "${label}" not found`);
};
const dismissCardModal = (page) =>
  page.$$eval('button', (btns) => {
    const b = btns.find((x) => x.textContent.trim() === 'OK');
    if (b && !b.closest('button[disabled]')) b.click();
  });
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const openLobby = async (page) => {
  await page.goto(CLIENT_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('text=Welcome to the Lobby', { timeout: 15000 });
};
const capturePostBody = (page) =>
  new Promise((resolve) => {
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/rooms')) resolve(req.postData());
    });
  });

const failures = [];

async function main() {
  await access(CHROME);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const wrap = (page, label) => {
      page.on('console', (msg) => {
        if (msg.type() === 'error') failures.push(`[${label} console.error] ${msg.text()}`);
      });
      page.on('pageerror', (err) => failures.push(`[${label} pageerror] ${err.message}`));
      page.on('requestfailed', (req) => failures.push(`[${label} requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`));
      page.on('response', (res) => {
        if (res.status() >= 400) failures.push(`[${label} http ${res.status()}] ${res.url()}`);
      });
      return page;
    };

    const page1 = wrap(await browser.newPage(), 'p1');
    const page2 = wrap(await browser.newPage(), 'p2');
    const page3 = wrap(await browser.newPage(), 'p3');

    // -- 1. Lobby shows the empty-state directory + public toggle --
    console.log('1) Opening lobby in browser #1');
    await openLobby(page1);
    if (!/open rooms/i.test(await bodyText(page1))) throw new Error('"Open Rooms" section missing');
    const checked = await page1.$eval('input[aria-label="Public room"]', (i) => i.checked);
    if (!checked) throw new Error('Public-room checkbox should default to checked');
    console.log('   PASS: "Open Rooms" section present, visibility toggle on (private = public only when enabled)');
    const emptyState = await retry(
      async () => (await bodyText(page1)).includes('No public rooms right now'),
      { label: 'empty directory state' }
    );
    console.log(`   PASS: directory starts empty ("${emptyState ? 'no public rooms' : ''}")`);

    // -- 2. Create a PUBLIC room; capture the payload --
    console.log('2) Creating a public Monopoly room in browser #1');
    const createPost = capturePostBody(page1);
    await page1.$eval('select[aria-label="Number of players"]', (s) => (s.value = '2'));
    await page1.$eval('select[aria-label="Number of players"]', (s) => s.dispatchEvent(new Event('change', { bubbles: true })));
    await clickButtonByText(page1, 'Create New Game');
    const createPayload = await createPost;
    if (!createPayload) throw new Error('POST /rooms payload was not captured on create');
    const created = JSON.parse(createPayload);
    if (created.isPublic !== true) throw new Error(`Expected isPublic:true, got ${JSON.stringify(created.isPublic)}`);
    console.log(`   captured POST /rooms: ${createPayload}`);
    console.log('   PASS: public room created (isPublic:true)');

    const publicRoomId = await retry(async () => {
      const t = await bodyText(page1);
      const m = t.match(/Room:\s*([0-9a-f-]{36})/);
      return m ? m[1] : null;
    }, { label: 'public room to open in browser #1' });
    if (!(await bodyText(page1)).includes('p1')) throw new Error('Browser #1 should be playing as p1');
    console.log(`   PASS: browser #1 is inside game room ${publicRoomId}`);

    // -- 3. Browser #2 joins from the directory --
    console.log('3) Browser #2 opens the Lobby and joins the room listing');
    await openLobby(page2);
    await retry(async () => {
      const t = await bodyText(page2);
      return t.includes(publicRoomId) && t.includes('Open') && t.includes('Join');
    }, { label: 'new public room to appear in directory with Open/Join' });
    console.log('   PASS: room listed with an "Open" chip and a Join button');
    await clickButtonByText(page2, 'Join');
    await retry(async () => {
      const t = await bodyText(page2);
      return t.includes(`Room:`) && t.includes('p2');
    }, { label: 'browser #2 to join the room as p2' });
    console.log('   PASS: browser #2 joined as p2 from the directory');

    // -- 4. Start the game so the directory reflects "Playing" + Full --
    console.log('4) Browser #1 rolls to start the game (LOBBY -> IN_PROGRESS)');
    await retry(async () => clickEnabledButton(page1, 'Roll Dice'), { label: 'browser #1 roll button to be clickable' });
    await dismissCardModal(page1);

    console.log('5) Browser #3 sees the full, playing game with Full + Watch');
    await openLobby(page3);
    const entryText = await retry(async () => {
      const t = await bodyText(page3);
      return t.includes(publicRoomId) ? t : null;
    }, { label: 'room to remain listed in browser #3' });
    if (!entryText.includes('Playing')) throw new Error('Expected an "Playing" status chip for the started game');
    if (!entryText.includes('2/2 seats taken')) throw new Error(`Expected "2/2 seats taken", dir text: ${entryText.slice(0, 400)}`);
    if (!entryText.includes('Full')) throw new Error('Expected a "Full" button (no seats left)');
    const fullDisabled = await page3.$$eval('button', (btns) => {
      const el = btns.find((b) => b.textContent.trim() === 'Full');
      return !!el && el.disabled;
    });
    if (!fullDisabled) throw new Error('The Full button must be disabled');
    console.log('   PASS: directory shows Playing, "2/2 seats taken" and a disabled Full button');

    // -- 5. Spectate the full room from the directory --
    console.log('6) Browser #3 watches the full room from the directory');
    await clickButtonByText(page3, 'Watch');
    await retry(async () => {
      const t = await bodyText(page3);
      return t.includes('You are watching this game as a spectator');
    }, { label: 'spectator view to open in browser #3' });
    await retry(async () => (await bodyText(page3)).includes('1 spectator watching'), {
      label: 'live spectator count of 1',
    });
    console.log('   PASS: browser #3 entered spectator view and sees "1 spectator watching"');

    // -- 6. Private rooms never appear in the browser --
    console.log('7) Browser #3 creates a PRIVATE room and confirms it stays hidden');
    await openLobby(page3);
    await page3.$eval('input[aria-label="Public room"]', (i) => i.click());
    const privatePost = capturePostBody(page3);
    await clickButtonByText(page3, 'Create New Game');
    const privatePayload = await privatePost;
    if (!privatePayload) throw new Error('POST /rooms payload not captured for private room');
    const priv = JSON.parse(privatePayload);
    if (priv.isPublic !== false) throw new Error(`Expected isPublic:false, got ${JSON.stringify(priv.isPublic)}`);
    console.log(`   captured POST /rooms: ${privatePayload}`);
    const privateRoomId = await retry(async () => {
      const t = await bodyText(page3);
      const m = t.match(/Room:\s*([0-9a-f-]{36})/);
      return t.includes('p1') && m ? m[1] : null;
    }, { label: 'private room to open in browser #3' });

    await openLobby(page3);
    await retry(async () => (await bodyText(page3)).includes(publicRoomId), {
      label: 'public room to stay listed while private room is hidden',
    });
    const stillShown = await retry(async () => {
      const t = await bodyText(page3);
      return !t.includes(privateRoomId) ? t : null;
    }, { label: 'private room to stay out of the directory' });
    if (stillShown.includes(privateRoomId)) throw new Error('Private room leaked into the public browser');
    console.log('   PASS: private room excluded; original public room still listed');

    // -- 7. Game-type filter (server-side ?gameType=) --
    console.log('8) Filtering the directory by game type in browser #3');
    await clickByAriaLabel(page3, 'Filter to Catan rooms');
    await retry(async () => {
      const t = await bodyText(page3);
      return t.includes('No Catan rooms right now.') && !t.includes(publicRoomId);
    }, { label: 'Catan filter to hide the Monopoly room' });
    console.log('   PASS: Catan filter shows the empty state and hides the Monopoly room');
    await clickByAriaLabel(page3, 'Show all rooms');
    await retry(async () => (await bodyText(page3)).includes(publicRoomId), {
      label: 'Show all filter to restore the directory',
    });
    console.log('   PASS: "Show all rooms" restores the full directory');

    console.log('\n=== RESULT: PASS ===');
  } finally {
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