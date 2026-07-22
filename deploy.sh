#!/usr/bin/env bash
# Build locally, then publish frontends to Vercel production using --prebuilt.
# Remote Vercel builds are flaky for this monorepo; prebuilt is the reliable path.
#
# Requires: logged-in Vercel CLI (`npx vercel login`) and each app linked once:
#   cd apps/landing && npx vercel link --yes --project magicboxai-landing --scope didigamnithins-projects
#   cd apps/web     && npx vercel link --yes --project magicboxai-web     --scope didigamnithins-projects
#   cd apps/admin   && npx vercel link --yes --project magicboxai-admin   --scope didigamnithins-projects
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

SCOPE="${VERCEL_SCOPE:-didigamnithins-projects}"

echo "==> Installing dependencies & building..."
npm install --no-fund --no-audit
npm run build

deploy_vercel() {
  local name="$1"
  local dir="$2"
  echo ""
  echo "==> Deploying ${name} → Vercel production (prebuilt)..."
  (
    cd "$ROOT_DIR/$dir"
    if [[ ! -f .vercel/project.json ]]; then
      echo "✖ ${dir} is not linked to a Vercel project."
      echo "  Run once:  cd ${dir} && npx vercel link --yes --scope ${SCOPE}"
      exit 1
    fi
    npx vercel pull --yes --environment=production --scope "$SCOPE" >/dev/null
    npx vercel build --prod --scope "$SCOPE"
    npx vercel deploy --prebuilt --prod --yes --scope "$SCOPE"
  )
}

deploy_vercel "landing (magicboxai.in)" "apps/landing"
deploy_vercel "web (app.magicboxai.in)" "apps/web"
deploy_vercel "admin (admin.magicboxai.in)" "apps/admin"

echo ""
echo "✔ Deploy complete."
echo "  Landing: https://magicboxai.in"
echo "  App:     https://app.magicboxai.in"
echo "  Admin:   https://admin.magicboxai.in"
