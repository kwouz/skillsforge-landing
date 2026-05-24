/**
 * POST /api/checkout
 * Создаёт Stripe Checkout Session и возвращает URL для редиректа.
 * Если Stripe не настроен (нет ENV) — возвращает configured: false для preview.
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { clientKey, gcRateLimit, rateLimit } from '../../lib/ratelimit';

const SITE_URL = 'https://skillsforge.dev';

export const POST: APIRoute = async ({ request }) => {
  // Body size guard — reject oversized payloads before reading
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 4096) {
    return new Response(
      JSON.stringify({ error: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Per-IP rate limit — defense in depth; Vercel Firewall is the primary control
  gcRateLimit();
  const rl = rateLimit('checkout', clientKey(request), 5, 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSec),
        },
      }
    );
  }

  const secretKey = import.meta.env.STRIPE_SECRET_KEY;

  // Preview mode — Stripe не настроен
  if (!secretKey || secretKey.startsWith('sk_placeholder')) {
    return new Response(
      JSON.stringify({ configured: false }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Карта тиров → ENV переменные price_id
  const priceMap: Record<string, string | undefined> = {
    starter: import.meta.env.STRIPE_PRICE_STARTER,
    pro: import.meta.env.STRIPE_PRICE_PRO,
    team: import.meta.env.STRIPE_PRICE_TEAM,
  };

  let body: { tier?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tier = body.tier;
  if (!tier || !priceMap[tier]) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing tier' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const priceId = priceMap[tier];
  if (!priceId || priceId.startsWith('price_placeholder')) {
    return new Response(
      JSON.stringify({ configured: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });

    // Hardcoded site URL — do NOT trust the Origin header (caller-controlled).
    const baseUrl = import.meta.env.PUBLIC_SITE_URL ?? SITE_URL;

    const session = await stripe.checkout.sessions.create({
      mode: tier === 'starter' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      allow_promotion_codes: true,
      metadata: { tier },
    });

    return new Response(
      JSON.stringify({ configured: true, url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    // Log full error server-side; return generic message to client
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error('[checkout] Stripe error:', detail);
    return new Response(
      JSON.stringify({ error: 'Unable to start checkout. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
