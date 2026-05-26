/**
 * Resend email helpers — used by /api/free-skill only.
 *
 * Gumroad self-fulfills paid orders (welcome mail + ZIP delivery), so this
 * module no longer handles purchase emails. The only consumer is the
 * free-teaser email-gate.
 */

import { Resend } from 'resend';

/** Проверяет, настроен ли Resend */
export function isResendConfigured(): boolean {
  const key = import.meta.env.RESEND_API_KEY;
  return Boolean(key && !key.startsWith('re_placeholder'));
}

function getResend(): Resend {
  return new Resend(import.meta.env.RESEND_API_KEY);
}

/**
 * Add a contact to a Resend Audience for ongoing mailing-list use.
 *
 * Resend Audiences = the primary mailing list. We keep BCC to founder
 * as a backup feed while the Audience is still populating.
 *
 * Failure to add a contact must NOT block the user response (mailing-list
 * insertion is secondary to the welcome email).
 */
export async function addContactToAudience(params: {
  email: string;
  firstName?: string;
  source: 'free-skill';
}): Promise<{ ok: boolean; reason?: string }> {
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (!audienceId || audienceId.startsWith('aud_placeholder')) {
    return { ok: false, reason: 'audience-not-configured' };
  }
  try {
    const resend = getResend();
    await resend.contacts.create({
      email: sanitizeEmailAddress(params.email),
      firstName: params.firstName ?? '',
      unsubscribed: false,
      audienceId,
    });
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return { ok: false, reason: detail };
  }
}

/**
 * Reject header-injection attempts in any user-controlled value spliced into
 * email addresses. CRLF + angle-brackets in a `from`/`to` field can split a
 * single header into multiple, enabling spoofing.
 */
function sanitizeEmailAddress(value: string): string {
  return value.replace(/[\r\n<>]/g, '').trim();
}

/**
 * Validates a single email address — single `local@domain` shape, no
 * comma list. Used to reject misconfigured env values like a
 * trailing-comma `FOUNDER_EMAIL` that would silently broadcast every
 * free-skill signup to multiple addresses.
 */
function isSingleEmailAddress(value: string): boolean {
  return /^[^\s,;<>"]+@[^\s,;<>"]+\.[^\s,;<>"]+$/.test(value);
}

/**
 * Escape HTML entities so user-controlled or untrusted strings spliced into
 * email markup cannot inject tags or attributes.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML-шаблон письма с бесплатным скиллом */
function buildFreeSkillEmailHtml(skillContent: string): string {
  const escaped = escapeHtml(skillContent);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #0a0a0f; color: #e8e8ed; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-size: 18px; font-weight: 700; color: #e8e8ed; margin-bottom: 32px; }
    .logo span { color: #7c5cff; }
    .badge { display: inline-block; background: rgba(61,220,151,0.12); color: #3ddc97; border: 1px solid rgba(61,220,151,0.25); padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #e8e8ed; margin: 0 0 12px; letter-spacing: -0.02em; }
    p { font-size: 15px; color: #8888a0; line-height: 1.7; margin: 0 0 16px; }
    pre { background: #111118; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; font-size: 12px; color: #8888a0; overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 20px 0; }
    .upsell { background: rgba(124,92,255,0.06); border: 1px solid rgba(124,92,255,0.15); border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .btn { display: inline-block; background: #7c5cff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #555568; }
    a { color: #7c5cff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Skills<span>Forge</span></div>

    <div class="badge">FREE SKILL</div>
    <h1>Here's your SEO Meta Generator skill</h1>
    <p>Save the content below as <strong style="color: #e8e8ed;">SKILL.md</strong> in your Claude Code project folder. Claude will automatically pick it up.</p>

    <pre>${escaped}</pre>

    <p style="font-size: 13px;">
      <strong style="color: #e8e8ed;">How to use:</strong> Open Claude Code and say "generate meta for [your page topic or URL]" — Claude will follow the skill workflow and output 3 variants.
    </p>

    <div class="upsell">
      <p style="font-size: 14px; color: #e8e8ed; margin: 0 0 8px; font-weight: 600;">Want 10 more production-grade skills?</p>
      <p style="font-size: 13px; margin: 0 0 16px;">The Starter Pack includes keyword clustering, technical audits, schema markup, GEO optimization, and 6 more. One-time $49.</p>
      <a href="https://skillsforge.pitchinsixty.com/#pricing" class="btn">Get all 11 skills — $49</a>
    </div>

    <div class="footer">
      <p>SkillsForge · <a href="https://skillsforge.pitchinsixty.com">skillsforge.pitchinsixty.com</a><br>
      You received this because you signed up for the free skill. <a href="https://skillsforge.pitchinsixty.com/unsubscribe">Unsubscribe</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/** Отправка бесплатного скилла через email-gate */
export async function sendFreeSkillEmail(params: {
  toEmail: string;
  skillContent: string;
  bccEmail?: string;
}): Promise<void> {
  const resend = getResend();
  const rawFrom = import.meta.env.RESEND_FROM_EMAIL;
  if (!rawFrom) {
    throw new Error('RESEND_FROM_EMAIL not configured');
  }
  const fromEmail = sanitizeEmailAddress(rawFrom);
  const toEmail = sanitizeEmailAddress(params.toEmail);
  const rawBcc = params.bccEmail ? sanitizeEmailAddress(params.bccEmail) : undefined;
  const bccEmail = rawBcc && isSingleEmailAddress(rawBcc) ? rawBcc : undefined;
  if (rawBcc && !bccEmail) {
    console.warn(`[email] Ignoring malformed BCC value (must be a single address): ${rawBcc.slice(0, 80)}`);
  }

  const { error } = await resend.emails.send({
    from: `SkillsForge <${fromEmail}>`,
    to: toEmail,
    bcc: bccEmail,
    subject: 'Your free SEO Meta Generator skill is here',
    html: buildFreeSkillEmailHtml(params.skillContent),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
