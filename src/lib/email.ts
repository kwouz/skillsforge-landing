/**
 * Утилиты для отправки email через Resend API.
 * Используется в webhook (после оплаты) и free-skill (lead magnet).
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
 * Reject header-injection attempts in any user-controlled value spliced into
 * email addresses. CRLF + angle-brackets in a `from`/`to` field can split a
 * single header into multiple, enabling spoofing.
 */
function sanitizeEmailAddress(value: string): string {
  return value.replace(/[\r\n<>]/g, '').trim();
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

/** HTML-шаблон welcome-письма после покупки */
function buildPurchaseEmailHtml(params: {
  tier: string;
  downloadUrl: string;
  discordUrl: string;
}): string {
  const tier = escapeHtml(params.tier);
  const downloadUrl = escapeHtml(params.downloadUrl);
  const discordUrl = escapeHtml(params.discordUrl);

  const tierLabel =
    tier === 'starter' ? 'Starter Pack' :
    tier === 'pro' ? 'Pro Update' :
    'Team License';

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
    h1 { font-size: 24px; font-weight: 700; color: #e8e8ed; margin: 0 0 12px; letter-spacing: -0.02em; }
    p { font-size: 15px; color: #8888a0; line-height: 1.7; margin: 0 0 16px; }
    .btn { display: inline-block; background: #7c5cff; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0; }
    .btn-secondary { display: inline-block; background: rgba(255,255,255,0.07); color: #e8e8ed; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); margin: 8px 0; }
    .steps { background: #111118; border-radius: 12px; padding: 20px 24px; margin: 24px 0; border: 1px solid rgba(255,255,255,0.08); }
    .step { display: flex; gap: 12px; margin-bottom: 12px; font-size: 14px; color: #8888a0; }
    .step-num { flex-shrink: 0; width: 20px; height: 20px; background: rgba(124,92,255,0.15); color: #7c5cff; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #555568; }
    a { color: #7c5cff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Skills<span>Forge</span></div>

    <h1>Your ${tierLabel} is ready</h1>
    <p>Thanks for your purchase! Here's everything you need to get started.</p>

    <a href="${downloadUrl}" class="btn">Download Skills ZIP</a>

    <div class="steps">
      <div class="step"><div class="step-num">1</div><span>Download and unzip the archive</span></div>
      <div class="step"><div class="step-num">2</div><span>Copy skill files into your Claude Code project (any subfolder works)</span></div>
      <div class="step"><div class="step-num">3</div><span>In Claude Code, type <code>/skill</code> or reference the SKILL.md — Claude will follow the workflow</span></div>
      <div class="step"><div class="step-num">4</div><span>Read the README inside the ZIP for advanced usage and pipeline tips</span></div>
    </div>

    ${tier !== 'starter' ? `
    <p style="margin-top: 20px;"><strong style="color: #e8e8ed;">Join the Discord community</strong> for updates, Q&A calls, and early skill previews:</p>
    <a href="${discordUrl}" class="btn-secondary">Join Discord</a>
    ` : ''}

    <p style="margin-top: 24px; font-size: 13px;">
      Questions? Reply to this email or write to
      <a href="mailto:hello@skillsforge.dev">hello@skillsforge.dev</a>.
      7-day money-back guarantee — just ask.
    </p>

    <div class="footer">
      <p>SkillsForge · <a href="https://skillsforge.dev">skillsforge.dev</a><br>
      Not affiliated with Anthropic. Claude Code is a product of Anthropic.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
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
      <a href="https://skillsforge.dev/#pricing" class="btn">Get all 11 skills — $49</a>
    </div>

    <div class="footer">
      <p>SkillsForge · <a href="https://skillsforge.dev">skillsforge.dev</a><br>
      You received this because you signed up for the free skill. <a href="https://skillsforge.dev/unsubscribe">Unsubscribe</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/** Отправка welcome email после покупки */
export async function sendPurchaseEmail(params: {
  toEmail: string;
  tier: string;
  downloadUrl: string;
  discordUrl: string;
}): Promise<void> {
  const resend = getResend();
  const fromEmail = sanitizeEmailAddress(
    import.meta.env.RESEND_FROM_EMAIL ?? 'hello@skillsforge.dev'
  );
  const toEmail = sanitizeEmailAddress(params.toEmail);

  const { error } = await resend.emails.send({
    from: `SkillsForge <${fromEmail}>`,
    to: toEmail,
    subject: `Your SkillsForge pack is ready — download inside`,
    html: buildPurchaseEmailHtml(params),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

/** Отправка бесплатного скилла через email-gate */
export async function sendFreeSkillEmail(params: {
  toEmail: string;
  skillContent: string;
  bccEmail?: string;
}): Promise<void> {
  const resend = getResend();
  const fromEmail = sanitizeEmailAddress(
    import.meta.env.RESEND_FROM_EMAIL ?? 'hello@skillsforge.dev'
  );
  const toEmail = sanitizeEmailAddress(params.toEmail);
  const bccEmail = params.bccEmail
    ? sanitizeEmailAddress(params.bccEmail)
    : undefined;

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
