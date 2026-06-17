#!/usr/bin/env node
/**
 * Google Search Console setup + sitemap submission via Playwright.
 *
 * Uses launchPersistentContext + system Chrome channel + automation-flag
 * scrubbing so Google's "this browser is not secure" gate does not trip.
 *
 * What it does:
 *   1. Launches HEADED Chrome with a real user profile dir (persistent
 *      cookies, no AutomationControlled flag).
 *   2. Opens Google Search Console — you log in once, profile is kept.
 *   3. Selects the property; if missing, you add it manually then ENTER.
 *   4. Submits sitemap-index.xml.
 *   5. Calls URL Inspection + clicks "Request indexing" per URL.
 *   6. Pings Bing IndexNow in parallel.
 *
 * Usage:
 *   cd landing
 *   node scripts/seo/gsc-setup.mjs
 *
 * Env (optional):
 *   SITE_URL=https://skillsforge.pitchinsixty.com   # property URL prefix
 *   CHROME_PROFILE=./.playwright/chrome-profile     # persistent user data dir
 *   CHROME_CHANNEL=chrome                           # chrome | chrome-beta | msedge | chromium
 *
 * On Google's "browser not secure" error:
 *   - Make sure you launched THIS script (not bundled Chromium).
 *   - Close every Chrome window before running (profile is exclusive).
 *   - Re-run; the script reuses the saved profile so logins persist.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { existsSync, writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const SITE_URL = process.env.SITE_URL || 'https://skillsforge.pitchinsixty.com';
const SITEMAP_INDEX = `${SITE_URL}/sitemap-index.xml`;
const CHROME_PROFILE =
  process.env.CHROME_PROFILE || join(ROOT, '.playwright', 'chrome-profile');
const CHROME_CHANNEL = process.env.CHROME_CHANNEL || 'chrome';

mkdirSync(CHROME_PROFILE, { recursive: true });

function log(...args) {
  // eslint-disable-next-line no-console
  console.log('[gsc]', ...args);
}

async function fetchSitemapUrls() {
  log('Fetching sitemap from', SITEMAP_INDEX);
  const res = await fetch(SITEMAP_INDEX);
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const childMatch = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const u of childMatch) {
    if (u.endsWith('.xml')) {
      const sub = await fetch(u);
      if (sub.ok) {
        const subXml = await sub.text();
        urls.push(...[...subXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
      }
    } else {
      urls.push(u);
    }
  }
  return [...new Set(urls)];
}

async function verifyRobots() {
  log('Verifying robots.txt rules…');
  const res = await fetch(`${SITE_URL}/robots.txt`);
  if (!res.ok) {
    log('FAIL: robots.txt not reachable (HTTP', res.status, ')');
    return false;
  }
  const txt = await res.text();
  const bots = [
    'GPTBot',
    'ClaudeBot',
    'PerplexityBot',
    'Google-Extended',
    'CCBot',
  ];
  const missing = bots.filter((b) => !txt.includes(`User-agent: ${b}`));
  if (missing.length) {
    log('robots.txt is missing rules for:', missing.join(', '));
    return false;
  }
  if (!txt.includes('Sitemap:')) {
    log('robots.txt is missing a Sitemap: directive');
    return false;
  }
  log('robots.txt OK ✓');
  return true;
}

async function pingBingIndexNow(urls) {
  log('Pinging Bing IndexNow for', urls.length, 'URLs…');
  try {
    const host = new URL(SITE_URL).host;
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, urlList: urls }),
    });
    log('IndexNow response:', res.status, res.statusText);
    if (res.status === 400) log('  (Bing needs a key file at /<key>.txt — optional)');
  } catch (e) {
    log('IndexNow ping failed:', e.message);
  }
}

async function ensureLogin(page) {
  log('Opening Google Search Console…');
  await page.goto('https://search.google.com/search-console', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  if (/accounts\.google\.com/.test(page.url())) {
    log('-----------------------------------------------------------');
    log('Sign into your Google account in the open Chrome window.');
    log('After GSC is fully loaded, return to this terminal and press ENTER.');
    log('-----------------------------------------------------------');
    await new Promise((r) => process.stdin.once('data', r));
  }
}

async function selectOrAddProperty(page) {
  log(`Selecting property for ${SITE_URL}…`);
  const resourceId = encodeURIComponent(SITE_URL);
  await page.goto(
    `https://search.google.com/search-console?resource_id=${resourceId}`,
    { waitUntil: 'domcontentloaded', timeout: 60_000 }
  );
  await page.waitForTimeout(2500);

  const url = page.url();
  if (!url.includes('resource_id=')) {
    log('Property not yet added. Add it now (URL-prefix, verify via DNS TXT or');
    log('HTML tag). When the property shows as Verified in GSC, press ENTER.');
    await new Promise((r) => process.stdin.once('data', r));
    await page.goto(
      `https://search.google.com/search-console?resource_id=${resourceId}`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
  }
}

async function submitSitemap(page) {
  log('Submitting sitemap…');
  const resourceId = encodeURIComponent(SITE_URL);
  await page.goto(
    `https://search.google.com/search-console/sitemaps?resource_id=${resourceId}`,
    { waitUntil: 'domcontentloaded', timeout: 60_000 }
  );
  await page.waitForTimeout(2500);

  const inputSelectors = [
    'input[aria-label*="sitemap" i]',
    'input[placeholder*="sitemap" i]',
    'input[type="text"]',
  ];

  let added = false;
  for (const sel of inputSelectors) {
    try {
      const input = await page.waitForSelector(sel, { timeout: 5000 });
      if (!input) continue;
      await input.fill('sitemap-index.xml');
      await page.keyboard.press('Enter');
      added = true;
      log('Sitemap submitted via selector', sel);
      break;
    } catch {
      // try next selector
    }
  }

  if (!added) {
    log('Could not auto-locate sitemap input. Paste "sitemap-index.xml"');
    log('into the Sitemaps field manually, then press ENTER.');
    await new Promise((r) => process.stdin.once('data', r));
  } else {
    await page.waitForTimeout(3000);
  }
}

async function requestIndexing(page, urls) {
  log('Requesting indexing for', urls.length, 'URLs (URL Inspection tool)…');
  const resourceId = encodeURIComponent(SITE_URL);
  for (const url of urls) {
    log('  Inspect:', url);
    await page.goto(
      `https://search.google.com/search-console/inspect?resource_id=${resourceId}&id=${encodeURIComponent(url)}`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await page.waitForTimeout(4500);

    const candidates = [
      'button:has-text("Request indexing")',
      'button:has-text("Запросить индексирование")',
      'button:has-text("Indexierung anfordern")',
    ];
    let clicked = false;
    for (const sel of candidates) {
      try {
        const btn = await page.locator(sel).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          clicked = true;
          break;
        }
      } catch {
        /* try next */
      }
    }
    if (clicked) {
      log('    Clicked Request indexing.');
      await page.waitForTimeout(8000);
    } else {
      log('    Button not found — URL may already be queued or interface changed.');
    }
  }
}

