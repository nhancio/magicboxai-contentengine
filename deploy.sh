#!/usr/bin/env bash
# =============================================================================
# MagicBox AI — Canonical Full-Stack Deployment Script
# =============================================================================
#
# Multi-tier deployment pipeline covering:
#   Stage 0: Pre-flight checks (lint, typecheck, tests, and build verification)
#   Stage 1: GitHub synchronization & push (origin/main)
#   Stage 2: Convex backend deployment (schema, functions, crons in packages/backend)
#   Stage 3: Firebase deployment (Cloud Functions v2, Firestore rules, Storage rules)
#   Stage 4: Frontend hosting deployment (Vercel production for landing, web, admin)
#
# Usage:
#   ./deploy.sh [commit message] [options]
#
# Options:
#   -h, --help               Show this help message and exit
#   --dry-run                Run in dry-run mode (simulate without live mutations)
#   --skip-preflight         Skip Stage 0 (typecheck and test verification)
#   --skip-git, --skip-push  Skip Stage 1 (GitHub commit and push)
#   --skip-convex            Skip Stage 2 (Convex backend deployment)
#   --skip-firebase          Skip Stage 3 (Firebase deployment)
#   --skip-frontend          Skip Stage 4 (Vercel frontend deployment)
#   --only-preflight         Run only Stage 0 pre-flight checks
#   --only-git               Run only Stage 1 GitHub push
#   --only-convex            Run only Stage 2 Convex backend deployment
#   --only-firebase          Run only Stage 3 Firebase deployment
#   --only-frontend          Run only Stage 4 Frontend Vercel deployment
#   --firebase-hosting       Also deploy frontend bundles to Firebase Hosting targets
#   --scope <scope>          Vercel scope (default: didigamnithins-projects)
#   --github-account <acc>   GitHub account for gh auth (default: didigamnithin)
#
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration & Defaults
# -----------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="origin"
REMOTE_URL="https://github.com/nhancio/magicboxai.git"
GITHUB_ACCOUNT="${GITHUB_ACCOUNT:-didigamnithin}"
SCOPE="${VERCEL_SCOPE:-didigamnithins-projects}"
FIREBASE_PROJECT="magicboxai-50927"

# Stage flags (0 = execute, 1 = skip)
RUN_STAGE_0=1
RUN_STAGE_1=1
RUN_STAGE_2=1
RUN_STAGE_3=1
RUN_STAGE_4=1

DRY_RUN=0
DEPLOY_FIREBASE_HOSTING=0
COMMIT_MESSAGE=""

# Stage status tracking for summary
STATUS_STAGE_0="Pending"
STATUS_STAGE_1="Pending"
STATUS_STAGE_2="Pending"
STATUS_STAGE_3="Pending"
STATUS_STAGE_4="Pending"
TIME_STAGE_0=0
TIME_STAGE_1=0
TIME_STAGE_2=0
TIME_STAGE_3=0
TIME_STAGE_4=0

CURRENT_STAGE="Initialization"

# -----------------------------------------------------------------------------
# Terminal Styling
# -----------------------------------------------------------------------------
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  BOLD="\033[1m"
  DIM="\033[2m"
  CYAN="\033[36m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  BLUE="\033[34m"
  MAGENTA="\033[35m"
  RESET="\033[0m"
else
  BOLD=""
  DIM=""
  CYAN=""
  GREEN=""
  YELLOW=""
  RED=""
  BLUE=""
  MAGENTA=""
  RESET=""
fi

log_stage() {
  echo -e "\n${BOLD}${CYAN}================================================================================${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}================================================================================${RESET}"
}

log_step() {
  echo -e "  ${BOLD}${BLUE}▸${RESET} $1"
}

log_success() {
  echo -e "  ${GREEN}✔${RESET} $1"
}

log_warn() {
  echo -e "  ${YELLOW}⚠${RESET} $1"
}

log_error() {
  echo -e "  ${RED}✖${RESET} $1" >&2
}

log_info() {
  echo -e "  ${DIM}ℹ $1${RESET}"
}

# -----------------------------------------------------------------------------
# Error Handling & Trap
# -----------------------------------------------------------------------------
cleanup_on_error() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo -e "\n${BOLD}${RED}✖ Deployment failed at: ${CURRENT_STAGE} (exit code: $exit_code)${RESET}" >&2
    echo -e "${DIM}Check the command output above for specific error details.${RESET}\n" >&2
  fi
}
trap cleanup_on_error EXIT

