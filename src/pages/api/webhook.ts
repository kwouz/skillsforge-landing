/**
 * POST /api/webhook
 * Stripe webhook обработчик.
 * Валидирует stripe-signature, обрабатывает checkout.session.completed,
 * отправляет ZIP-доставку через Resend.
 *
 * ВАЖНО: этот route должен получать raw body (не JSON.parse),
 * иначе подпись Stripe не пройдёт валидацию.
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import {
  sendPurchaseEmail,
  isResendConfigured,
  addContactToAudience,
} from '../../lib/email';
import { markEventProcessed } from '../../lib/idempotency';
import { createReferralCode, buildShareCopy } from '../../lib/referral';
import { mintDownloadToken } from '../../lib/download-token';

const RELEASE_VERSION = '1.0.0';

const STRIPE_TOLERANCE_SECONDS = 300; // default; declared explicitly per audit M3

/** Hash an email for log lines so Vercel logs never store raw PII. */
async function hashEmail(email: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(email.toLowerCase().trim());
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, 12);
  } catch {
    return 'hash-unavailable';
  }
}

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = import.meta.env.STRIPE_SECRET_KEY;

  // Если Stripe не настроен — возвращаем 200 (не ломаем pipeline)
  if (!webhookSecret || !secretKey ||
      webhookSecret.startsWith('whsec_placeholder') ||
      secretKey.startsWith('sk_placeholder')) {
    console.warn('[webhook] Stripe not configured, skipping webhook processing');
    return new Response(JSON.stringify({ received: true, configured: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Читаем raw body — обязательно для Stripe webhook validation
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
      STRIPE_TOLERANCE_SECONDS
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[webhook] Signature error:', detail);
    // Generic 400 to caller; do not echo signature internals
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Idempotency — Stripe at-least-once delivery means we may see this event
  // multiple times. Process exactly once.
  // TODO: replace in-memory store with persistent KV/Supabase once traffic > 1k req/day.
  if (!markEventProcessed(event.id)) {
    console.log(`[webhook] Duplicate event ${event.id} (${event.type}) — skipped`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle completed checkout sessions
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerEmail = session.customer_details?.email;
    const tier = session.metadata?.tier ?? 'starter';

    if (!customerEmail) {
      console.error('[webhook] No customer email in session:', session.id);
      // Do not 5xx — Stripe must not retry a data-shape issue we cannot recover from
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mint a signed download token. The customer's welcome email gets a
    // tokenized URL on our domain — the endpoint streams the private ZIP
    // via a server-side GitHub PAT. Self-expiring, no DB.
    const downloadSecret = import.meta.env.DOWNLOAD_SECRET;
    const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? 'https://skillsforge.dev';
    const token = mintDownloadToken({
      secret: downloadSecret ?? '',
      email: customerEmail,
      tier,
      version: RELEASE_VERSION,
    });
    const downloadUrl = token
      ? `${siteUrl}/api/download/${token}`
      : import.meta.env.GITHUB_RELEASE_ZIP_URL;
    const discordUrl = import.meta.env.DISCORD_INVITE_URL;

    if (!downloadUrl || !discordUrl) {
      console.error('[webhook] Missing download/Discord env');
      return new Response(JSON.stringify({ received: true, configError: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isResendConfigured()) {
      try {
        // Generate referral code (best-effort — failure does not block email)
        const stripeForReferral = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });
        const customerId =
          typeof session.customer === 'string' ? session.customer : null;
        const referral = await createReferralCode({
          stripe: stripeForReferral,
          buyerEmail: customerEmail,
          stripeCustomerId: customerId,
        });
        const shareCopy = referral ? buildShareCopy(referral.code) : null;

        await sendPurchaseEmail({
          toEmail: customerEmail,
          tier,
          downloadUrl,
          discordUrl,
          referralCode: referral?.code ?? undefined,
          tweetText: shareCopy?.tweetText,
        });
        const masked = await hashEmail(customerEmail);
        console.log(`[webhook] Email sent to sha256:${masked} for tier ${tier} (referral=${referral?.code ?? 'none'})`);

        // Tag as purchase contact in Audience for follow-up drip
        const audienceSource =
          tier === 'pro' ? 'pro-purchase' :
          tier === 'team' ? 'team-purchase' :
          'starter-purchase';
        const audienceResult = await addContactToAudience({
          email: customerEmail,
          source: audienceSource,
        });
        if (!audienceResult.ok) {
          console.warn(`[webhook] Audience insert failed (${audienceResult.reason}) sha256:${masked}`);
        }
      } catch (err) {
        // Log but do not 5xx — Stripe would retry indefinitely
        console.error('[webhook] Email send failed:', err);
      }
    } else {
      console.warn('[webhook] Resend not configured, email not sent');
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
