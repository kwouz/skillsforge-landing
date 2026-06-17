// First-run script: launch Chromium with persistent profile.
// User signs into X, LinkedIn, Gmail manually; cookies persist for automation.
//
// Usage:  node scripts/outreach/browser-login.mjs
//
// Wait for the browser to open. Sign into each service. Close the window when done.

import { openBrowser } from './browser-context.mjs';

const ctx = await openBrowser({ headless: false });
const page = await ctx.newPage();

await page.goto('https://x.com/login');
console.log('Sign into X, then open new tabs for:');
console.log('  https://linkedin.com/login');
console.log('  https://mail.google.com');
console.log('Close the browser window when done. Cookies are saved automatically.');

// Wait until user closes the context.
await new Promise((resolve) => ctx.on('close', resolve));
console.log('Browser closed. Profile saved.');
