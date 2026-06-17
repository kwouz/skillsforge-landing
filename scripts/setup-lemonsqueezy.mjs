/**
 * Create 3 SkillsForge products in Lemon Squeezy + their variants.
 *
 * Run once after you have:
 *   - LEMONSQUEEZY_API_KEY in env (LS dashboard → Settings → API → New API key)
 *   - LEMONSQUEEZY_STORE_ID in env (LS dashboard URL after store creation)
 *
 * Usage:
 *   LEMONSQUEEZY_API_KEY=eyJ... LEMONSQUEEZY_STORE_ID=12345 \
 *     node scripts/setup-lemonsqueezy.mjs
 *
 * Output: scripts/lemonsqueezy-products.json with variant IDs to put in
 * LEMONSQUEEZY_VARIANT_STARTER / _PRO / _TEAM env vars.
 */

import { writeFileSync } from 'node:fs';

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

if (!API_KEY || !STORE_ID) {
  console.error('Missing LEMONSQUEEZY_API_KEY or LEMONSQUEEZY_STORE_ID');
  process.exit(1);
}

const BASE = 'https://api.lemonsqueezy.com/v1';

async function lsCall(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

const products = [
  {
    key: 'starter',
    name: 'SkillsForge Starter',
    description: '11 production Claude Code skills for SEO/GEO pipelines. One-time purchase. Lifetime download access.',
    priceUsdCents: 4900,
    interval: null, // one-time
  },
  {
    key: 'pro',
    name: 'SkillsForge Pro',
    description: 'Everything in Starter + monthly skill updates, Discord access, monthly Q&A call. Cancel anytime.',
    priceUsdCents: 1400,
    interval: 'month',
  },
  {
    key: 'team',
    name: 'SkillsForge Team',
    description: 'Pro + 5-seat team license, priority support, custom skill 1/qtr, onboarding call.',
    priceUsdCents: 19900,
    interval: 'year',
  },
];

const result = { store_id: STORE_ID, products: {} };

console.log('NOTE: Lemon Squeezy does not let you create products via API.');
console.log('Manual setup required:');
console.log('');
console.log('1. Open https://app.lemonsqueezy.com/products');
console.log('2. Click "New product" 3 times — once per tier below.');
console.log('3. For each product, set the variant pricing exactly as shown:');
console.log('');
for (const p of products) {
  const dollars = (p.priceUsdCents / 100).toFixed(2);
  const billing = p.interval ? `subscription, every 1 ${p.interval}` : 'one-time payment';
  console.log(`  ── ${p.name}`);
  console.log(`     Description: ${p.description}`);
  console.log(`     Price:       $${dollars} (${billing})`);
  console.log('');
}
console.log('4. After publishing each product, copy its VARIANT ID');
console.log('   (Variants tab → click variant → URL contains /variants/<id>).');
console.log('');
console.log('5. Set env vars on Vercel:');
console.log('   LEMONSQUEEZY_VARIANT_STARTER=<starter variant id>');
console.log('   LEMONSQUEEZY_VARIANT_PRO=<pro variant id>');
console.log('   LEMONSQUEEZY_VARIANT_TEAM=<team variant id>');
console.log('');

// Try to verify access by listing products
console.log('Verifying API access...');
try {
  const list = await lsCall('GET', `/products?filter[store_id]=${STORE_ID}`);
  console.log(`✓ API access OK. Store has ${list.data?.length ?? 0} existing products.`);
  if (list.data?.length) {
    console.log('Existing products and their variants:');
    for (const prod of list.data) {
      console.log(`  • ${prod.attributes.name} (product_id=${prod.id})`);
      const variants = await lsCall(
        'GET',
        `/variants?filter[product_id]=${prod.id}`
      );
      for (const v of variants.data ?? []) {
        const a = v.attributes;
        const price = (a.price ?? 0) / 100;
        const interval = a.interval ? `/${a.interval}` : ' one-time';
        console.log(`      variant_id=${v.id}  $${price}${interval}  "${a.name}"`);
      }
    }
  }
} catch (err) {
  console.error('✗ API access failed:', err.message);
  process.exit(1);
}

writeFileSync(
  'scripts/lemonsqueezy-products.json',
  JSON.stringify(result, null, 2)
);
console.log('\nWrote scripts/lemonsqueezy-products.json (skeleton — fill variants manually).');
