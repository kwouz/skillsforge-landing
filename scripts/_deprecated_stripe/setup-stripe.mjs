import { call } from './composio-runner.mjs';
import { writeFileSync } from 'node:fs';

const PRODUCTS = [
  {
    key: 'starter',
    name: 'SkillsForge SEO/GEO Skills Pack — Starter',
    description: '11 production-grade Claude Code skills for SEO/GEO specialists. Lifetime access, all updates included.',
    price: { unit_amount: 4900, recurring: null },
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
  console.log(`\n→ Creating product: ${p.key}`);
  const product = await call('STRIPE_CREATE_PRODUCT', {
    name: p.name,
    description: p.description,
    metadata: { sku: p.key, source: 'composio-setup' },
  });
  console.log('  product.id =', product.id);

  console.log(`→ Creating price for ${p.key}`);
  const priceArgs = {
    currency: 'usd',
    product: product.id,
    unit_amount: p.price.unit_amount,
    nickname: `${p.key}-default`,
    metadata: { sku: p.key },
  };
  if (p.price.recurring) priceArgs.recurring = p.price.recurring;

  const price = await call('STRIPE_CREATE_PRICE', priceArgs);
  console.log('  price.id =', price.id);

  result[p.key] = {
    product_id: product.id,
    price_id: price.id,
    unit_amount: p.price.unit_amount,
    recurring: p.price.recurring,
  };
}

writeFileSync('./scripts/stripe-products.json', JSON.stringify(result, null, 2));
console.log('\n✅ saved scripts/stripe-products.json');
console.log(JSON.stringify(result, null, 2));