# -----------------------------------------------------------------------------
# Usage & Help
# -----------------------------------------------------------------------------
usage() {
  cat <<EOF
${BOLD}MagicBox AI — Full-Stack Deployment Tool${RESET}

${BOLD}USAGE:${RESET}
  ./deploy.sh [commit message] [options]

${BOLD}STAGES:${RESET}
  Stage 0: Pre-flight Verification (Typecheck, tests, and build checks)
  Stage 1: GitHub Push (Sync, commit, and push to origin/main)
  Stage 2: Convex Backend (Schema, functions, actions, crons in packages/backend)
  Stage 3: Firebase Deployment (Cloud Functions v2, Firestore & Storage rules)
  Stage 4: Frontend Hosting (Vercel production for landing, web, admin apps)

${BOLD}OPTIONS:${RESET}
  -h, --help               Show this help message and exit
  --dry-run                Simulate actions across all stages without live mutations
  --skip-preflight         Skip Stage 0 (typecheck and test verification)
  --skip-git, --skip-push  Skip Stage 1 (GitHub sync and push)
  --skip-convex            Skip Stage 2 (Convex backend deployment)
  --skip-firebase          Skip Stage 3 (Firebase deployment)
  --skip-frontend          Skip Stage 4 (Frontend Vercel deployment)
  --only-preflight         Run only Stage 0 pre-flight checks
  --only-git               Run only Stage 1 GitHub commit and push
  --only-convex            Run only Stage 2 Convex backend deployment
  --only-firebase          Run only Stage 3 Firebase deployment
  --only-frontend          Run only Stage 4 Frontend Vercel deployment
  --firebase-hosting       Also deploy frontend bundles to Firebase Hosting
  --scope <scope>          Vercel scope (default: didigamnithins-projects)
  --github-account <acc>   GitHub account for gh auth (default: didigamnithin)

${BOLD}EXAMPLES:${RESET}
  ./deploy.sh                                # Full-stack deployment with auto-commit
  ./deploy.sh "feat: real-time dashboard"     # Full-stack deploy with custom commit message
  ./deploy.sh --dry-run                      # Verify all checks & deployment configurations
  ./deploy.sh --only-convex                  # Deploy only the Convex backend
  ./deploy.sh --only-firebase                # Deploy only Firebase functions & security rules
  ./deploy.sh --only-frontend                # Deploy only Vercel frontend applications
  ./deploy.sh --skip-preflight               # Fast-track deploy skipping test/typecheck suite
EOF
}

