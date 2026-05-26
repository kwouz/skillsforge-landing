/**
 * Inlined content of skills/free-teaser-seo-meta/SKILL.md.
 *
 * This module exists because the Vercel function bundle for /api/free-skill
 * cannot read files outside its directory at runtime — `readFileSync('../skills/…')`
 * silently fails and ships a truncated fallback.
 *
 * To update: run `npm run build:free-skill` (or copy SKILL.md content here manually).
 */

export const FREE_SKILL_CONTENT = `---
name: seo-meta-generator
description: FREE TEASER — Generate Google-perfect title tag (50-60 chars) and meta description (140-160 chars) for any URL or topic. Honor character limits, include primary keyword naturally, add brand suffix, optimize CTR with proven copy patterns. Use when user asks for "title tag", "meta description", "page meta", "SEO meta", or pastes content to optimize.
metadata:
  version: 1.0.0
  category: seo
  vertical: seo-geo-pack-FREE
  license: Free — published on ClaudeSkills.info as lead magnet. Get the full 10-skill SEO/GEO pack at skillsforge.dev
---

# SEO Meta Generator (FREE)

> 🎁 This is a free teaser from **SkillsForge SEO/GEO Pack** — get 10 production-grade SEO/GEO skills for Claude Code at **skillsforge.dev**.

## What this skill does

For any URL, target keyword, or content snippet, produce:
- Title tag (50–60 chars, primary kw, brand)
- Meta description (140–160 chars, value + soft CTA)
- 3 variants per output for A/B testing

## Inputs

1. Page topic OR URL
2. Primary keyword
3. Brand name (will be suffix)
4. Intent: informational / commercial / transactional

## Title tag templates (pick by intent)

### Informational
- \`{Primary KW}: {Specific value-add} | {Brand}\` (e.g., "Internal Linking Strategy: 6 Patterns That Actually Work | SkillsForge")
- \`How to {Action / KW}: {Number}-Step Guide | {Brand}\` (e.g., "How to Run a Technical SEO Audit: 9-Bucket Playbook | SkillsForge")
- \`{Topic} in {Year}: What Changed | {Brand}\` (e.g., "GEO/AEO in 2026: What Changed | SkillsForge")

### Commercial / Comparison
- \`{KW} vs {Competitor}: Which is Right for {Audience}?\` (e.g., "Surfer vs MarketMuse: Which is Right for Solo SEO Pros?")
- \`Best {KW} of {Year} (Tested by {Brand})\` (e.g., "Best Schema Markup Tools of 2026 (Tested by SkillsForge)")

### Transactional
- \`{Product Name} — {Value Prop} | {Brand}\` (e.g., "SEO/GEO Skills Pack — Ship Audits 10x Faster | SkillsForge")
- \`Get {KW}: {Specific Benefit} | {Brand}\` (e.g., "Get SEO Skills for Claude Code: 10 Production-Ready Skills | SkillsForge")

## Meta description patterns

- **Problem → solution → CTA**: "Spending hours on schema markup? This guide gives you copy-paste JSON-LD for every page type. Save 4h per audit. Read in 6 min →"
- **Specific outcome + proof**: "Ship a technical SEO audit in 90 minutes — not 3 days. 9-bucket checklist used by 200+ solo consultants. Free template inside."
- **Question → answer hint**: "Why do some pages get cited by Perplexity and others don't? Six ranking factors we reverse-engineered. Full breakdown."

Mandatory in meta:
- One specific number (count, time saved, % improvement)
- Soft CTA: "Read in N min", "Free template", "Step-by-step", arrow \`→\`
- Avoid clickbait — Google rewrites if mismatch with content

## Character counters

- Title: target 55 ± 5 (50–60). Use space character counter, NOT word count.
- Meta: target 155 ± 5 (140–160). Some SERPs show 120 (mobile) — first 120 chars matter most.

Test in [Mangools SERP simulator](https://mangools.com/free-seo-tools/serp-simulator/) or any equivalent.

## CTR levers (proven in A/B tests)

1. **Numbers in title**: "7 Patterns" beats "Common Patterns" (~12% CTR lift)
2. **Year freshness**: "in 2026" beats no-year for queries with implied recency
3. **Brackets**: \`[Updated]\`, \`(Tested)\`, \`[Free Guide]\` — careful, can look spammy
4. **Emotional / curiosity**: "What changed", "What no one tells you" — use rarely
5. **Avoid**: ALL CAPS WORDS, !!!, "click here", "amazing"

## Output format

\`\`\`markdown
# SEO Meta for: {topic / URL}

## Primary KW: \`{kw}\` | Intent: \`{intent}\` | Brand: \`{brand}\`

### Title — Variant A
"{title}" (56 chars)

### Title — Variant B
"{title}" (54 chars)

### Title — Variant C
"{title}" (58 chars)

### Meta description — Variant A
"{meta}" (156 chars)

### Meta description — Variant B
"{meta}" (148 chars)

### Meta description — Variant C
"{meta}" (159 chars)

## Recommendation
Pick {A/B/C} for title based on {reasoning}. Pick {A/B/C} for meta because {reasoning}.

## Tracking
After 14 days, check GSC Search Performance:
- Impressions delta vs prior period
- CTR delta
- Position delta (CTR up but position down = good — competing for more queries)
\`\`\`

## Anti-patterns

- ❌ Title > 60 chars — gets truncated, looks ugly
- ❌ Meta > 160 chars — gets truncated, last words cut off
- ❌ Same title + meta as another page on your site — cannibalization
- ❌ Stuffing brand 3x in title (waste of valuable chars)
- ❌ Generic "Welcome to our website" meta on home page
- ❌ Meta written ONCE then never reviewed — they decay as Google's standards shift

## Want more?

This is **1 of 11 SEO/GEO skills** in the SkillsForge Pack:

- \`seo-pseo-generator\` — programmatic SEO that ranks
- \`geo-aeo-optimizer\` — get cited by ChatGPT, Claude, Perplexity, Gemini
- \`schema-markup-engineer\` — JSON-LD for every page type
- \`content-brief-builder\` — production-grade briefs in one pass
- \`technical-seo-auditor\` — 9-bucket site audit
- \`keyword-cluster-mapper\` — turn keywords into topical clusters
- \`internal-linking-architect\` — pillar/cluster topology + orphan rescue
- \`ai-mentions-monitor\` — daily AI search SoV dashboard
- \`backlink-outreach-engine\` — white-hat outreach at scale
- \`gbp-local-seo\` — local SEO + map pack ranking

**\$39 lifetime** or \$14/mo for monthly updates + new skills + Discord community.

Get the full pack → **[skillsforge.dev](https://skillsforge.dev)**

## License (free skill)

This skill is free to use, share, and remix. Attribution appreciated. Paid skills in the SkillsForge Pack carry a single-user license — see purchase terms.
`;
