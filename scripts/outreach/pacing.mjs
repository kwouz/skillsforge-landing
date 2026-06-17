// Human-like pacing helpers to reduce automation-detection signals.

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Random delay between actions (60-180s default).
export async function delay(minSec = 60, maxSec = 180) {
  const ms = rand(minSec * 1000, maxSec * 1000);
  console.log(`  ⏳ pacing ${(ms / 1000).toFixed(0)}s`);
  await sleep(ms);
}

// Slow human-like typing into a Playwright locator.
export async function humanType(locator, text) {
  for (const char of text) {
    await locator.type(char, { delay: rand(40, 120) });
  }
}

// Slow mouse move via several waypoints (Playwright moves linearly otherwise).
export async function humanMove(page, targetSelector) {
  const box = await page.locator(targetSelector).boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 80, y - 40, { steps: 8 });
  await page.mouse.move(x - 20, y - 10, { steps: 6 });
  await page.mouse.move(x, y, { steps: 4 });
}