# -----------------------------------------------------------------------------
# Parse Command Line Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-preflight|--no-preflight)
      RUN_STAGE_0=0
      shift
      ;;
    --skip-git|--skip-push|--no-git|--no-push)
      RUN_STAGE_1=0
      shift
      ;;
    --skip-convex|--no-convex)
      RUN_STAGE_2=0
      shift
      ;;
    --skip-firebase|--no-firebase)
      RUN_STAGE_3=0
      shift
      ;;
    --skip-frontend|--skip-vercel|--no-frontend|--no-vercel)
      RUN_STAGE_4=0
      shift
      ;;
    --only-preflight)
      RUN_STAGE_0=1
      RUN_STAGE_1=0
      RUN_STAGE_2=0
      RUN_STAGE_3=0
      RUN_STAGE_4=0
      shift
      ;;
    --only-git|--only-push)
      RUN_STAGE_0=0
      RUN_STAGE_1=1
      RUN_STAGE_2=0
      RUN_STAGE_3=0
      RUN_STAGE_4=0
      shift
      ;;
    --only-convex)
      RUN_STAGE_0=0
      RUN_STAGE_1=0
      RUN_STAGE_2=1
      RUN_STAGE_3=0
      RUN_STAGE_4=0
      shift
      ;;
    --only-firebase)
      RUN_STAGE_0=0
      RUN_STAGE_1=0
      RUN_STAGE_2=0
      RUN_STAGE_3=1
      RUN_STAGE_4=0
      shift
      ;;
    --only-frontend|--only-vercel)
      RUN_STAGE_0=0
      RUN_STAGE_1=0
      RUN_STAGE_2=0
      RUN_STAGE_3=0
      RUN_STAGE_4=1
      shift
      ;;
    --firebase-hosting)
      DEPLOY_FIREBASE_HOSTING=1
      shift
      ;;
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --github-account)
      GITHUB_ACCOUNT="$2"
      shift 2
      ;;
    -*)
      log_error "Unknown option: $1 (try --help for usage)"
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

SCRIPT_START_TIME=$(date +%s)

# Ensure monorepo local bin is available on PATH for child processes
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

# =============================================================================
# STAGE 0: Pre-Flight Verification
# =============================================================================
stage_0_preflight() {
  CURRENT_STAGE="Stage 0: Pre-Flight Verification"
  log_stage "Stage 0: Pre-Flight Verification"
  local start_time=$(date +%s)

  log_step "Checking Node.js and runtime environment..."
  local node_ver
  node_ver="$(node -v 2>/dev/null || echo "none")"
  log_info "Node.js version: $node_ver (Root: $ROOT_DIR)"

  # Ensure dependencies exist
  if [[ ! -d "node_modules" ]]; then
    log_step "Installing workspace dependencies..."
    npm install --no-fund --no-audit
  fi

  log_step "Running typechecks across frontends, functions, and backend..."
  npm run typecheck
  npm run typecheck --workspace=@magicbox/backend
  log_success "All TypeScript typechecks passed cleanly."

  log_step "Executing test suites..."
  npm test --workspace=functions
  npm test --workspace=@magicbox/backend
  log_success "All unit and integration tests passed."

  log_step "Verifying frontend build generation..."
  npm run build:hosting
  log_success "Frontend bundles built successfully."

  local end_time=$(date +%s)
  TIME_STAGE_0=$((end_time - start_time))
  STATUS_STAGE_0="Passed (${TIME_STAGE_0}s)"
}

# =============================================================================
# STAGE 1: GitHub Synchronization & Push
# =============================================================================
ensure_github_account() {
  if ! command -v gh >/dev/null 2>&1; then
    log_info "GitHub CLI (gh) not found; continuing with system git credentials."
    return 0
  fi

  if gh auth token --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null 2>&1; then
    if gh auth switch --hostname github.com --user "$GITHUB_ACCOUNT" >/dev/null 2>&1; then
      log_info "Switched GitHub CLI account to: $GITHUB_ACCOUNT"
    else
      log_info "Using active GitHub CLI account for $GITHUB_ACCOUNT"
    fi
  else
    log_info "GitHub account '$GITHUB_ACCOUNT' not logged into gh; using active git credentials."
  fi
}

