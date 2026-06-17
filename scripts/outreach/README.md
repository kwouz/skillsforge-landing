# SkillsForge Outreach — Autopilot scripts

Все скрипты автоматизированной рассылки. См. `AUTOPILOT-PLAN.md` в корне workspace для full sequence.

## Setup (один раз)

```bash
cd /Users/ilya/Desktop/Проекты/ai-agency/workspace/seo-skills-pack/landing
npm install playwright
npx playwright install chromium
```

## ⚠️ Chrome profile

Scripts используют отдельный profile в `~/.skillsforge-chrome` чтобы не блокировать твой main Chrome.

**Первый запуск** — нужно войти в X / LinkedIn / Gmail вручную:

```bash
node scripts/outreach/browser-login.mjs
# Откроется Chromium → войди в:
#   https://x.com/login
#   https://linkedin.com/login
#   https://gmail.com
# Закрой окно → cookies сохранены в profile
```

Затем все automation scripts переиспользуют эти cookies.

## Recipient list

`recipients.csv` — 30 warm-contact CSV. **Заполни перед запуском.**

```csv
name,x_handle,linkedin_url,email,tier,relationship,segment,personal_note
Aleyda Solis,@aleyda,,aleyda@orainti.com,influencer,cold,1,refer to GEO pipeline benchmark
```

`tier` — solo|agency|inhouse|influencer (для template selection)
`relationship` — warm|cold (для приоритизации)
`segment` — 1|2|3 (по `research/market-validation.md`)

## Sequence запуска

```bash
# 1. Resend Audience welcome blast (instant)
node scripts/outreach/email-resend-blast.mjs --template welcome-launch

# 2. Cold email batch (15 emails)
node scripts/outreach/email-gmail-batch.mjs --daily-cap 15

# 3. X DM batch (8 DMs/day)
node scripts/outreach/x-dm-batch.mjs --daily-cap 8

# 4. LinkedIn DM batch (5 DMs/day)
node scripts/outreach/linkedin-dm-batch.mjs --daily-cap 5

# Day 0 launch:
node scripts/outreach/x-launch-thread.mjs
node scripts/outreach/linkedin-post.mjs

# Daily stat post:
node scripts/outreach/x-stat-post.mjs
```

## Logging

Каждый action логируется в `outreach-log.csv` (gitignored):

```
timestamp,channel,recipient,template,status,error
2026-05-25T09:15:00Z,x-dm,@aleyda,aleyda-pitch,sent,
2026-05-25T09:17:30Z,x-dm,@lilyraynyc,lily-fallback,error,DM_RESTRICTED
```

## Safety

- 60-180s random delay между actions
- Captcha detection → script paused + Telegram alert
- Daily caps enforced (`--daily-cap N`)
- Already-contacted skipped (log check)
- Lock file предотвращает duplicate runs
