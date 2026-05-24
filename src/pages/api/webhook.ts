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
import { sendPurchaseEmail, isResendConfigured } from '../../lib/email';
import { markEventProcessed } from '../../lib/idempotency';

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

    // Delivery URLs — fail-fast if not configured in production
    const downloadUrl = import.meta.env.GITHUB_RELEASE_ZIP_URL;
    const discordUrl = import.meta.env.DISCORD_INVITE_URL;
    if (!downloadUrl || !discordUrl) {
      console.error('[webhook] Missing GITHUB_RELEASE_ZIP_URL or DISCORD_INVITE_URL env');
      return new Response(JSON.stringify({ received: true, configError: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isResendConfigured()) {
      try {
        await sendPurchaseEmail({
          toEmail: customerEmail,
          tier,
          downloadUrl,
          discordUrl,
        });
        const masked = await hashEmail(customerEmail);
        console.log(`[webhook] Email sent to sha256:${masked} for tier ${tier}`);
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
