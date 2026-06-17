import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync('./.env.production.local', 'utf8');
const SK = env.match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
if (!SK || !SK.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY must be sk_test_... in .env.production.local');
}

async function stripe(method, path, params) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-04-10',
    },
  };
  if (params) {
    const body = new URLSearchParams();
    function flatten(obj, prefix = '') {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (v === null || v === undefined) continue;
        if (typeof v === 'object' && !Array.isArray(v)) flatten(v, key);
        else body.append(key, String(v));
      }
    }
    flatten(params);
    opts.body = body.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${json.error?.message || JSON.stringify(json)}`);
  return json;
}

const PRODUCTS = [
  {
    key: 'starter',
    name: 'SkillsForge SEO/GEO Skills Pack — Starter',
    description: '11 production-grade Claude Code skills for SEO/GEO specialists. Lifetime access, all updates included.',
    price: { unit_amount: 4900 },
  },
  {
    key: 'pro',
    name: 'SkillsForge SEO/GEO Skills Pack — Pro',
    description: 'Starter + monthly skill drops + Discord community + priority support.',
    price: { unit_amount: 1400, recurring: { interval: 'month' } },
  },
  {
    key: 'team',
    name: 'SkillsForge SEO/GEO Skills Pack — Team',
    description: 'Pro for up to 5 seats. Annual subscription, includes onboarding call.',
    price: { unit_amount: 19900, recurring: { interval: 'year' } },
  },
];

const result = {};

for (const p of PRODUCTS) {
  console.log(`→ ${p.key}: product`);
  const product = await stripe('POST', '/products', {
    name: p.name,
    description: p.description,
    metadata: { sku: p.key, source: 'recreate-stripe-test' },
  });
  console.log(`  product=${product.id}`);

  const priceArgs = {
    currency: 'usd',
    product: product.id,
    unit_amount: p.price.unit_amount,
    nickname: `${p.key}-default`,
    metadata: { sku: p.key },
  };
  if (p.price.recurring) priceArgs.recurring = p.price.recurring;
  const price = await stripe('POST', '/prices', priceArgs);
  console.log(`  price=${price.id}`);

  result[p.key] = { product_id: product.id, price_id: price.id };
}

console.log('\n→ creating promotion codes');
const PROMOS = [
  { code: 'EARLYBIRD39', coupon: { name: 'Early-bird Starter $39', percent_off: 20, duration: 'once', max_redemptions: 100 }, max_redemptions: 100 },
  { code: 'EARLYBIRDPRO9', coupon: { name: 'Early-bird Pro 3mo @ $9', percent_off: 36, duration: 'repeating', duration_in_months: 3, max_redemptions: 100 }, max_redemptions: 100 },
  { code: 'SEOFOMO30', coupon: { name: 'Aleyda Solis cohort 30%', percent_off: 30, duration: 'once', max_redemptions: 200 }, max_redemptions: 200 },
  { code: 'LILYRAY30', coupon: { name: 'Lily Ray cohort 30%', percent_off: 30, duration: 'once', max_redemptions: 200 }, max_redemptions: 200 },
  { code: 'CYRUS30', coupon: { name: 'Cyrus Shepard cohort 30%', percent_off: 30, duration: 'once', max_redemptions: 200 }, max_redemptions: 200 },
];

const promoResult = {};
for (const p of PROMOS) {
  const coupon = await stripe('POST', '/coupons', p.coupon);
  const promo = await stripe('POST', '/promotion_codes', { coupon: coupon.id, code: p.code, active: true, max_redemptions: p.max_redemptions });
  promoResult[p.code] = { coupon_id: coupon.id, promo_id: promo.id };
  console.log(`  ${p.code}: ${promo.id}`);
}

writeFileSync('./scripts/stripe-products-test.json', JSON.stringify({ products: result, promos: promoResult }, null, 2));
console.log('\n✅ saved scripts/stripe-products-test.json');
console.log('NEW PRICE IDS:');
console.log(`  STARTER=${result.starter.price_id}`);
console.log(`  PRO=${result.pro.price_id}`);
console.log(`  TEAM=${result.team.price_id}`);
