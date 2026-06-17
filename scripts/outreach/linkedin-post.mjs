// Post Day 0 launch announcement to LinkedIn.
//
// Usage:  node scripts/outreach/linkedin-post.mjs [--auto-send]

import { openBrowser, closeBrowser } from './browser-context.mjs';
import { humanType, sleep } from './pacing.mjs';
import { log } from './log.mjs';

const POST = `Shipped today: SkillsForge.

11 production Claude Code skills for the modern SEO/GEO/AEO pipeline.

If you're a solo SEO consultant or run a small agency using Claude Code or Cursor as your primary tool — this saves 4-8 hours/week of repetitive work.

The 11 skills:
→ keyword-cluster-mapper
→ content-brief-builder
→ seo-pseo-generator
→ geo-aeo-optimizer
→ schema-markup-engineer
→ technical-seo-auditor
→ internal-linking-architect
→ ai-mentions-monitor
→ backlink-outreach-engine
→ gbp-local-seo
→ free seo-meta-generator (open source teaser)

Why a pipeline, not a list:

Every "free SEO skill repo" is a collection. You load one skill, get output, manually decide next step. That's fine for experiments. It's not fine when you bill $5-15k/month and need to ship audits consistently.

SkillsForge skills know about each other. One prompt — "optimize this cluster for GEO" — runs the whole chain.

Pricing:
• Starter — $49 lifetime
• Pro — $14/mo (monthly drops + Discord)
• Team — $199/yr (5 seats + onboarding)

30-day no-questions refund.

Live: https://skillsforge.pitchinsixty.com
Free skill: https://github.com/kwouz/skillsforge-free
Discord: https://discord.gg/jevtge9Npk

What's broken in your current SEO workflow? Drop a comment — building the roadmap from real pain.

#SEO #GEO #AEO #ClaudeCode #AISEO`;

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();

await page.goto('https://www.linkedin.com/feed/');
await sleep(4000);

if (page.url().includes('/login') || page.url().includes('authwall')) {
  console.error('Login required — run browser-login.mjs first');
  log({ channel: 'linkedin-post', recipient: 'self', status: 'error', error: 'login required' });
  await closeBrowser(ctx);
  process.exit(1);
}

// Open "Start a post" composer
const startBtn = page.getByRole('button', { name: /Start a post/i }).first();
await startBtn.click();
await sleep(2500);

const textbox = page.locator('div[role="textbox"][contenteditable="true"]').first();
await textbox.waitFor({ state: 'visible', timeout: 10000 });
await textbox.click();
await humanType(textbox, POST);
await sleep(2000);

console.log('Draft typed. Review in browser.');

if (process.argv.includes('--auto-send')) {
  const sendBtn = page.getByRole('button', { name: /^Post$/ }).first();
  await sendBtn.click();
  await sleep(4000);
  log({ channel: 'linkedin-post', recipient: 'self', template: 'launch-post', status: 'sent' });
  console.log('✓ Posted.');
} else {
  log({ channel: 'linkedin-post', recipient: 'self', template: 'launch-post', status: 'drafted' });
  console.log('Manual review mode. Click Post yourself.');
}
