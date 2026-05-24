/**
 * POST /api/free-skill
 * Email-gate for the free teaser skill.
 *
 * Flow:
 * 1. Rate-limit (5 req/IP/15min).
 * 2. Body-size + Zod validation on email.
 * 3. Send the free SKILL.md content via Resend.
 * 4. BCC the admin (FOUNDER_EMAIL) so the founder has a live signup feed.
 *
 * No filesystem writes — Vercel serverless filesystem is ephemeral and
 * read-only outside /tmp. To persist the waitlist properly, migrate to
 * Supabase / Resend Audience (TODO tracked in deployment/launch-runbook.md).
 */

import type { APIRoute } from 'astro';
import { z } from 'zod/v4';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sendFreeSkillEmail, isResendConfigured } from '../../lib/email';
import { clientKey, gcRateLimit, rateLimit } from '../../lib/ratelimit';

const RequestSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

const FALLBACK_SKILL_CONTENT = `---
name: seo-meta-generator
description: FREE TEASER — Generate Google-perfect title tag and meta description for any URL or topic.
---

# SEO Meta Generator (FREE)

Generate:
- Title tag: 50–60 chars, primary keyword, brand suffix
- Meta description: 140–160 chars, value + soft CTA
- 3 variants per page for A/B testing

## Usage
Tell Claude: "Generate meta tags for: [page topic or URL]"

Claude will output 3 variants with character counts.

---
Get the full 11-skill SEO/GEO pack at https://skillsforge.dev
`;

function getFreeSkillContent(): string {
  const skillsDirEnv = import.meta.env.SKILLS_DIR;
  const skillsDir = skillsDirEnv
    ? skillsDirEnv
    : join(process.cwd(), '..', 'skills');

  const skillPath = join(skillsDir, 'free-teaser-seo-meta', 'SKILL.md');

  try {
    return readFileSync(skillPath, 'utf-8');
  } catch {
    return FALLBACK_SKILL_CONTENT;
  }
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
    // Preview mode — accept but warn
    console.warn(`[free-skill] Resend not configured. signup sha256:${masked}`);
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
        message: 'Failed to send email. Please try again or contact support@skillsforge.dev',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Check your inbox!' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
