import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('home loads with key sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SkillsForge/i);
    await expect(page.locator('h1')).toContainText(/SEO|GEO|Claude/i);
    await expect(page.getByRole('button', { name: /Get Starter Pack/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Get Pro Updates/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Get Team License/i })).toBeVisible();
  });

  test('security headers are present', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain('form-action');
    expect(headers['content-security-policy']).toContain('gumroad.com');
    expect(headers['content-security-policy']).not.toContain('stripe.com');
  });

  test('og-image meta tag resolves to a real image', async ({ page, request }) => {
    await page.goto('/');
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();
    const res = await request.get(ogImage!);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('image');
  });
});

test.describe('Checkout API', () => {
  for (const tier of ['starter', 'pro', 'team'] as const) {
    test(`${tier} → returns Gumroad URL`, async ({ request }) => {
      const res = await request.post('/api/checkout', { data: { tier } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.configured).toBe(true);
      expect(body.url).toMatch(/^https:\/\/.+gumroad\.com\/l\/.+/);
    });
  }

  test('invalid tier rejected with 400', async ({ request }) => {
    const res = await request.post('/api/checkout', { data: { tier: 'hacker' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test('oversized body rejected with 413', async ({ request }) => {
    const huge = { tier: 'starter', junk: 'x'.repeat(5000) };
    const res = await request.post('/api/checkout', { data: huge });
    expect(res.status()).toBe(413);
  });
});

test.describe('Pricing CTAs', () => {
  for (const button of ['Get Starter Pack', 'Get Pro Updates', 'Get Team License']) {
    test(`"${button}" triggers redirect to Gumroad`, async ({ page }) => {
      await page.goto('/#pricing');
      // The page POSTs to /api/checkout then sets window.location.href.
      // We intercept the navigation and assert the target host.
      const navigationPromise = page.waitForURL(/gumroad\.com/, { timeout: 15_000 });
      await page.getByRole('button', { name: new RegExp(button, 'i') }).click();
      await navigationPromise;
      expect(page.url()).toMatch(/gumroad\.com\/l\/skillsforge-/);
    });
  }
});

test.describe('Free-skill flow', () => {
  test('renders the email form', async ({ page }) => {
    await page.goto('/free-skill');
    await expect(page.getByLabel(/Your email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Send me the free skill/i })).toBeVisible();
  });

  test('rejects malformed email at the API layer', async ({ request }) => {
    const res = await request.post('/api/free-skill', { data: { email: 'not-an-email' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('rate-limit kicks in on rapid retries', async ({ request }) => {
    // Sequential so the requests stick to one Vercel serverless instance
    // — the in-memory limiter is per-instance, parallel requests can hit
    // different cold starts and the test becomes flaky.
    const stamp = Date.now();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.post('/api/free-skill', {
        data: { email: `rl${i}+${stamp}@example.com` },
      });
      codes.push(res.status());
    }
    expect(codes, `Expected at least one 429 in ${JSON.stringify(codes)}`)
      .toContain(429);
  });
});

test.describe('A11y interactions', () => {
  test('FAQ accordion toggles aria-expanded', async ({ page }) => {
    await page.goto('/#faq');
    const firstFaqBtn = page.locator('.faq-btn').first();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false');
    await firstFaqBtn.click();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');
    await firstFaqBtn.click();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('free-skill status has aria-live for SR announcements', async ({ page }) => {
    await page.goto('/free-skill');
    const status = page.locator('#form-status');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('Static routes', () => {
  for (const path of ['/success', '/cancel', '/free-skill']) {
    test(`${path} returns 200`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.ok()).toBe(true);
    });
  }
});

test.describe('Visual regression', () => {
  test('homepage screenshot above the fold', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home-above-fold.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('pricing section screenshot', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForLoadState('networkidle');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#pricing')).toHaveScreenshot('pricing-section.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
