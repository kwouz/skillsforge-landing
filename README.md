# SkillsForge SEO/GEO Pack — Landing

## Что это

Production-ready лендинг для продажи пакета Claude Code skills "SkillsForge SEO/GEO Pack".
Три тира ($49 lifetime / $14/mo Pro / $199/yr Team), Stripe Checkout, email-доставка ZIP через Resend.

## Стек

- Astro 6 (SSR mode) + @astrojs/vercel adapter
- Tailwind CSS 4 (через @tailwindcss/vite, не deprecated @astrojs/tailwind)
- Stripe 22 (Checkout Sessions + Webhooks)
- Resend 6 (transactional email + free skill delivery)
- Zod 4 (email validation)
- TypeScript strict

## Запуск локально

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать env
cp .env.example .env

# 3. Заполнить .env (см. секцию ENV ниже — минимум нужен только для просмотра)
# Без Stripe/Resend — лендинг работает в preview mode:
# - кнопки checkout покажут alert
# - форма free-skill сохранит email в data/waitlist.json без отправки

# 4. Запустить dev server
npm run dev
# → http://localhost:4321
```

## Структура файлов

```
landing/
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro      # HTML shell + SEO meta + JSON-LD
│   ├── components/
│   │   ├── NavBar.astro           # Fixed sticky nav
│   │   ├── HeroSection.astro      # H1 + CTA кнопки
│   │   ├── ProblemSection.astro   # Проблема + статы
│   │   ├── SkillsGrid.astro       # 11 карточек скиллов
│   │   ├── PricingSection.astro   # 3 тира + Stripe кнопки
│   │   ├── FAQSection.astro       # Аккордеон FAQ
│   │   └── Footer.astro
│   ├── pages/
│   │   ├── index.astro            # Главная (лендинг)
│   │   ├── success.astro          # После оплаты
│   │   ├── cancel.astro           # Отмена checkout
│   │   ├── free-skill.astro       # Email-gate бесплатного скилла
│   │   └── api/
│   │       ├── checkout.ts        # POST → создаёт Stripe Session
│   │       ├── webhook.ts         # POST → Stripe webhook → email доставка
│   │       └── free-skill.ts      # POST → email + waitlist
│   ├── lib/
│   │   ├── skills.ts              # Парсер SKILL.md frontmatter
│   │   └── email.ts               # Resend шаблоны и отправка
│   └── styles/
│       └── global.css             # Tailwind + design tokens
├── public/
│   ├── favicon.svg
│   ├── og-image.svg               # OG-image (заменить на PNG 1200x630)
│   └── og-image.png               # Placeholder — заменить реальным
├── data/
│   └── waitlist.json              # Email waitlist (в .gitignore для публичных репо)
├── .env.example
├── .gitignore
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## ENV переменные

Все переменные документированы в `.env.example`. Минимум для live режима:

| Переменная | Где взять | Зачем |
|---|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com/apikeys | Создание Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Webhooks | Валидация подписи webhook |
| `STRIPE_PRICE_STARTER` | Stripe Dashboard > Products | Price ID продукта $49 |
| `STRIPE_PRICE_PRO` | Stripe Dashboard > Products | Price ID подписки $14/mo |
| `STRIPE_PRICE_TEAM` | Stripe Dashboard > Products | Price ID подписки $199/yr |
| `RESEND_API_KEY` | resend.com/api-keys | Отправка email |
| `RESEND_FROM_EMAIL` | Верифицированный домен в Resend | From-адрес писем |
| `GITHUB_RELEASE_ZIP_URL` | GitHub Release URL | Ссылка на ZIP в доставочном email |
| `DISCORD_INVITE_URL` | Discord Server Settings > Invites | Приглашение для Pro/Team |

## Настройка Stripe Products

### В Stripe Dashboard создай 3 продукта:

1. **SkillsForge Starter Pack**
   - Type: One-time
   - Price: $49.00 USD
   - Скопируй Price ID → `STRIPE_PRICE_STARTER`

2. **SkillsForge Pro Update**
   - Type: Recurring
   - Price: $14.00 USD / month
   - Скопируй Price ID → `STRIPE_PRICE_PRO`

3. **SkillsForge Team License**
   - Type: Recurring
   - Price: $199.00 USD / year
   - Скопируй Price ID → `STRIPE_PRICE_TEAM`

### Настройка Webhook:

1. Stripe Dashboard > Developers > Webhooks > Add endpoint
2. URL: `https://your-domain.com/api/webhook`
3. Events: выбери `checkout.session.completed`
4. Скопируй Signing Secret → `STRIPE_WEBHOOK_SECRET`

### Тестирование Stripe локально:

```bash
# Установи Stripe CLI
brew install stripe/stripe-cli/stripe

# Авторизуйся
stripe login

# Форвардинг webhook на localhost
stripe listen --forward-to localhost:4321/api/webhook

# В другом терминале — тестовый платёж
stripe trigger checkout.session.completed
```

## Skills директория

По умолчанию лендинг ищет skills в `../skills/` (относительно `landing/`).
Это соответствует структуре репозитория: `workspace/seo-skills-pack/skills/`.

На production (Vercel) — либо включи skills в билд (скопируй в `public/skills/`),
либо задай абсолютный путь через `SKILLS_DIR` ENV.

**Если skills недоступны** — лендинг показывает fallback данные из `src/lib/skills.ts`.

## Настройка Resend

1. Зарегистрируйся на resend.com
2. Добавь и верифицируй домен (например `skillsforge.dev`)
3. Создай API key → `RESEND_API_KEY`
4. Укажи `RESEND_FROM_EMAIL=hello@skillsforge.dev`

## Production сборка

```bash
npm run build
# → dist/ + .vercel/output/ (готово для Vercel)
```

Для Vercel: просто подключи репозиторий — Astro Vercel adapter настроен автоматически.

## OG Image

Заменить `public/og-image.png` реальным PNG 1200x630.
Текущий файл — SVG-placeholder для разработки.
Рекомендуем сгенерировать через Figma / Satori / og.image.

## TODO

- [ ] Заменить og-image.png реальным PNG 1200x630
- [ ] Настроить Stripe Products и вписать Price IDs в .env
- [ ] Верифицировать домен в Resend
- [ ] Добавить реальный Discord invite URL
- [ ] Настроить GitHub Release с ZIP архивом skills
- [ ] Заменить плейсхолдерные тексты (copywriter → HeroSection, ProblemSection)
- [ ] Добавить реальный Discord invite в .env
- [ ] Настроить Stripe test mode → live mode переключение перед запуском
- [ ] Настроить PostHog или Plausible analytics (добавить скрипт в BaseLayout.astro)
- [ ] Мигрировать waitlist.json → Supabase после первых 100 лидов
