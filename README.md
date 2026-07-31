# MagicBox

MagicBox is an AI marketing automation platform for brand-aware content generation, approval, scheduling, and direct publishing.

## Canonical Documentation

- **Launch Plan & Release Gates:** [`LAUNCH_PLAN.md`](./LAUNCH_PLAN.md) — The single source of truth for launch status, gates G0–G9, and task ownership.
- **Architecture & System Context:** [`Context.MD`](./Context.MD) — Verified technical architecture, monorepo layout, database design, and Convex migration strategy.
- **Go-To-Market Strategy:** [`GTM_PLAN.md`](./GTM_PLAN.md) — Product positioning, target customer segments (India, US, UK), outreach, and feedback loops.
- **Production Deployment Runbook:** [`PRODUCTION.md`](./PRODUCTION.md) — Step-by-step deploy sequence for web, landing, admin, and Cloud Functions.
- **Firebase & Security Setup:** [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) — App Check configuration, Firestore rules, and secrets setup.
- **Channel OAuth Setup:** [`CHANNELS_SETUP.md`](./CHANNELS_SETUP.md) — Meta, LinkedIn, and Google API registration and verification steps.
- **Security Audit:** [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) — Hardening audit, SSRF protection, token security, and vulnerability mitigations.
- **AI System Prompts:** [`SYSTEM_PROMPTS.md`](./SYSTEM_PROMPTS.md) — Prompt reference for Gemini copy rewrite and media generation.

## Quick Verification

```bash
npm install
npm run typecheck
npm test
npm run build
```
