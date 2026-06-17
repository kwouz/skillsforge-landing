// Daily build-in-public stat post to X.
// Reads Stripe revenue via Composio, composes tweet, posts via Playwright.
//
// Usage:  node scripts/outreach/x-stat-post.mjs [--auto-send]

import { call } from '../composio-runner.mjs';
import { openBrowser, closeBrowser } from './browser-context.mjs';
import { humanType, sleep } from './pacing.mjs';
import { log } from './log.mjs';

// Pull active customers count
let stat = '';
try {
  const customers = await call('STRIPE_LIST_CUSTOMERS', { limit: 100 });
  const count = customers.data?.length || 0;
  const charges = await call('STRIPE_LIST_CHARGES', { limit: 100 });
  const totalCents = (charges.data || []).reduce((s, c) => s + (c.paid ? c.amount : 0), 0);
  const revenue = (totalCents / 100).toFixed(0);
  stat = `Day ${dayNum()} of SkillsForge:

→ ${count} paying customers
→ $${revenue} cumulative revenue
→ Discord: ${process.env.DISCORD_MEMBERS || '?'} members

Today's win: ${process.env.STAT_NOTE || 'shipping is the win'}

https://skillsforge.pitchinsixty.com`;
} catch (e) {
  console.error('Stripe pull failed:', e.message);
  stat = `Day ${dayNum()} of SkillsForge — shipping continues.

https://skillsforge.pitchinsixty.com`;
}

console.log('Tweet:\n', stat);

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();
await page.goto('https://x.com/compose/post');
await sleep(3000);

if (page.url().includes('/login')) {
  console.error('Login required');
  log({ channel: 'x-stat', recipient: 'self', status: 'error', error: 'login required' });
  await closeBrowser(ctx);
  process.exit(1);
}

const box = page.locator('[data-testid="tweetTextarea_0"]').first();
await box.waitFor({ state: 'visible', timeout: 10000 });
await box.click();
await humanType(box, stat);

if (process.argv.includes('--auto-send')) {
  await sleep(2000);
  const btn = page.locator('[data-testid="tweetButton"]');
  await btn.click();
  await sleep(4000);
  log({ channel: 'x-stat', recipient: 'self', template: 'daily-stat', status: 'sent' });
  console.log('✓ posted');
  await closeBrowser(ctx);
} else {
  log({ channel: 'x-stat', recipient: 'self', template: 'daily-stat', status: 'drafted' });
  console.log('Drafted. Review + post manually.');
}

function dayNum() {
  const launch = new Date('2026-06-15'); // adjust to real launch date
  const now = new Date();
  const days = Math.floor((now - launch) / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : `T${days}`;
}
