# SkillsForge SEO/GEO Pack — Landing

## What this is

Production landing for SkillsForge — a paid pack of Claude Code / Codex skills for SEO/GEO specialists. Three tiers:
- **Lifetime** — $49 one-time
- **Pro** — $14/month
- **Team** — $199/year (5 seats)

Payments + file delivery + subscription billing run on **Gumroad** (Merchant of Record). The landing only redirects to Gumroad checkout URLs and handles a separate Resend-backed email gate for the free teaser skill.

Live: https://skillsforge.pitchinsixty.com

## Stack

- Astro 6 (server output + per-page `prerender = true` on static pages)
- `@astrojs/vercel` adapter
- Tailwind CSS 4 via `@tailwindcss/vite`
- Resend 6 (only used for the free-skill email gate — Gumroad handles purchase emails)
- Zod 4 (email validation)
- TypeScript strict

## Local dev

```bash
npm install
cp .env.example .env
# fill GUMROAD_URL_* (production URLs are fine) + Resend keys
npm run dev
# → http://localhost:4321
```

Without the env vars, the landing runs in **preview mode**:
- pricing buttons show an alert
- `/free-skill` accepts the email but does not actually send (logs a hashed-email signup)

In production (`NODE_ENV=production`), the free-skill endpoint returns 503 if Resend is misconfigured rather than silently faking success.

## File layout

```
landing/
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro          # HTML shell + SEO meta + JSON-LD
│   ├── components/
│   │   ├── NavBar.astro
│   │   ├── HeroSection.astro
│   │   ├── ProblemSection.astro
│   │   ├── SkillsGrid.astro
│   │   ├── PricingSection.astro      # 3 tiers, redirects to Gumroad
│   │   ├── FAQSection.astro
│   │   └── Footer.astro
│   ├── pages/
│   │   ├── index.astro               # prerendered
│   │   ├── success.astro             # prerendered
│   │   ├── cancel.astro              # prerendered
│   │   ├── free-skill.astro          # prerendered
│   │   └── api/
│   │       ├── checkout.ts           # POST → returns Gumroad URL per tier
│   │       └── free-skill.ts         # POST → sends teaser + adds to Resend audience
│   ├── lib/
│   │   ├── skills.ts                 # SKILL.md frontmatter parser + fallback
│   │   ├── free-skill-content.ts     # inlined teaser SKILL.md
│   │   ├── tiers.ts                  # Tier union + isTier guard
│   │   ├── email.ts                  # Resend wrapper for free-skill flow
│   │   └── ratelimit.ts              # in-memory per-IP limiter
│   └── styles/global.css             # Tailwind + design tokens
├── public/
│   ├── favicon.svg
│   ├── og-image.png                  # 1200×630 OG image
│   └── logo.svg
├── astro.config.mjs
├── vercel.json                       # security headers + Gumroad CSP
├── package.json
└── tsconfig.json
```

## Environment variables

All vars are documented in `.env.example`. The minimum for live production:

| Variable | Source | Purpose |
|---|---|---|
| `GUMROAD_URL_STARTER` | Gumroad product URL | Lifetime checkout target |
| `GUMROAD_URL_PRO` | Gumroad product URL | Pro subscription checkout target |
| `GUMROAD_URL_TEAM` | Gumroad product URL | Team subscription checkout target |
| `RESEND_API_KEY` | resend.com/api-keys | Free-skill email send |
| `RESEND_FROM_EMAIL` | Verified Resend domain | From-address (e.g. `hello@pitchinsixty.com`) |
| `RESEND_AUDIENCE_ID` | Resend Audience UI | Audience to add free-skill signups to |
| `FOUNDER_EMAIL` | personal mailbox | BCC on every free-skill send (live signup feed) |
| `DISCORD_INVITE_URL` | Discord server invite | Embedded in transactional emails |
| `PUBLIC_SITE_URL` | `https://skillsforge.pitchinsixty.com` | Canonical + OG URL |
| `SITE` | same as above | Astro canonical |

The `/api/checkout` validator requires a Gumroad URL to start with `https://` and resolve to `*.gumroad.com` — see `src/pages/api/checkout.ts`.

## Gumroad setup

The seller-side runbook lives one level up at `../GUMROAD-SETUP-GUIDE.md`. Per-tier ZIP uploads:
- Starter → `../dist/skillsforge-seo-pack-v1.0.0.zip`
- Pro → `../dist/skillsforge-pro-pack-v1.0.0.zip`
- Team → `../dist/skillsforge-team-pack-v1.0.0.zip`

Do not upload the Lifetime ZIP into the Pro product — Pro subscribers must receive Pro-exclusive content only, or the subscription leaks the full Lifetime value at $14.

## Skills directory

`src/lib/skills.ts` reads `../../../../skills/` relative to the page file at build time. On Vercel the parent `skills/` folder is not in the deploy root, so `loadSkills` returns a hardcoded fallback metadata list — keep that list in sync with the actual `skills/` frontmatter if you change skill names or descriptions.

The free teaser skill content is inlined as `src/lib/free-skill-content.ts` to avoid the same filesystem issue on Vercel.

## Resend setup

1. Sign up on resend.com
2. Add and verify the sending domain (`pitchinsixty.com`)
3. Publish the required SPF + DKIM + DMARC records — see security audit at `../workspace/security-report.md` for exact values
4. Create an API key → `RESEND_API_KEY`
5. Create an Audience → `RESEND_AUDIENCE_ID`
6. Set `RESEND_FROM_EMAIL` to the verified sender

## Build + release

```bash
npm run build
# → dist/ + .vercel/output/ ready for Vercel
```

The Vercel project `skillsforge-landing` picks the latest commit on `main`. Environment variables are stored in the Vercel project settings (Production scope).

## Pending TODOs

- [ ] Replace `public/og-image.png` placeholder with a real 1200×630 image
- [ ] Publish SPF + DKIM + DMARC on `pitchinsixty.com` (see `../workspace/security-report.md` C3)
- [ ] Set `DISCORD_INVITE_URL` to the real Pro/Team Discord invite
- [ ] Add `@astrojs/sitemap` integration + `public/robots.txt`
- [ ] A11y patches: `aria-expanded` on FAQ accordion, `aria-live` on free-skill status
- [ ] Per-buyer ZIP watermarking via Gumroad Custom Delivery before scaling paid acquisition
