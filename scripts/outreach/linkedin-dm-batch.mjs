// Cold LinkedIn DM batch via Playwright.
//
// Usage:  node scripts/outreach/linkedin-dm-batch.mjs [--daily-cap 5]
//
// LinkedIn is the most aggressive about automation detection.
// Lower cap (5/day) + longer pacing (90-240s).

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

const DAILY_CAP = parseInt(args['daily-cap']) || 5;
const CSV_PATH = args['csv'] || resolve(__dirname, 'recipients.csv');

const recipients = parseCsv(CSV_PATH).filter((r) => r.linkedin_url && r.linkedin_url.includes('linkedin.com/in/'));
console.log(`Loaded ${recipients.length} LinkedIn recipients`);

const sentToday = countToday('linkedin-dm');
console.log(`Already sent today: ${sentToday}/${DAILY_CAP}`);
if (sentToday >= DAILY_CAP) {
  console.log('Daily cap reached.');
  process.exit(0);
}

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();

let sent = sentToday;
for (const r of recipients) {
  if (sent >= DAILY_CAP) break;
  if (alreadyContacted('linkedin-dm', r.linkedin_url)) {
    console.log(`  skip ${r.name} (contacted)`);
    continue;
  }

  const templateName = `cold-${r.tier === 'agency' ? 'agency-2' : r.tier === 'inhouse' ? 'inhouse-3' : 'solo-1'}`;
  const { body } = render(templateName, { name: r.name.split(' ')[0], note: r.personal_note || '' });

  console.log(`→ LinkedIn DM ${r.name}`);

  try {
    await page.goto(r.linkedin_url);
    await sleep(4000);

    if (page.url().includes('/login') || page.url().includes('authwall')) {
      console.error('  ✗ login required');
      log({ channel: 'linkedin-dm', recipient: r.linkedin_url, template: templateName, status: 'error', error: 'login required' });
      break;
    }

    // Click "Message" button on profile
    const msgBtn = page.getByRole('button', { name: /^Message/ }).first();
    await msgBtn.waitFor({ state: 'visible', timeout: 10000 });
    await msgBtn.click();
    await sleep(2500);

    // Find chat textarea (LinkedIn changes class names frequently — use role)
    const textbox = page.locator('div[role="textbox"][contenteditable="true"]').first();
    await textbox.waitFor({ state: 'visible', timeout: 8000 });
    await textbox.click();
    await humanType(textbox, body);
    await sleep(1500);

    const sendBtn = page.getByRole('button', { name: /Send/i }).last();
    await sendBtn.click();
    await sleep(3000);

    log({ channel: 'linkedin-dm', recipient: r.linkedin_url, template: templateName, status: 'sent' });
    sent++;
    console.log(`  ✓ sent (${sent}/${DAILY_CAP})`);
  } catch (e) {
    console.error(`  ✗ ${e.message.slice(0, 200)}`);
    log({ channel: 'linkedin-dm', recipient: r.linkedin_url, template: templateName, status: 'error', error: e.message.slice(0, 200) });
  }

  if (sent < DAILY_CAP) await delay(90, 240);
}

console.log(`\nDone. ${sent} LinkedIn DMs sent today.`);
await closeBrowser(ctx);
