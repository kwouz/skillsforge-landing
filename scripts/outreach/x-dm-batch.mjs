// Cold X DM batch via Playwright + persistent Chrome profile.
//
// Usage:  node scripts/outreach/x-dm-batch.mjs [--daily-cap 8] [--csv recipients.csv]
//
// Reads recipients.csv → for each row with x_handle and tier → DM via X UI.
// Honors daily-cap, deduplicates by log, paces 60-180s between DMs.

import { openBrowser, closeBrowser } from './browser-context.mjs';
import { delay, humanType, sleep } from './pacing.mjs';
import { log, alreadyContacted, countToday } from './log.mjs';
import { parseCsv } from './_csv.mjs';
import { render } from './templates.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return acc;
}, []));

const DAILY_CAP = parseInt(args['daily-cap']) || 8;
const CSV_PATH = args['csv'] || resolve(__dirname, 'recipients.csv');

const recipients = parseCsv(CSV_PATH).filter(
  (r) => r.x_handle && r.x_handle.startsWith('@') && r.tier && r.tier !== 'influencer'
);
console.log(`Loaded ${recipients.length} X recipients from ${CSV_PATH}`);

const sentToday = countToday('x-dm');
console.log(`Already sent today: ${sentToday}/${DAILY_CAP}`);

if (sentToday >= DAILY_CAP) {
  console.log('Daily cap reached, exiting.');
  process.exit(0);
}

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();

let sent = sentToday;
for (const r of recipients) {
  if (sent >= DAILY_CAP) break;
  if (alreadyContacted('x-dm', r.x_handle)) {
    console.log(`  skip ${r.x_handle} (already contacted)`);
    continue;
  }

  const templateName = `cold-${r.tier === 'agency' ? 'agency-2' : r.tier === 'inhouse' ? 'inhouse-3' : 'solo-1'}`;
  const { body } = render(templateName, { name: r.name.split(' ')[0], note: r.personal_note || '' });

  console.log(`→ DM ${r.x_handle} (${templateName})`);

  try {
    await page.goto(`https://x.com/messages/compose?recipient=${r.x_handle.replace('@', '')}`);
    await sleep(3000);

    // Detect login wall
    if (page.url().includes('/login')) {
      console.error('  ✗ login required — run browser-login.mjs first');
      log({ channel: 'x-dm', recipient: r.x_handle, template: templateName, status: 'error', error: 'login required' });
      break;
    }

    // Detect captcha / safety challenge
    const url = page.url();
    if (url.includes('/challenge') || url.includes('/account/access')) {
      console.error('  ⚠️  account challenge detected — STOPPING');
      log({ channel: 'x-dm', recipient: r.x_handle, template: templateName, status: 'error', error: 'account challenge' });
      break;
    }

    // Some flows show recipient picker first; click suggested user if present.
    const recipientPicker = page.locator('[data-testid="dmRecipientSearchInput"]');
    if (await recipientPicker.count() > 0) {
      const picker = recipientPicker.first();
      if (await picker.isVisible().catch(() => false)) {
        await humanType(picker, r.x_handle.replace('@', ''));
        await sleep(1500);
        const firstUserCell = page.locator('[role="dialog"] [data-testid^="TypeaheadUser"]').first();
        if (await firstUserCell.count() > 0) {
          await firstUserCell.click();
          await sleep(800);
        }
        const nextBtn = page.locator('[data-testid="nextButton"]');
        if (await nextBtn.count() > 0) {
          await nextBtn.first().click();
          await sleep(1500);
        }
      }
    }

    // Multi-selector fallback for compose box (X testids drift).
    const composeSelectors = [
      '[data-testid="dmComposerTextInput"]',
      'div[contenteditable="true"][aria-label*="message" i]',
      'div[contenteditable="true"][data-testid*="dm" i]',
      'div[role="textbox"][contenteditable="true"]',
    ];
    let composeBox;
    for (const sel of composeSelectors) {
      const loc = page.locator(sel).first();
      try {
        await loc.waitFor({ state: 'visible', timeout: 5000 });
        composeBox = loc;
        break;
      } catch {}
    }
    if (!composeBox) throw new Error('compose input not found — X UI selector outdated');

    await humanType(composeBox, body);
    await sleep(1500);

    // Strategy: try keyboard Enter first (X default behavior); fallback to button selectors.
    let didSend = false;
    try {
      await composeBox.focus();
      await page.keyboard.press('Enter');
      await sleep(2500);
      // Verify send: compose box should be empty or new message appears.
      const stillHasText = await composeBox.evaluate((el) => (el.textContent || '').trim().length).catch(() => 0);
      if (!stillHasText) didSend = true;
    } catch {}

    if (!didSend) {
      const sendSelectors = [
        '[data-testid="dmComposerSendButton"]',
        '[aria-label="Send" i]',
        'button[aria-label*="Send" i]',
        'div[role="button"][data-testid*="Send" i]',
        'div[role="button"][aria-label*="Send" i]',
        '[data-testid*="send" i][role="button"]',
      ];
      let sendBtn;
      for (const sel of sendSelectors) {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
          sendBtn = loc;
          break;
        }
      }
      if (!sendBtn) throw new Error('send button not found and Enter did not send — X UI selector outdated');
      await sendBtn.click();
      await sleep(2500);
    }

    log({ channel: 'x-dm', recipient: r.x_handle, template: templateName, status: 'sent' });
    sent++;
    console.log(`  ✓ sent (${sent}/${DAILY_CAP})`);
  } catch (e) {
    console.error(`  ✗ ${e.message.slice(0, 200)}`);
    log({ channel: 'x-dm', recipient: r.x_handle, template: templateName, status: 'error', error: e.message.slice(0, 200) });
  }

  if (sent < DAILY_CAP) await delay(60, 180);
}

console.log(`\nDone. ${sent} DMs sent today.`);
await closeBrowser(ctx);
