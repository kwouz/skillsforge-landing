/**
 * POST /api/checkout
 *
 * Returns the Gumroad checkout URL for the requested tier.
 * Gumroad handles payment processing, fulfillment (auto-emails the ZIP)
 * and subscription billing — no webhook or download endpoint is needed
 * on our side.
 *
 * If a tier's URL is not configured (env missing / placeholder), returns
 * { configured: false } so the landing page can show a preview notice.
 */

import type { APIRoute } from 'astro';
import { clientKey, gcRateLimit, rateLimit } from '../../lib/ratelimit';
import { type Tier, isTier } from '../../lib/tiers';

const MAX_BODY_BYTES = 4096;

function isConfiguredUrl(value: string | undefined): value is string {
  if (!value) return false;
  if (value.startsWith('placeholder')) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('gumroad.com');
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
    return new Response(
      JSON.stringify({ error: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

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

  let body: unknown = {};
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Payload too large' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tierField = (body as { tier?: unknown }).tier;
  if (!isTier(tierField)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing tier' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const tier: Tier = tierField;

  const urlMap: Record<Tier, string | undefined> = {
    starter: import.meta.env.GUMROAD_URL_STARTER,
    pro: import.meta.env.GUMROAD_URL_PRO,
    team: import.meta.env.GUMROAD_URL_TEAM,
  };

  const url = urlMap[tier];
  if (!isConfiguredUrl(url)) {
    return new Response(
      JSON.stringify({ configured: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ configured: true, url }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
