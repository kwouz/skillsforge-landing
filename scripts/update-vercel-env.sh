#!/usr/bin/env bash
# Update Vercel production ENV with real values from Composio setup.
set -e

declare -a UPDATES=(
  "STRIPE_PRICE_PRO=price_1TaanHCRPbDk2eeB2ZjRioac"
  "STRIPE_PRICE_TEAM=price_1TaanJCRPbDk2eeBLJBbYNEX"
  "RESEND_AUDIENCE_ID=e6b4e158-e1a8-43b0-8eda-13d606826f52"
  "RESEND_API_KEY=re_jYtGqtRp_J4Nc4Jo5EycbcJSrwUqbBSoA"
  "RESEND_FROM_EMAIL=hello@pitchinsixty.com"
)

for entry in "${UPDATES[@]}"; do
  KEY="${entry%%=*}"
  VAL="${entry#*=}"
  echo "→ $KEY"
  vercel env rm "$KEY" production -y 2>&1 | tail -1
  printf '%s' "$VAL" | vercel env add "$KEY" production 2>&1 | tail -1
done

echo
echo "✅ done. Manual ENV still placeholder:"
echo "  STRIPE_SECRET_KEY"
echo "  STRIPE_WEBHOOK_SECRET"
echo "  GITHUB_PAT"
echo "  DISCORD_INVITE_URL"
