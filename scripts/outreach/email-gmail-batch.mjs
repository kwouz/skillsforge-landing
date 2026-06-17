// Cold email batch via Composio Gmail.
// NOTE: requires GMAIL toolkit auth in Composio. If gmail isn't connected yet:
//   1. https://app.composio.dev → Apps → Gmail → Connect (OAuth flow)
//   2. Re-run this script
//
// Usage:  node scripts/outreach/email-gmail-batch.mjs [--daily-cap 15] [--csv recipients.csv]

import { call } from '../composio-runner.mjs';
import { delay, sleep } from './pacing.mjs';
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

const DAILY_CAP = parseInt(args['daily-cap']) || 15;
const CSV_PATH = args['csv'] || resolve(__dirname, 'recipients.csv');

const recipients = parseCsv(CSV_PATH).filter((r) => r.email && r.email.includes('@'));
console.log(`Loaded ${recipients.length} email recipients`);

const sentToday = countToday('email-gmail');
console.log(`Already sent today: ${sentToday}/${DAILY_CAP}`);
if (sentToday >= DAILY_CAP) {
  console.log('Daily cap reached.');
  process.exit(0);
}

let sent = sentToday;
for (const r of recipients) {
  if (sent >= DAILY_CAP) break;
  if (alreadyContacted('email-gmail', r.email)) {
    console.log(`  skip ${r.email}`);
    continue;
  }

  const templateName = r.relationship === 'warm' ? 'warm-pitch' :
    `cold-${r.tier === 'agency' ? 'agency-2' : r.tier === 'inhouse' ? 'inhouse-3' : 'solo-1'}`;
  const { subject, body } = render(templateName, {
    name: r.name.split(' ')[0],
    note: r.personal_note || '',
    company: r.company || '',
  });

  console.log(`→ Gmail ${r.email} (${templateName})`);

  try {
    const result = await call('GMAIL_SEND_EMAIL', {
      recipient_email: r.email,
      subject: subject || 'Built something — would love your take',
      body,
    });
    log({ channel: 'email-gmail', recipient: r.email, template: templateName, status: 'sent' });
    sent++;
    console.log(`  ✓ sent (${sent}/${DAILY_CAP}), id=${result?.id || result?.messageId || '?'}`);
  } catch (e) {
    console.error(`  ✗ ${e.message.slice(0, 200)}`);
    log({ channel: 'email-gmail', recipient: r.email, template: templateName, status: 'error', error: e.message.slice(0, 200) });
  }

  if (sent < DAILY_CAP) await delay(15, 45); // emails — faster pacing OK
}

console.log(`\nDone. ${sent} emails sent today.`);