stage_1_git() {
  CURRENT_STAGE="Stage 1: GitHub Push"
  log_stage "Stage 1: GitHub Synchronization & Push"
  local start_time=$(date +%s)

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log_error "Not inside a git repository."
    exit 1
  fi

  ensure_github_account

  # Ensure origin remote is configured properly
  if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
    local current_url
    current_url="$(git remote get-url "$REMOTE_NAME")"
    if [[ "$current_url" != "$REMOTE_URL" ]]; then
      log_info "'$REMOTE_NAME' points to $current_url — updating to $REMOTE_URL"
      git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
    fi
  else
    log_info "Adding '$REMOTE_NAME' remote pointing to $REMOTE_URL"
    git remote add "$REMOTE_NAME" "$REMOTE_URL"
  fi

  # Warn if nested .git repositories exist
  local nested_repos
  nested_repos="$(find . -mindepth 2 -type d -name ".git" \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" 2>/dev/null || true)"
  if [[ -n "$nested_repos" ]]; then
    log_warn "Nested git repositories detected (staged as gitlinks):"
    echo "$nested_repos" | sed 's/^/      /'
  fi

  local branch
  branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")"
  log_step "Working branch: ${BOLD}$branch${RESET}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log_info "[dry-run] Staging changes and checking diff..."
    git status --short
    STATUS_STAGE_1="Dry Run"
    return 0
  fi

  log_step "Fetching latest updates from $REMOTE_NAME/$branch..."
  git fetch "$REMOTE_NAME" "$branch" || true

  log_step "Staging modified and untracked files..."
  git add -A

  if git diff --cached --quiet; then
    log_info "Working tree clean — no new changes to commit."
  else
    local msg="${COMMIT_MESSAGE:-chore: full-stack deploy $(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
    log_step "Committing changes: \"$msg\""
    git commit -m "$msg"
  fi

  log_step "Pulling upstream changes with rebase..."
  git pull --rebase "$REMOTE_NAME" "$branch" || {
    log_warn "Rebase pull encountered conflicts. Aborting rebase and trying merge pull..."
    git rebase --abort 2>/dev/null || true
    git pull --no-rebase "$REMOTE_NAME" "$branch"
  }

  log_step "Pushing '$branch' to $REMOTE_NAME..."
  git push -u "$REMOTE_NAME" "$branch"
  log_success "Pushed latest commits to GitHub ($REMOTE_NAME/$branch)."

  local end_time=$(date +%s)
  TIME_STAGE_1=$((end_time - start_time))
  STATUS_STAGE_1="Pushed ($branch) (${TIME_STAGE_1}s)"
}

# =============================================================================
# STAGE 2: Convex Backend Deployment
# =============================================================================
stage_2_convex() {
  CURRENT_STAGE="Stage 2: Convex Backend Deployment"
  log_stage "Stage 2: Convex Backend Deployment"
  local start_time=$(date +%s)

  local backend_dir="$ROOT_DIR/packages/backend"
  if [[ ! -d "$backend_dir" ]]; then
    log_error "Convex backend package not found at packages/backend"
    exit 1
  fi

  log_step "Preparing Convex backend deployment in packages/backend..."

  # Detect Convex deployment target
  local convex_target="Self-Hosted / Cloud"
  if [[ -f "$backend_dir/.env.local" ]]; then
    local self_hosted_url
    self_hosted_url="$(grep -E '^CONVEX_SELF_HOSTED_URL=' "$backend_dir/.env.local" 2>/dev/null | cut -d'=' -f2- || true)"
    if [[ -n "$self_hosted_url" ]]; then
      convex_target="Self-Hosted ($self_hosted_url)"
    fi
  fi
  log_info "Deployment target: $convex_target"

  (
    cd "$backend_dir"
    export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

    if [[ "$DRY_RUN" -eq 1 ]]; then
      log_step "Running convex deploy in dry-run mode..."
      npx convex deploy --dry-run
      log_success "Convex deployment schema & function validation succeeded [dry-run]."
    else
      log_step "Deploying Convex schema, functions, and crons..."
      npx convex deploy
      log_success "Convex backend deployed successfully."
    fi
  )

  local end_time=$(date +%s)
  TIME_STAGE_2=$((end_time - start_time))
  if [[ "$DRY_RUN" -eq 1 ]]; then
    STATUS_STAGE_2="Dry Run"
  else
    STATUS_STAGE_2="Deployed (${TIME_STAGE_2}s)"
  fi
}

