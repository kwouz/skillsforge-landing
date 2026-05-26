#!/usr/bin/env node
/**
 * Google Search Console setup + sitemap submission via Playwright.
 *
 * What it does:
 *   1. Launches a HEADED Chromium so you log into your Google account once.
 *   2. Opens GSC for the property and (optionally) adds it if missing.
 *   3. Submits the sitemap-index.xml URL.
 *   4. Triggers "Request indexing" via URL Inspection for every URL in the sitemap.
 *   5. Verifies that AI Overviews / generative crawlers are unblocked
 *      by inspecting public/robots.txt rules from the live site.
 *
 * Why headed: Google blocks automated headless logins. You log in once, the
 * script does the boring clicks. Session is reused on next runs via storage state.
 *
 * Usage:
 *   cd landing
 *   PWDEBUG=0 node scripts/seo/gsc-setup.mjs
 *
 * Env (optional):
 *   SITE_URL=https://skillsforge.pitchinsixty.com   # property URL prefix
 *   STORAGE_STATE=./.playwright/gsc-state.json      # auth cache path
 *
 * First run: you will be prompted to log in inside the browser. Then re-run
 * the script — it picks up the saved session and skips login.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const SITE_URL = process.env.SITE_URL || 'https://skillsforge.pitchinsixty.com';
const SITEMAP_INDEX = `${SITE_URL}/sitemap-index.xml`;
const STORAGE_STATE =
  process.env.STORAGE_STATE || join(ROOT, '.playwright', 'gsc-state.json');

mkdirSync(dirname(STORAGE_STATE), { recursive: true });

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
  // If we land on accounts.google.com → user must sign in.
  if (/accounts\.google\.com/.test(page.url())) {
    log('-----------------------------------------------------------');
    log('Please sign into your Google account in the open browser.');
    log('After GSC is fully loaded, return to this terminal and press ENTER.');
    log('-----------------------------------------------------------');
    await new Promise((r) => process.stdin.once('data', r));
  }
}

async function selectOrAddProperty(page) {
  log(`Selecting property for ${SITE_URL}…`);
  // Try direct deep-link first (faster, no UI fishing).
  const resourceId = encodeURIComponent(SITE_URL);
  await page.goto(
    `https://search.google.com/search-console?resource_id=${resourceId}`,
    { waitUntil: 'domcontentloaded', timeout: 60_000 }
  );
  await page.waitForTimeout(2500);

  const url = page.url();
  if (!url.includes('resource_id=')) {
    log('Property not yet added. Opening "Add property" flow.');
    log('Please add the property manually in the open browser (URL-prefix,');
    log('verify via DNS TXT or HTML tag). Press ENTER once the property');
    log('appears as Verified in GSC.');
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
  await page.waitForTimeout(2000);

  // GSC sitemap input — accepts the relative path; "sitemap-index.xml" is enough.
  const sitemapInputSelectors = [
    'input[aria-label*="sitemap" i]',
    'input[placeholder*="sitemap" i]',
    'input[type="text"]',
  ];

  let added = false;
  for (const sel of sitemapInputSelectors) {
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
    log('Could not auto-locate sitemap input.');
    log('Please paste "sitemap-index.xml" into the GSC sitemap field manually.');
    log('Press ENTER once the sitemap shows as Submitted.');
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
    await page.waitForTimeout(4000);

    // "Request indexing" button — text varies by locale.
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
  log('Storage state:', STORAGE_STATE);

  const robotsOk = await verifyRobots();
  if (!robotsOk) log('Robots check failed but continuing — fix before next run.');

  const urls = await fetchSitemapUrls();
  if (!urls.length) {
    log('No URLs discovered in sitemap. Aborting.');
    process.exit(1);
  }
  log('Discovered URLs:', urls);

  // Save a snapshot for audit trail.
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

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({
    viewport: null,
    storageState: existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined,
  });
  const page = await context.newPage();

  try {
    await ensureLogin(page);
    await context.storageState({ path: STORAGE_STATE });

    await selectOrAddProperty(page);
    await submitSitemap(page);
    await requestIndexing(page, urls);

    log('All done. Saving session for next run.');
    await context.storageState({ path: STORAGE_STATE });
  } catch (err) {
    log('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    log('Keeping browser open for 10 s — review GSC then it will close.');
    await page.waitForTimeout(10_000);
    await browser.close();
  }
}

main();
