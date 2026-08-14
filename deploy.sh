#!/usr/bin/env bash
# Canonical deploy script for magicboxai.
#
# Every deploy pushes to GitHub first, then deploys — unless CI/CD already
# covers deployment for this push, in which case we don't run a redundant
# manual deploy.
#
#   Step 1 (push):   commit + push the current branch to GitHub. This used to
#                     be git.sh's job; git.sh now just execs this script.
#   Step 2 (deploy): .github/workflows/ci.yml only runs a security audit,
#                     typecheck, tests, build, and a browser smoke test on
#                     push/PR — it never deploys anything. The Vercel projects
#                     linked below (magicboxai-landing/-web/-admin) are pushed
#                     from local prebuilt output, not from Vercel's own git
#                     integration (remote/Vercel-triggered builds were flaky
#                     for this monorepo — see the note kept below). So nothing
#                     auto-deploys on push, and this script always runs the
#                     real manual Vercel deploy after pushing.
#
# NOTE (verified against the Netlify API, not touched by this script): three
# legacy Netlify sites (magicbox-web, magicbox-admin, magicbox-landing) are
# still registered with custom domains like app.magicboxai.in, deploy_source
# "cli", and no repo linked. These look like stale leftovers from before the
# Firebase/Vercel setup below and are worth manually verifying/cleaning up in
# the Netlify dashboard — this script does not touch or delete anything there.
#
# --- Original deploy.sh header, preserved ---
# Build locally, then publish frontends to Vercel production using --prebuilt.
# Remote Vercel builds are flaky for this monorepo; prebuilt is the reliable path.
#
# Requires: logged-in Vercel CLI (`npx vercel login`) and each app linked once:
#   cd apps/landing && npx vercel link --yes --project magicboxai-landing --scope didigamnithins-projects
#   cd apps/web     && npx vercel link --yes --project magicboxai-web     --scope didigamnithins-projects
#   cd apps/admin   && npx vercel link --yes --project magicboxai-admin   --scope didigamnithins-projects
set -euo pipefail
# Select the GitHub account for this repository before every push.
# Override GITHUB_ACCOUNT when a repository is intentionally owned by a different account.
GITHUB_ACCOUNT="${GITHUB_ACCOUNT:-didigamnithin}"

ensure_github_account() {
  command -v gh >/dev/null 2>&1 || {
    echo "GitHub CLI (gh) is required to push as $GITHUB_ACCOUNT." >&2
    echo "Install gh and authenticate with: gh auth login --hostname github.com" >&2
    return 1
  }
  gh auth token --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null 2>&1 || {
    echo "GitHub CLI is not authenticated as $GITHUB_ACCOUNT." >&2
    echo "Authenticate that account first, then rerun this deploy." >&2
    return 1
  }
  gh auth switch --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null || {
    echo "Could not switch GitHub CLI to $GITHUB_ACCOUNT." >&2
    return 1
  }
  echo "Using GitHub account: $GITHUB_ACCOUNT"
}

push_with_github_account() {
  ensure_github_account
  git push "$@"
}


ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="origin"
REMOTE_URL="https://github.com/nhancio/magicboxai.git"
SCOPE="${VERCEL_SCOPE:-didigamnithins-projects}"

SKIP_PUSH=0
SKIP_DEPLOY=0
COMMIT_MESSAGE=""

