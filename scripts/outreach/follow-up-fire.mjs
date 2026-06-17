// Follow-up fire runner — reads pending-follow-ups.jsonl, fires ones where due_at <= now.
//
// Usage:
//   node landing/scripts/outreach/follow-up-fire.mjs [--dry-run]
//
// Cron (daily at 13:00 local time):
//   0 13 * * * cd /Users/ilya/Desktop/Проекты/ai-agency/workspace/seo-skills-pack && node landing/scripts/outreach/follow-up-fire.mjs
//
// After author fills initial_send_date in pending-follow-ups.jsonl,
// this script calculates due_at = initial_send_date + delay_days (default 4).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { call } from '../composio-runner.mjs';
import { log, alreadyContacted } from './log.mjs';

const PENDING_PATH = process.env.PENDING_FOLLOWUPS ||
  '/Users/ilya/Desktop/Проекты/ai-agency/workspace/seo-skills-pack/outreach/campaign-founder-beta-2026-06-15/pending-follow-ups.jsonl';

const DRY_RUN = process.argv.includes('--dry-run');
const NOW = new Date();

if (!existsSync(PENDING_PATH)) {
  console.log('No pending-follow-ups.jsonl found at', PENDING_PATH);
  process.exit(0);
}

const lines = readFileSync(PENDING_PATH, 'utf8').trim().split('\n').filter(Boolean);
const items = lines.map(l => JSON.parse(l));

let fired = 0;
let skipped = 0;
const updated = [];

for (const item of items) {
  // Skip if initial send hasn't happened yet
  if (!item.initial_send_date || item.initial_send_date.startsWith('TBD')) {
    console.log(`  SKIP ${item.contact_id} — initial_send_date not set yet`);
    updated.push(item);
    skipped++;
    continue;
  }

  // Skip if already completed or archived
  if (item.status === 'sent' || item.status === 'archived' || item.status === 'responded') {
    updated.push(item);
    skipped++;
    continue;
  }

  // Calculate due_at if not set
  const delayDays = item.delay_days || 4;
  let dueAt = item.due_at;
  if (!dueAt || dueAt.startsWith('TBD')) {
    const sendDate = new Date(item.initial_send_date);
    sendDate.setDate(sendDate.getDate() + delayDays);
    dueAt = sendDate.toISOString();
    item.due_at = dueAt;
  }

  if (new Date(dueAt) > NOW) {
    console.log(`  SKIP ${item.contact_id} — due ${dueAt} (not yet)`);
    updated.push(item);
    skipped++;
    continue;
  }

  // Check if already contacted via log
  if (alreadyContacted(item.channel === 'x_dm' ? 'x-dm' : 'linkedin', item.handle)) {
    // Could be from follow-up already sent — need deeper check, skip safely
    console.log(`  SKIP ${item.contact_id} — appears already contacted per outreach-log`);
    item.status = 'possible_duplicate_check_log';
    updated.push(item);
    skipped++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would fire follow-up for ${item.contact_id} (${item.channel} ${item.handle})`);
    console.log(`  Message: ${item.message.slice(0, 120)}...`);
    updated.push(item);
    continue;
  }

  // X DM and LinkedIn: require Playwright (headed browser) — cannot fire from cron without display
  if (item.channel === 'x_dm' || item.channel === 'linkedin') {
    console.log(`  MANUAL REQUIRED: ${item.contact_id} (${item.channel}) — Playwright sends require terminal with display.`);
    console.log(`  Handle: ${item.handle}`);
    console.log(`  Message:\n${item.message}\n`);
    item.status = 'due_needs_manual_send';
    updated.push(item);
    continue;
  }

  // Email follow-up (if channel = email)
  if (item.channel === 'email') {
    try {
      const result = await call('RESEND_SEND_EMAIL', {
        from: 'hello@pitchinsixty.com',
        to: item.handle,
        subject: `Re: SkillsForge`,
        text: item.message,
      });
      log({ channel: 'email-resend', recipient: item.handle, template: 'follow-up-step-' + item.step, status: 'sent' });
      item.status = 'sent';
      item.sent_at = NOW.toISOString();
      console.log(`  SENT email follow-up to ${item.contact_id} (${item.handle})`);
      fired++;
    } catch (e) {
      console.error(`  ERROR sending to ${item.contact_id}: ${e.message.slice(0, 200)}`);
      item.status = 'error';
      item.error = e.message.slice(0, 200);
    }
  }

  updated.push(item);
}

// Write back updated state
writeFileSync(PENDING_PATH, updated.map(i => JSON.stringify(i)).join('\n') + '\n', 'utf8');

console.log(`\nDone. Fired: ${fired}, Skipped/manual: ${skipped}`);
if (DRY_RUN) console.log('(dry-run — no actual sends)');
