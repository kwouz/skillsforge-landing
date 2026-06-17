// Send a launch blast to Resend Audience (SkillsForge waitlist + buyers).
//
// Usage:  node scripts/outreach/email-resend-blast.mjs --template welcome-launch
//
// Iterates contacts in the audience via RESEND_LIST_ALL_CONTACTS, sends individual emails.

import { call } from '../composio-runner.mjs';
import { delay } from './pacing.mjs';
import { log, countToday } from './log.mjs';
import { render } from './templates.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return acc;
}, []));

const TEMPLATE = args['template'] || 'welcome-launch';
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || 'e6b4e158-e1a8-43b0-8eda-13d606826f52';
const FROM = process.env.RESEND_FROM_EMAIL || 'hello@pitchinsixty.com';
const DAILY_CAP = parseInt(args['daily-cap']) || 500;

console.log(`Audience: ${AUDIENCE_ID}, template: ${TEMPLATE}, from: ${FROM}`);

const list = await call('RESEND_LIST_ALL_CONTACTS', { audience_id: AUDIENCE_ID });
const contacts = list.data || list.contacts || [];
console.log(`Loaded ${contacts.length} contacts`);

const sentToday = countToday('email-resend');
let sent = sentToday;

for (const c of contacts) {
  if (sent >= DAILY_CAP) break;
  if (c.unsubscribed) continue;
  const email = c.email;
  const name = c.first_name || c.firstName || c.name?.split(' ')[0] || 'there';
  const { subject, body } = render(TEMPLATE, { name });
  try {
    await call('RESEND_SEND_EMAIL', {
      from: FROM,
      to: email,
      subject,
      text: body,
    });
    log({ channel: 'email-resend', recipient: email, template: TEMPLATE, status: 'sent' });
    sent++;
    console.log(`  ✓ ${email} (${sent}/${contacts.length})`);
  } catch (e) {
    log({ channel: 'email-resend', recipient: email, template: TEMPLATE, status: 'error', error: e.message.slice(0, 200) });
    console.error(`  ✗ ${email}: ${e.message.slice(0, 120)}`);
  }
  await delay(2, 6); // resend has 10/s rate limit, stay well under
}

console.log(`\nDone. ${sent} emails sent.`);
