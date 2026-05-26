/**
 * POST /api/free-skill
 * Email-gate for the free teaser skill.
 *
 * Flow:
 * 1. Rate-limit (3 req/IP/15min).
 * 2. Body-size + Zod validation on email.
 * 3. Send the free SKILL.md content via Resend.
 * 4. BCC the admin (FOUNDER_EMAIL) so the founder has a live signup feed.
 * 5. Fire-and-forget add to Resend Audience for drip campaigns.
 *
 * In production, missing Resend config returns 503 — the preview-mode
 * silent-success only triggers outside production.
 */

import type { APIRoute } from 'astro';
import { z } from 'zod/v4';
import {
  sendFreeSkillEmail,
  isResendConfigured,
  addContactToAudience,
} from '../../lib/email';
import { clientKey, gcRateLimit, rateLimit } from '../../lib/ratelimit';
import { FREE_SKILL_CONTENT } from '../../lib/free-skill-content';

const RequestSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

/**
 * Free skill content is inlined as a module constant
 * (`src/lib/free-skill-content.ts`, generated from skills/free-teaser-seo-meta/SKILL.md).
 * Reading the source SKILL.md from disk fails on Vercel because `..` is outside
 * the deployed function bundle — we'd silently ship a truncated fallback.
 */
function getFreeSkillContent(): string {
  return FREE_SKILL_CONTENT;
}

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
  // Body-size guard
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 1024) {
    return new Response(
      JSON.stringify({ success: false, message: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Per-IP rate limit
  gcRateLimit();
  const rl = rateLimit('free-skill', clientKey(request), 3, 15 * 60_000);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ success: false, message: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSec),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid email';
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { email } = parsed.data;
  const masked = await hashEmail(email);

  if (!isResendConfigured()) {
    // Production must not lie to the user. Outside production we accept the
    // signup for preview/local development convenience.
    if (import.meta.env.PROD) {
      console.error(`[free-skill] Resend not configured in PROD — refusing signup sha256:${masked}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email service unavailable. Please try again in a few minutes.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.warn(`[free-skill] Resend not configured (preview). signup sha256:${masked}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Check your inbox!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const skillContent = getFreeSkillContent();
    const founderEmail = import.meta.env.FOUNDER_EMAIL;

    await sendFreeSkillEmail({
      toEmail: email,
      skillContent,
      bccEmail: founderEmail, // founder gets a live signup feed
    });

    console.log(`[free-skill] Sent free skill to sha256:${masked}`);
  } catch (err) {
    console.error('[free-skill] Email error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to send email. Please try again or contact hello@pitchinsixty.com',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fire-and-forget: audience insert must not block the user response or
  // surface errors to the caller. Cap at 2s so a hung Resend call cannot
  // hold the function past Vercel's budget.
  void addContactToAudience({ email, source: 'free-skill' })
    .then((result) => {
      if (!result.ok) {
        console.warn(`[free-skill] Audience insert failed (${result.reason}) for sha256:${masked}`);
      }
    })
    .catch((err) => {
      console.warn(`[free-skill] Audience insert threw for sha256:${masked}:`, err);
    });

  return new Response(
    JSON.stringify({ success: true, message: 'Check your inbox!' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
