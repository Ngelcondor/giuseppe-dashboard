#!/usr/bin/env bash
#
# Deploy dashboard.elcondor.dev to production (Hetzner box, manual, no CI/CD).
#
# Run THIS ON THE BOX, never locally:
#   ssh giuseppe@135.181.41.224 'cd ~/apps/giuseppe-dashboard && ./scripts/deploy.sh'
#
# It deploys origin/main (the server's local main is diverged — do not pull it),
# rebuilds the prod stack, and ALWAYS restarts nginx (otherwise: 502 on /api,
# because gd-nginx caches the backend container's IP and the rebuild gives it a
# new one). Idempotent: safe to re-run.
#
set -euo pipefail

# --- config ------------------------------------------------------------------
APP_DIR="/home/giuseppe/apps/giuseppe-dashboard"
PROD_HOST="ubuntu-4gb-hel1-1"
COMPOSE="docker compose -f docker/docker-compose.prod.yml"
ENV_FILE="docker/.env"
HEALTH_URL="https://dashboard.elcondor.dev/dashboard/universita"

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- guards ------------------------------------------------------------------
# Refuse to run anywhere but the prod box. Running this on the Mac once created a
# local `prod` branch and broke the dev containers — never again.
[ "$(hostname)" = "$PROD_HOST" ] || die "not on the prod box (hostname=$(hostname), expected $PROD_HOST). Run via SSH on the Hetzner box."
[ -d "$APP_DIR" ] || die "app dir $APP_DIR not found"
cd "$APP_DIR"
[ -f "$ENV_FILE" ] || die "$ENV_FILE missing (prod secrets). Cannot build."

# --- swap (4 GB box, 0 swap → next build can OOM) ----------------------------
if ! swapon --show | grep -q .; then
  say "no swap active — adding a temporary 2G swapfile (prevents next build OOM)"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  ok "swap on"
fi

# --- pull origin/main (NOT local main) ---------------------------------------
say "fetching origin/main"
git fetch origin
git checkout -B prod origin/main
ok "now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- build + run -------------------------------------------------------------
say "building + starting prod stack (this can take a few minutes)"
$COMPOSE --env-file "$ENV_FILE" up -d --build

# --- restart nginx (MANDATORY: backend got a new IP) -------------------------
say "restarting nginx (rebinds to the fresh backend IP)"
$COMPOSE restart nginx

# --- verify backend startup --------------------------------------------------
say "checking backend startup"
sleep 4
logs="$($COMPOSE logs --tail 60 backend 2>&1)"
if grep -qi "startup failed" <<<"$logs"; then
  printf '%s\n' "$logs" | grep -i "startup failed" || true
  die "backend reported startup failed — check: $COMPOSE logs --tail 80 backend"
fi
if grep -qi "Application startup complete" <<<"$logs"; then
  ok "backend startup complete"
else
  printf '\033[1;33m⚠ did not see "Application startup complete" in the last 60 lines — inspect manually:\033[0m\n  %s logs --tail 80 backend\n' "$COMPOSE"
fi
grep -i "Added missing column" <<<"$logs" && ok "schema columns synced" || true

# --- external smoke test -----------------------------------------------------
say "external smoke test"
code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo '000')"
if [ "$code" = "200" ]; then
  ok "deploy done — $HEALTH_URL → 200"
else
  printf '\033[1;33m⚠ %s → HTTP %s (expected 200). Stack is up; check nginx/backend logs.\033[0m\n' "$HEALTH_URL" "$code"
fi
