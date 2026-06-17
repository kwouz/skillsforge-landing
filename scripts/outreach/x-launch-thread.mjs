// Post Day 0 launch thread to X (Twitter).
//
// Usage:  node scripts/outreach/x-launch-thread.mjs
//
// Reads thread content from marketing/copy.md (X-thread section) or built-in fallback.

import { openBrowser, closeBrowser } from './browser-context.mjs';
import { delay, humanType, sleep } from './pacing.mjs';
import { log } from './log.mjs';

const THREAD = [
  `Shipped today: SkillsForge.

11 production Claude Code skills for SEO/GEO/AEO.

If you do SEO work in Claude Code or Cursor, this might save you 4-8h/week.

$49 lifetime. 30-day refund.

https://skillsforge.pitchinsixty.com 🧵`,

  `The problem:

AI Overviews now appear on ~48% of Google queries. Client traffic tanked 30-60%. They're asking what you're doing about it.

Your current workflow: 3 paid tools + a folder of ad-hoc prompts + a GitHub repo someone bookmarked last year.`,

  `What's broken:

Every "free SEO skill repo" is a collection. You load one skill, get an output, manually decide next step.

Fine for experiments. Not fine when you bill $5-15k/mo and need to ship audits consistently.`,

  `SkillsForge is different:

11 skills that know about each other. One prompt — "optimize this cluster for GEO" — runs the whole chain.

keyword-cluster-mapper → content-brief-builder → seo-pseo-generator → schema-markup-engineer → technical-seo-auditor`,

  `The 11 skills:

1. seo-pseo-generator
2. geo-aeo-optimizer
3. schema-markup-engineer
4. content-brief-builder
5. technical-seo-auditor
6. keyword-cluster-mapper
7. internal-linking-architect
8. ai-mentions-monitor
9. backlink-outreach-engine
10. gbp-local-seo
11. (free teaser) seo-meta-generator`,

  `Pricing:

Starter — $49 lifetime, all 11 skills
Pro — $14/mo, monthly skill drops + Discord community + priority support
Team — $199/yr, 5 seats + onboarding call

30-day no-questions refund on everything.`,

  `Who it's for:

- Solo SEO consultants using Claude Code or Cursor as primary tool
- Small agencies wanting standardized AI workflows across the team
- In-house growth/SEO leads doing more with less

If you're not in one of those — probably not for you.`,

  `Free taste:

The seo-meta-generator skill is open-source — no signup, just clone:

https://github.com/kwouz/skillsforge-free

If you find it useful, the full pack is one click away.`,

  `Community + roadmap:

Discord (real humans, not Discord-bots): https://discord.gg/jevtge9Npk

I'm shipping new skills monthly for Pro members. Roadmap is community-driven.

Try it. Tell me what's broken.

https://skillsforge.pitchinsixty.com`,
];

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();

await page.goto('https://x.com/compose/post');
await sleep(3000);

if (page.url().includes('/login')) {
  console.error('Login required — run browser-login.mjs first');
  log({ channel: 'x-thread', recipient: 'self', status: 'error', error: 'login required' });
  await closeBrowser(ctx);
  process.exit(1);
}

console.log(`Posting thread of ${THREAD.length} tweets...`);

const firstBox = page.locator('[data-testid="tweetTextarea_0"]').first();
await firstBox.waitFor({ state: 'visible', timeout: 15000 });
await firstBox.click();
await humanType(firstBox, THREAD[0]);

for (let i = 1; i < THREAD.length; i++) {
  await sleep(1200);
  const addBtn = page.locator('[data-testid="addButton"]').last();
  await addBtn.click();
  await sleep(800);
  const box = page.locator(`[data-testid="tweetTextarea_${i}"]`);
  await box.waitFor({ state: 'visible', timeout: 8000 });
  await humanType(box, THREAD[i]);
  console.log(`  ✓ tweet ${i + 1}/${THREAD.length} typed`);
}

console.log('\n⚠️  Thread typed. Review the draft in browser, then click "Post all" yourself.');
console.log('Or auto-post: pass --auto-send flag (NOT default for safety).');

if (process.argv.includes('--auto-send')) {
  await sleep(3000);
  const sendBtn = page.locator('[data-testid="tweetButton"]');
  await sendBtn.click();
  await sleep(4000);
  log({ channel: 'x-thread', recipient: 'self', template: 'launch-thread', status: 'sent' });
  console.log('✓ Thread posted.');
} else {
  log({ channel: 'x-thread', recipient: 'self', template: 'launch-thread', status: 'drafted' });
}

// Don't close — let user review.
console.log('Browser left open. Close it when done.');