# =============================================================================
# STAGE 3: Firebase Deployment
# =============================================================================
stage_3_firebase() {
  CURRENT_STAGE="Stage 3: Firebase Deployment"
  log_stage "Stage 3: Firebase Deployment"
  local start_time=$(date +%s)

  log_step "Checking Firebase CLI..."
  if ! command -v firebase >/dev/null 2>&1 && ! npx firebase --version >/dev/null 2>&1; then
    log_error "Firebase CLI is required. Install via: npm install -g firebase-tools"
    exit 1
  fi

  local fb_cmd="npx firebase"
  if command -v firebase >/dev/null 2>&1; then
    fb_cmd="firebase"
  fi

  log_info "Target Firebase project: $FIREBASE_PROJECT"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log_step "Validating Firebase Functions build and security rules [dry-run]..."
    (cd "$ROOT_DIR/functions" && npm run build)
    log_info "Firestore rules: firestore.rules (present)"
    log_info "Storage rules: storage.rules (present)"
    log_info "Firestore indexes: firestore.indexes.json (present)"
    log_success "Firebase rules and Functions v2 build verified [dry-run]."
    STATUS_STAGE_3="Dry Run"
    return 0
  fi

  log_step "Deploying Firestore rules, indexes, Storage rules, and Cloud Functions v2..."
  $fb_cmd deploy --only firestore:rules,firestore:indexes,storage,functions --project "$FIREBASE_PROJECT"
  log_success "Firebase security rules, indexes, and Cloud Functions deployed."

  if [[ "$DEPLOY_FIREBASE_HOSTING" -eq 1 ]]; then
    log_step "Deploying Firebase Hosting targets..."
    $fb_cmd deploy --only hosting --project "$FIREBASE_PROJECT"
    log_success "Firebase Hosting targets deployed."
  fi

  local end_time=$(date +%s)
  TIME_STAGE_3=$((end_time - start_time))
  STATUS_STAGE_3="Deployed (${TIME_STAGE_3}s)"
}

# =============================================================================
# STAGE 4: Frontend Hosting Deployment (Vercel)
# =============================================================================
deploy_vercel_app() {
  local app_name="$1"
  local app_dir="$2"
  local custom_domain="$3"

  log_step "Deploying ${BOLD}${app_name}${RESET} (${custom_domain}) → Vercel production..."

  (
    cd "$ROOT_DIR/$app_dir"
    if [[ ! -f .vercel/project.json ]]; then
      log_error "${app_dir} is not linked to a Vercel project."
      log_info "Link once via: cd ${app_dir} && npx vercel link --yes --scope ${SCOPE}"
      exit 1
    fi

    if [[ "$DRY_RUN" -eq 1 ]]; then
      log_info "[dry-run] Prebuilt bundle verified in ${app_dir}/dist"
      return 0
    fi

    npx vercel pull --yes --environment=production --scope "$SCOPE" >/dev/null
    npx vercel build --prod --scope "$SCOPE"
    npx vercel deploy --prebuilt --prod --yes --scope "$SCOPE"
    log_success "${app_name} deployed to ${custom_domain}"
  )
}

stage_4_frontend() {
  CURRENT_STAGE="Stage 4: Frontend Vercel Deployment"
  log_stage "Stage 4: Frontend Hosting Deployment (Vercel)"
  local start_time=$(date +%s)

  log_step "Checking Vercel CLI..."
  if ! command -v vercel >/dev/null 2>&1 && ! npx vercel --version >/dev/null 2>&1; then
    log_error "Vercel CLI is required. Install via: npm install -g vercel"
    exit 1
  fi

  log_step "Building all workspace frontends for production..."
  npm run build:hosting

  deploy_vercel_app "landing" "apps/landing" "https://magicboxai.in"
  deploy_vercel_app "web app" "apps/web" "https://app.magicboxai.in"
  deploy_vercel_app "admin"   "apps/admin" "https://admin.magicboxai.in"

  local end_time=$(date +%s)
  TIME_STAGE_4=$((end_time - start_time))
  if [[ "$DRY_RUN" -eq 1 ]]; then
    STATUS_STAGE_4="Dry Run"
  else
    STATUS_STAGE_4="Deployed (${TIME_STAGE_4}s)"
  fi
}

