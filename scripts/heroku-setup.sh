#!/usr/bin/env bash
# Setup Heroku Postgres (essential-0) + config vars para revillefitness
# Executar APÓS: heroku login (conta zaccgamer123@gmail.com)
set -euo pipefail

APP_NAME="${1:-revillefitness}"

echo "==> App: $APP_NAME"

echo "==> Adicionando Heroku Postgres (essential-0)..."
heroku addons:create heroku-postgresql:essential-0 -a "$APP_NAME" || true

echo "==> Config vars base..."
heroku config:set DIRECT_URL="$(heroku config:get DATABASE_URL -a "$APP_NAME")" -a "$APP_NAME"

if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  echo "==> NEXTAUTH_SECRET gerado automaticamente"
fi
heroku config:set NEXTAUTH_SECRET="$NEXTAUTH_SECRET" -a "$APP_NAME"

HEROKU_URL="https://${APP_NAME}.herokuapp.com"
heroku config:set NEXTAUTH_URL="$HEROKU_URL" -a "$APP_NAME"

echo "==> Remotes git..."
heroku git:remote -a "$APP_NAME" || true

echo "==> Config atual:"
heroku config -a "$APP_NAME"

echo ""
echo "Próximos passos:"
echo "  1. npm run db:backup:docker   (com DIRECT_URL do Supabase)"
echo "  2. RESTORE_DATABASE_URL=\$(heroku config:get DATABASE_URL -a $APP_NAME) npm run db:restore:docker -- backups/arquivo.dump"
echo "  3. git push heroku main"
