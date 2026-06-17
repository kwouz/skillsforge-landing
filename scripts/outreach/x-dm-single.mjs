// Single targeted X DM (для влиятелей: Aleyda, Lily, Cyrus).
//
// Usage:  node scripts/outreach/x-dm-single.mjs --to @aleyda --template aleyda-pitch

import { openBrowser, closeBrowser } from './browser-context.mjs';
import { humanType, sleep } from './pacing.mjs';
import { log } from './log.mjs';
import { render } from './templates.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return acc;
}, []));

const TO = args.to;
const TEMPLATE = args.template || 'aleyda-pitch';

if (!TO) {
  console.error('Usage: --to @handle [--template name]');
  process.exit(1);
}

const handle = TO.replace('@', '');
const { body } = render(TEMPLATE, { name: handle });

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();
await page.goto(`https://x.com/messages/compose?recipient=${handle}`);
await sleep(3000);

if (page.url().includes('/login')) {
  console.error('Login required');
  log({ channel: 'x-dm', recipient: '@' + handle, status: 'error', error: 'login required' });
  await closeBrowser(ctx);
  process.exit(1);
}

const box = page.locator('[data-testid="dmComposerTextInput"]');
await box.waitFor({ state: 'visible', timeout: 15000 });
await humanType(box, body);
await sleep(2000);

console.log('Drafted. Review the DM in browser.');

if (process.argv.includes('--auto-send')) {
  const send = page.locator('[data-testid="dmComposerSendButton"]');
  await send.click();
  await sleep(3000);
  log({ channel: 'x-dm', recipient: '@' + handle, template: TEMPLATE, status: 'sent' });
  console.log('✓ sent');
  await closeBrowser(ctx);
} else {
  log({ channel: 'x-dm', recipient: '@' + handle, template: TEMPLATE, status: 'drafted' });
  console.log('Manual review mode. Send yourself.');
}
