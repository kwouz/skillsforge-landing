/**
 * Create the 5 launch promo codes in Lemon Squeezy:
 *   EARLYBIRD39, EARLYBIRDPRO9, SEOFOMO30, LILYRAY30, CYRUS30
 *
 * Usage:
 *   LEMONSQUEEZY_API_KEY=eyJ... LEMONSQUEEZY_STORE_ID=12345 \
 *     node scripts/setup-lemonsqueezy-discounts.mjs
 *
 * Output: scripts/lemonsqueezy-promo-codes.json
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

// 30-day-from-now expiry for the launch flash codes
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

// Note: Lemon Squeezy "amount" for percent type = the percent number (e.g. 30 = 30%).
const codes = [
  {
    code: 'EARLYBIRD39',
    name: 'Early-bird Starter ($39)',
    amount: 20,
    amount_type: 'percent',
    limited: false,
    note: '20% off Starter → $49 - 20% ≈ $39',
  },
  {
    code: 'EARLYBIRDPRO9',
    name: 'Early-bird Pro ($9/mo)',
    amount: 36,
    amount_type: 'percent',
    limited: false,
    note: '~36% off Pro → $14 - 36% ≈ $9',
  },
  {
    code: 'SEOFOMO30',
    name: 'SEOFOMO 30% off (Aleyda)',
    amount: 30,
    amount_type: 'percent',
    limited: true,
    max_redemptions: 100,
  },
  {
    code: 'LILYRAY30',
    name: 'Lily Ray 30% off',
    amount: 30,
    amount_type: 'percent',
    limited: true,
    max_redemptions: 100,
  },
  {
    code: 'CYRUS30',
    name: 'Cyrus Shepard 30% off',
    amount: 30,
    amount_type: 'percent',
    limited: true,
    max_redemptions: 100,
  },
];

const result = { store_id: STORE_ID, promos: {} };

for (const c of codes) {
  const attributes = {
    name: c.name,
    code: c.code,
    amount: c.amount,
    amount_type: c.amount_type,
    duration: 'once',
    expires_at: expiresAt,
  };
  if (c.limited) {
    attributes.is_limited_redemptions = true;
    attributes.max_redemptions = c.max_redemptions;
  }

  const payload = {
    data: {
      type: 'discounts',
      attributes,
      relationships: {
        store: { data: { type: 'stores', id: String(STORE_ID) } },
      },
    },
  };

  try {
    const data = await lsCall('POST', '/discounts', payload);
    const id = data.data?.id;
    result.promos[c.code] = { discount_id: id, amount: c.amount, name: c.name };
    console.log(`✓ ${c.code} created (id=${id})`);
  } catch (err) {
    console.error(`✗ ${c.code}: ${err.message}`);
    result.promos[c.code] = { error: err.message };
  }
}

writeFileSync(
  'scripts/lemonsqueezy-promo-codes.json',
  JSON.stringify(result, null, 2)
);
console.log('\nWrote scripts/lemonsqueezy-promo-codes.json');
