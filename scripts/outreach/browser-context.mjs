import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROFILE_DIR = process.env.SF_CHROME_PROFILE || join(homedir(), '.skillsforge-chrome');

if (!existsSync(PROFILE_DIR)) {
  mkdirSync(PROFILE_DIR, { recursive: true });
  console.log('Created Chrome profile dir at', PROFILE_DIR);
}

export async function openBrowser({ headless = false, viewport = { width: 1400, height: 900 } } = {}) {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--lang=en-US',
    ],
    env: {
      ...process.env,
      LANG: 'en_US.UTF-8',
      LANGUAGE: 'en_US:en',
      LC_ALL: 'en_US.UTF-8',
    },
  });
  return context;
}

export async function closeBrowser(context) {
  try { await context.close(); } catch {}
}
