# MagicBox AI — production readiness checklist

**Purpose:** Track everything needed before this product is safe and reliable in production.

**Maintenance rule:** Whenever we ship a meaningful change (auth, security, deploy, data model, env vars, legal, etc.), **update this file** — check items off, add new ones, or move completed work to a “Done” section with dates.

---

## Security & authentication

| Status | Item |
|--------|------|
| [ ] | **Admin panel:** Replace hardcoded `admin123` / `admin123` with real auth (e.g. Firebase Auth with admin-only custom claims, or separate IdP + RBAC). |
| [ ] | **Admin session:** Move off “localStorage-only” if needed; consider httpOnly cookies or Firebase session with refresh + secure flags on production domains. |
| [ ] | **Firestore rules:** Deploy strict production rules (users own their docs; admin reads via Cloud Functions or custom claims — avoid wide-open `read, write` for `influencers` / `ads`). |
| [ ] | **Storage rules:** Lock down uploads/downloads; no public buckets unless intentional; align with Cloud Function paths (`users/{uid}/...`). |
| [ ] | **API keys:** Ensure no secrets in client bundles; OpenAI only in Cloud Functions secrets / server-side. |
| [ ] | **Authorized domains:** Add production domains in Firebase Console → Authentication → Settings. |
| [ ] | **CORS / callable functions:** Review `generateImage` (and any future functions) for allowed origins and abuse protection. |

---

## Firebase & backend

| Status | Item |
|--------|------|
| [ ] | **Production Firebase project:** Separate from dev/staging (recommended) or use distinct Firebase apps + env per environment. |
| [ ] | **`.env` on CI/hosting:** Configure `VITE_*` vars in Vercel/Netlify/Cloudflare (never commit `.env`). |
| [ ] | **Firestore indexes:** Create all composite indexes required by queries (console links from runtime errors). |
| [ ] | **Cloud Functions:** Deploy `functions/`; set `OPENAI_API_KEY` via `firebase functions:secrets:set`; verify billing and quotas. |
| [ ] | **Function hardening:** Rate limits, payload validation, cost caps, monitoring for `generateImage`. |
| [ ] | **Backups / export:** Optional scheduled Firestore exports for disaster recovery. |

---

## Apps: web, admin, landing

| Status | Item |
|--------|------|
| [ ] | **Error boundaries & UX:** User-friendly errors when Firebase is down or quota exceeded; avoid silent failures. |
| [ ] | **Loading / empty states:** Consistent across dashboards, library, avatars, ads. |
| [ ] | **Remove or gate “demo” flows:** e.g. Admin “reset demo data” / demo copy — disable or protect in production. |
| [ ] | **Landing:** Production SEO (meta, OG tags, sitemap, analytics consent if EU traffic). |
| [ ] | **PWA / offline (optional):** Only if product requires it. |

---

## Build, deploy & operations

| Status | Item |
|--------|------|
| [ ] | **DNS & TLS:** `magicboxai.in`, `app.*`, `admin.*` with valid HTTPS. |
| [ ] | **Hosting:** Deploy all three Vite apps (landing, web, admin) with correct env per app. |
| [ ] | **CI pipeline:** Lint + `tsc` + build for each app on PR; block merge on failure. |
| [ ] | **Versioning / changelog:** Tag releases; document breaking changes. |
| [ ] | **Monitoring:** Firebase Crashlytics (if mobile later), web vitals, error reporting (e.g. Sentry), uptime checks. |
| [ ] | **Logging:** Structured logs for Functions; avoid PII in logs. |

---

## Legal, privacy & compliance

| Status | Item |
|--------|------|
| [ ] | **Privacy policy** (data: Firebase, Google sign-in, OpenAI, analytics). |
| [ ] | **Terms of service** (acceptable use, generated content, liability). |
| [ ] | **Cookie / consent banner** if using non-essential cookies or certain analytics (esp. EU/UK). |
| [ ] | **DPA / subprocessors** if selling B2B or handling EU personal data at scale. |

---

## Quality & testing

| Status | Item |
|--------|------|
| [ ] | **Unit tests** for critical `shared/lib` (Firestore helpers, auth helpers). |
| [ ] | **E2E smoke tests** (login, one core flow per app) — Playwright or Cypress. |
| [ ] | **`npm audit`:** Address high/critical vulnerabilities; document accepted risks. |
| [ ] | **Accessibility:** Keyboard nav and contrast on main flows (WCAG target). |

---

## Performance & cost

| Status | Item |
|--------|------|
| [ ] | **Bundle size:** Analyze Vite build output; lazy-load heavy routes. |
| [ ] | **Firestore reads/writes:** Audit hot paths; pagination for admin lists. |
| [ ] | **Image CDN / resizing:** If serving many large images from Storage. |
| [ ] | **Firebase & OpenAI budgets:** Alerts in Google Cloud + OpenAI usage caps. |

---

## Documentation (keep in sync with code)

| Status | Item |
|--------|------|
| [ ] | **README:** Deploy URLs, env var list, run scripts (`run_*.sh`). |
| [ ] | **FIREBASE_SETUP.md:** Update if rules, functions, or env names change. |
| [ ] | **This file (`nxtsteps.md`):** Update after each production-related change. |

---

## Done (move items here when finished)

_Format: `- [x] YYYY-MM-DD — short description`_

_(None yet.)_

---

## Quick reference — env vars (web & admin)

See `.env.example` and `FIREBASE_SETUP.md`. Production hosting must inject:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Add new `VITE_*` variables to **`.env.example`**, **README**, **FIREBASE_SETUP.md** (if relevant), and **this checklist** when introduced.