usage() {
  cat <<'EOF'
Usage: ./deploy.sh [commit message] [options]

Step 1 (push): stages all changes (git add -A), commits (using the given
message, or a timestamped default if none is given / nothing to say), and
pushes the current branch to GitHub. Creates the "origin" remote if it's
missing, or fixes its URL if it points somewhere unexpected.

Step 2 (deploy): CI (.github/workflows/ci.yml) only audits/typechecks/tests/
builds — it never deploys. These Vercel projects are deployed via local
prebuilt CLI push, not Vercel git-integration auto-deploy. So after pushing,
this script builds locally and deploys apps/landing, apps/web, and apps/admin
to Vercel production, exactly like the previous deploy.sh did.

Options:
  -h, --help      Show this help and exit.
  --skip-push     Skip step 1 (push) and only run the Vercel deploy.
  --skip-deploy   Skip step 2 (deploy) and only push to GitHub.

Examples:
  ./deploy.sh
  ./deploy.sh "fix: onboarding copy"
  ./deploy.sh --skip-deploy
  ./deploy.sh --skip-push
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --skip-push)
      SKIP_PUSH=1
      shift
      ;;
    --skip-deploy)
      SKIP_DEPLOY=1
      shift
      ;;
    -*)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
    *)
      if [[ -z "$COMMIT_MESSAGE" ]]; then
        COMMIT_MESSAGE="$1"
      else
        COMMIT_MESSAGE="$COMMIT_MESSAGE $1"
      fi
      shift
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Step 1: push to GitHub
# ---------------------------------------------------------------------------
push_to_github() {
  echo "==> Step 1: push to GitHub"

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "✖ Not inside a git repository (no .git found here or in a parent dir)." >&2
    echo "  Run 'git init', add the remote, and commit at least once, then re-run this script." >&2
    exit 1
  fi

  # Switch GitHub CLI (and thus git HTTPS credentials) before fetch/pull.
  # GitHub reports private repos as "not found" when the active account cannot
  # see them — fetch/pull used to run as whichever gh account was last active.
  ensure_github_account

  if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
    local current_url
    current_url="$(git remote get-url "$REMOTE_NAME")"
    if [[ "$current_url" != "$REMOTE_URL" ]]; then
      echo "  '$REMOTE_NAME' pointed to $current_url — fixing to $REMOTE_URL"
      git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
    fi
  else
    echo "  No '$REMOTE_NAME' remote configured yet — adding $REMOTE_URL"
    git remote add "$REMOTE_NAME" "$REMOTE_URL"
  fi

  # Nested git repos (e.g. an accidentally-vendored checkout under apps/ or
  # node_modules/) are staged by git as gitlinks, not flattened into this
  # repo's history — but warn loudly so a real one doesn't go unnoticed.
  local nested_repos
  nested_repos="$(find . -mindepth 2 -type d -name ".git" \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" 2>/dev/null || true)"
  if [[ -n "$nested_repos" ]]; then
    echo "⚠ Nested git repositories detected (staged as gitlinks, not as plain files):"
    echo "$nested_repos" | sed 's/^/    /'
  fi

  local branch
  branch="$(git symbolic-ref --short HEAD)"

  echo "  Syncing latest changes from $REMOTE_NAME/$branch..."
  git fetch "$REMOTE_NAME" "$branch" || true

  git add -A

  if git diff --cached --quiet; then
    echo "  Nothing staged — working tree matches local HEAD."
  else
    local message="${COMMIT_MESSAGE:-chore: deploy $(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
    git commit -m "$message"
  fi

  echo "  Pulling remote changes from $REMOTE_NAME/$branch..."
  git pull --rebase "$REMOTE_NAME" "$branch" || {
    echo "⚠ Could not rebase automatically. Falling back to standard merge..."
    git rebase --abort 2>/dev/null || true
    git pull --no-rebase "$REMOTE_NAME" "$branch"
  }

  echo "  Pushing '$branch' to $REMOTE_NAME..."
  push_with_github_account -u "$REMOTE_NAME" "$branch"
}

# ---------------------------------------------------------------------------
# Step 2: deploy (manual Vercel deploy — CI/CD does not cover this, see header)
# ---------------------------------------------------------------------------
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

run_manual_deploy() {
  echo ""
  echo "==> Step 2: deploy"
  echo "    CI (.github/workflows/ci.yml) audits/typechecks/tests/builds only —"
  echo "    it does not deploy, and Vercel git-integration auto-deploy is not"
  echo "    relied on here (remote builds are flaky for this monorepo). Running"
  echo "    the real manual Vercel deploy now."
  echo ""
  echo "==> Installing dependencies & building..."
  npm install --no-fund --no-audit
  npm run build

  deploy_vercel "landing (magicboxai.in)" "apps/landing"
  deploy_vercel "web (app.magicboxai.in)" "apps/web"
  deploy_vercel "admin (admin.magicboxai.in)" "apps/admin"

  echo ""
  echo "✔ Deploy complete."
  echo "  Landing: https://magicboxai.in"
  echo "  App:     https://app.magicboxai.in"
  echo "  Admin:   https://admin.magicboxai.in"
}

if [[ "$SKIP_PUSH" -eq 0 ]]; then
  push_to_github
else
  echo "==> Step 1: push to GitHub (skipped via --skip-push)"
fi

if [[ "$SKIP_DEPLOY" -eq 0 ]]; then
  run_manual_deploy
else
  echo ""
  echo "==> Step 2: deploy (skipped via --skip-deploy)"
fi