async function main() {
  log('Site:', SITE_URL);
  log('Chrome profile:', CHROME_PROFILE);
  log('Chrome channel:', CHROME_CHANNEL);

  const robotsOk = await verifyRobots();
  if (!robotsOk) log('Robots check failed but continuing — fix before next run.');

  const urls = await fetchSitemapUrls();
  if (!urls.length) {
    log('No URLs discovered in sitemap. Aborting.');
    process.exit(1);
  }
  log('Discovered URLs:', urls);

  const snapshotPath = join(ROOT, 'scripts', 'seo', 'last-run.json');
  writeFileSync(
    snapshotPath,
    JSON.stringify(
      { ranAt: new Date().toISOString(), site: SITE_URL, urls, robotsOk },
      null,
      2
    )
  );

  await pingBingIndexNow(urls);

  // Persistent context + system Chrome + automation-flag scrub.
  // Google's "browser not secure" check inspects the AutomationControlled
  // flag and missing window.chrome — both are avoided below.
  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    channel: CHROME_CHANNEL,
    headless: false,
    viewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=BlockCredentialedSubresources',
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
    slowMo: 60,
  });

  // Hide navigator.webdriver before any page script runs.
  await context.addInitScript(() => {
    // @ts-ignore
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => undefined,
      configurable: true,
    });
    // window.chrome stub: real Chrome has this, Playwright wipes it.
    // @ts-ignore
    if (!window.chrome) window.chrome = { runtime: {}, app: {} };
    // Languages stub
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['en-US', 'en'],
    });
    // Plugins stub
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    await ensureLogin(page);
    await selectOrAddProperty(page);
    await submitSitemap(page);
    await requestIndexing(page, urls);

    log('All done. Chrome profile persisted at', CHROME_PROFILE);
  } catch (err) {
    log('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    log('Keeping window open for 10 s — review GSC then it will close.');
    await page.waitForTimeout(10_000);
    await context.close();
  }
}

main();
