import { call } from './composio-runner.mjs';
import { writeFileSync } from 'node:fs';

// Coupon + promo code combinations from FIRST-REVENUE-PLAN + day-by-day-playbook
const PROMOS = [
  // Early-bird Starter $39 (≈20% off $49) — close after Day +3
  {
    code: 'EARLYBIRD39',
    coupon: { name: 'Early-bird Starter $39', percent_off: 20, duration: 'once', max_redemptions: 100 },
    max_redemptions: 100,
  },
  // Early-bird Pro $9/mo for 3 months (≈36% off $14) — close after Day +3
  {
    code: 'EARLYBIRDPRO9',
    coupon: { name: 'Early-bird Pro 3mo @ $9', percent_off: 36, duration: 'repeating', duration_in_months: 3, max_redemptions: 100 },
    max_redemptions: 100,
  },
  // Aleyda Solis cohort referral
  {
    code: 'SEOFOMO30',
    coupon: { name: 'Aleyda Solis cohort 30% off', percent_off: 30, duration: 'once', max_redemptions: 200 },
    max_redemptions: 200,
  },
  // Lily Ray fallback
  {
    code: 'LILYRAY30',
    coupon: { name: 'Lily Ray cohort 30% off', percent_off: 30, duration: 'once', max_redemptions: 200 },
    max_redemptions: 200,
  },
  // Cyrus Shepard fallback
  {
    code: 'CYRUS30',
    coupon: { name: 'Cyrus Shepard cohort 30% off', percent_off: 30, duration: 'once', max_redemptions: 200 },
    max_redemptions: 200,
  },
];

const result = {};

for (const p of PROMOS) {
  console.log(`\n→ Creating coupon for ${p.code}`);
  const coupon = await call('STRIPE_CREATE_COUPON', p.coupon);
  console.log('  coupon.id =', coupon.id);

  console.log(`→ Creating promotion code ${p.code}`);
  const promo = await call('STRIPE_CREATE_PROMOTION_CODE', {
    coupon: coupon.id,
    code: p.code,
    active: true,
    max_redemptions: p.max_redemptions,
  });
  console.log('  promo.id =', promo.id);

  result[p.code] = {
    coupon_id: coupon.id,
    promo_id: promo.id,
    percent_off: p.coupon.percent_off,
    duration: p.coupon.duration,
  };
}

writeFileSync('./scripts/stripe-promo-codes.json', JSON.stringify(result, null, 2));
console.log('\n✅ saved scripts/stripe-promo-codes.json');
console.log(JSON.stringify(result, null, 2));
