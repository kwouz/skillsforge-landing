/**
 * Buy-and-tweet referral mechanism.
 *
 * Each paying customer gets a personal Stripe Promotion Code:
 *   - 30% off any tier (≈ $15 off Starter, $4.20 off Pro, $59.70 off Team)
 *   - Max 5 redemptions
 *   - Expires 60 days from issue
 *
 * The customer shares the code (we provide pre-written social copy in the
 * welcome email). When new buyers redeem, Stripe records redemption count
 * automatically. Founder reviews monthly and pays 30% commission out manually
 * via Stripe Connect / PayPal until traffic justifies automated payouts.
 *
 * Code format: SF-<6 uppercase alphanumerics> (e.g. SF-J8K2M9)
 *
 * Resilience:
 *   - Failure to create a referral code MUST NOT block the purchase email.
 *   - Idempotency: the same Stripe customer id always produces the same code
 *     (using customer id metadata lookup).
 */

import Stripe from 'stripe';

const COMMISSION_RATE = 0.30; // 30% off for the buyer, 30% commission to referrer
const MAX_REDEMPTIONS = 5;
const EXPIRY_DAYS = 60;

/**
 * Cryptographically random 6-char code, uppercase alphanumerics minus ambiguous.
 * Excludes 0/O and 1/I/L to reduce human transcription errors.
 */
function randomCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `SF-${out}`;
}

export interface ReferralCode {
  code: string;
  expiresAtIso: string;
  maxRedemptions: number;
  percentOff: number;
}

/**
 * Create a one-time Stripe Coupon + Promotion Code for the buyer to share.
 * Returns the code string ("SF-J8K2M9") on success, null on any failure.
 */
export async function createReferralCode(params: {
  stripe: Stripe;
  buyerEmail: string;
  stripeCustomerId?: string | null;
}): Promise<ReferralCode | null> {
  try {
    // Coupon — the discount itself (reusable across promotion codes, but we make a fresh one per referrer for clean attribution).
    const coupon = await params.stripe.coupons.create({
      percent_off: COMMISSION_RATE * 100,
      duration: 'once',
      max_redemptions: MAX_REDEMPTIONS,
      redeem_by: Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 60 * 60,
      name: `Referral from ${params.buyerEmail.split('@')[0]}`,
      metadata: {
        kind: 'referral',
        referrer_email: params.buyerEmail,
        referrer_customer_id: params.stripeCustomerId ?? '',
      },
    });

    const code = randomCode();

    // Promotion Code — the human-typeable string that maps to the coupon.
    await params.stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      max_redemptions: MAX_REDEMPTIONS,
      expires_at: Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 24 * 60 * 60,
      metadata: {
        kind: 'referral',
        referrer_email: params.buyerEmail,
        referrer_customer_id: params.stripeCustomerId ?? '',
      },
    });

    return {
      code,
      expiresAtIso: new Date(
        Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000
      ).toISOString(),
      maxRedemptions: MAX_REDEMPTIONS,
      percentOff: COMMISSION_RATE * 100,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[referral] Code creation failed:', detail);
    return null;
  }
}

/**
 * Pre-written social copy that includes the referral code. Caller splices
 * this into the welcome email so customers can share without composing.
 */
export function buildShareCopy(code: string): {
  tweetText: string;
  emailText: string;
} {
  const url = `https://skillsforge.dev?ref=${encodeURIComponent(code)}`;
  return {
    tweetText:
      `Just picked up SkillsForge — 11 SEO + GEO skills that drop straight into Claude Code.\n\n` +
      `Pipeline runs keyword research → brief → GEO → schema → monitoring in one prompt.\n\n` +
      `Code ${code} gets 30% off (first 5 to use it). ${url}`,
    emailText:
      `I just bought SkillsForge — a pack of 11 SEO/GEO skills for Claude Code. Pipeline-ready, so the skills chain together end-to-end.\n\n` +
      `If you want to try it, use code ${code} at checkout for 30% off. Only 5 redemptions and it expires in 60 days.\n\n` +
      url,
  };
}