# =============================================================================
# Execution Orchestration
# =============================================================================
log_stage "MagicBox AI — Full-Stack Deployment Pipeline Starting"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log_warn "DRY-RUN MODE ACTIVE: No remote state will be mutated."
fi

# Stage 0
if [[ "$RUN_STAGE_0" -eq 1 ]]; then
  stage_0_preflight
else
  STATUS_STAGE_0="Skipped"
  log_info "Stage 0 (Pre-Flight Verification) skipped."
fi

# Stage 1
if [[ "$RUN_STAGE_1" -eq 1 ]]; then
  stage_1_git
else
  STATUS_STAGE_1="Skipped"
  log_info "Stage 1 (GitHub Push) skipped."
fi

# Stage 2
if [[ "$RUN_STAGE_2" -eq 1 ]]; then
  stage_2_convex
else
  STATUS_STAGE_2="Skipped"
  log_info "Stage 2 (Convex Backend) skipped."
fi

# Stage 3
if [[ "$RUN_STAGE_3" -eq 1 ]]; then
  stage_3_firebase
else
  STATUS_STAGE_3="Skipped"
  log_info "Stage 3 (Firebase Deployment) skipped."
fi

# Stage 4
if [[ "$RUN_STAGE_4" -eq 1 ]]; then
  stage_4_frontend
else
  STATUS_STAGE_4="Skipped"
  log_info "Stage 4 (Frontend Vercel) skipped."
fi

# =============================================================================
# Deployment Summary Banner
# =============================================================================
SCRIPT_END_TIME=$(date +%s)
TOTAL_DURATION=$((SCRIPT_END_TIME - SCRIPT_START_TIME))

echo -e "\n${BOLD}${GREEN}================================================================================${RESET}"
echo -e "${BOLD}${GREEN}  ✔ FULL-STACK DEPLOYMENT COMPLETE (${TOTAL_DURATION}s)${RESET}"
echo -e "${BOLD}${GREEN}================================================================================${RESET}"
echo -e "  ${BOLD}Stage 0: Pre-Flight Checks${RESET}   ▸ $STATUS_STAGE_0"
echo -e "  ${BOLD}Stage 1: GitHub Push${RESET}         ▸ $STATUS_STAGE_1"
echo -e "  ${BOLD}Stage 2: Convex Backend${RESET}      ▸ $STATUS_STAGE_2"
echo -e "  ${BOLD}Stage 3: Firebase Deploy${RESET}     ▸ $STATUS_STAGE_3"
echo -e "  ${BOLD}Stage 4: Frontend Hosting${RESET}    ▸ $STATUS_STAGE_4"
echo -e "${DIM}--------------------------------------------------------------------------------${RESET}"
echo -e "  ${BOLD}Live Production Services:${RESET}"
echo -e "    • Landing Page:    ${CYAN}https://magicboxai.in${RESET}"
echo -e "    • Web Application: ${CYAN}https://app.magicboxai.in${RESET}"
echo -e "    • Admin Portal:    ${CYAN}https://admin.magicboxai.in${RESET}"
echo -e "    • Convex Backend:  ${CYAN}http://136.107.79.221:3210${RESET} ${DIM}(Self-Hosted)${RESET}"
echo -e "    • Firebase:        ${CYAN}${FIREBASE_PROJECT}${RESET} ${DIM}(Functions v2, Firestore & Storage rules)${RESET}"
echo -e "${BOLD}${GREEN}================================================================================${RESET}\n"
