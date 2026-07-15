# MagicBox — Launch Readiness

Living checklist for going live. ✅ done · 🟡 needs your input · 🔴 blocked/todo.
Last updated: 2026-07-14.

## 1. Analytics & tracking
- ✅ **PostHog** wired into web + landing (`shared/lib/analytics.ts`) with autocapture + SPA pageviews + identify.
- ✅ **Consent-gated (GDPR)** — analytics only starts after the user accepts the cookie banner (`shared/components/ConsentBanner.tsx`); "Decline" keeps it off permanently.
- 🟡 **Needs a PostHog project API key** — set `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST`) in hosting env and redeploy. Until then the module safely no-ops.

## 2. SEO / indexing
- ✅ Landing: `robots.txt` (allow) + `sitemap.xml`; app + admin disallow.
- ✅ Landing `<title>`, description, og:title/og:description.
- ✅ og:image, Twitter card, and JSON-LD (SoftwareApplication + Organization) added to the landing.
- 🔴 After launch: submit the sitemap in Google Search Console.

## 3. Security protocols
- ✅ Secrets server-side only (Dodo, Brevo, OAuth creds in functions env/Secret Manager).
- ✅ Firestore rules — per-user ownership; `socialTokens` fully locked (`allow read,write: if false`).
- ✅ OAuth state HMAC-signed; open-redirect guarded (relative paths only).
- ✅ Payments via Dodo (merchant of record); webhook signature verified.
- ✅ **Storage rules audited** — writes restricted to `users/{uid}/**` with a 10 MB cap; generated post media is written server-side by functions (admin SDK); public assets read-only.
- ✅ **Token expiry handled** — YouTube tokens auto-refresh; expired IG/LinkedIn accounts are marked `expired` so the UI can prompt reconnect.
- 🔴 App Check (reCAPTCHA) on the callables — still recommended before scale.
- 🔴 Rate limiting on the free generation callables (`generateImage`, `generateScript`).
- 🔴 Rotate the Vercel token shared earlier in chat (vercel.com/account/tokens).

## 4. Legal (terms, privacy, consent)
- ✅ Published: `/terms.html` + `/privacy.html` on the landing, linked in the footer.
- ✅ Cookie/analytics consent banner live in web + landing.
- 🟡 Drafts (`legal/*.md`) still carry placeholders — confirm refund terms + support email and get a lawyer's pass.
- 🟡 Privacy policy must list all processors: Google/Firebase, Dodo, Brevo, PostHog, Meta, LinkedIn, Google/YouTube, Vertex AI (Gemini/Imagen/Veo).

## 5. Payments (Dodo)
- ✅ Checkout (`createDodoCheckout`) + webhook (`dodoWebhook`) deployed; 4 products created.
- 🟡 Create the webhook endpoint in the Dodo dashboard → URL `https://us-central1-magicboxai-50927.cloudfunctions.net/dodoWebhook` → put the signing secret in `DODO_WEBHOOK_SECRET` → redeploy. Without it, payments succeed but plans don't auto-activate.
- 🔴 Verify the Dodo account is activated for live payments (KYC).

## 6. Channels (Instagram / LinkedIn / YouTube)
- ✅ Direct-OAuth code deployed for all three; Connect UI in Onboarding + Settings; Skip available.
- ✅ Publishing: IG image+Reels, LinkedIn text+image, YouTube video upload (with token refresh).
- ✅ Automation pipeline generates captions per platform + Imagen images + Veo video clips.
- 🔴 Register Meta + LinkedIn apps and pass review; create the Google OAuth client and verify the consent screen. Runbook: `CHANNELS_SETUP.md`. (Long pole — weeks.)
- 🟡 YouTube API default quota ≈ 6 uploads/day per project — request an increase before scale.

## 7. Steps to make it usable end-to-end
1. Set `VITE_POSTHOG_KEY` (analytics).
2. Dodo webhook secret + live activation.
3. Confirm legal placeholder details; lawyer review.
4. Enable App Check.
5. Channels: complete Meta/LinkedIn/Google reviews — or launch with the Skip flow and enable later.
6. Smoke test: sign up → onboarding → connect channel → automation → 3 ticks create/generate/publish → subscribe → plan active.

## What I need from you now
1. **PostHog Project API key** (+ US or EU host).
2. **Legal details**: refund terms, support email; then lawyer review.
3. **Dodo**: create the webhook endpoint (URL above), send the signing secret, confirm live activation.
4. **Developer portals**: kick off Meta + LinkedIn app review and create the Google OAuth client (YouTube) — `CHANNELS_SETUP.md` has the step-by-step.
5. Decision: launch **with** channels (wait on reviews) or **without** (Skip flow, enable later)?
