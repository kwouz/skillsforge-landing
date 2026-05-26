import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/free-skill', '/success', '/cancel'];

for (const path of pages) {
  test(`a11y: ${path} has no serious / critical violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    if (serious.length > 0) {
      console.log(`[a11y] ${path} found ${serious.length} serious/critical issues:`);
      for (const v of serious) {
        console.log(`  - ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      }
    }

    expect(serious, `Serious/critical a11y violations on ${path}`).toHaveLength(0);
  });
}
