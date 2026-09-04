# Changelog

All notable changes to the MagicBox AI platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-21

### 🚀 Welcome to MagicBox 1.0 — The AI Vibe Marketing & UGC Distribution Engine

We are thrilled to announce the official **1.0.0 General Availability** release of MagicBox! MagicBox 1.0 transforms how founders, creators, agencies, and marketing teams create, approve, and distribute on-brand social content across all major social networks.

---

### ✨ Major Features & Highlights

#### 🧠 Maya 1.0 — Autonomous AI Marketing Agent & Autopilot
- **Website Brand Intelligence**: Maya analyzes your domain/landing page to extract brand positioning, value propositions, target audience demographics, color palette, and visual identity.
- **Tinder-Style Content Approval**: Review AI-generated posts effortlessly with quick swipe actions — approve, reject, edit, or regenerate on the fly.
- **Autopilot Schedule Execution**: Approved posts seamlessly flow into your publishing queue and post at peak engagement times automatically.
- **Adaptive Copywriter**: Channel-optimized copy generation powered by Gemini, crafting tailored hooks, hashtags, and formats for each platform.

#### 🌐 Unified Multi-Channel Social Integrations
- **Instagram**: Direct publishing for feed images, multi-image carousels, and Instagram Reels with full aspect ratio support (1:1, 4:5, 9:16).
- **LinkedIn**: Thought leadership posts, single/multi-image carousels, company page and personal profile publishing.
- **YouTube**: Direct video publishing for YouTube Shorts and landscape long-form videos with automated metadata, tags, and thumbnails.
- **Facebook**: Page publishing with instant media uploads and scheduled broadcasts.
- **WhatsApp**: Broadcast announcements and customer engagement channel integration.
- **OAuth 2.0 Security**: Direct, verified OAuth flows with encrypted server-side token storage and zero browser token leakage.

#### 🎨 Creative Studio & Media Generation Suite
- **Single & Multi-Slide Carousels**: Create branded, swipeable carousels with layered typography, brand badges, and exportable slide templates.
- **AI Image Generation**: Integrated with Google Imagen 3 for ultra-realistic product scenes, background replacements, and marketing creatives.
- **AI Video & UGC Engine**: Google Veo integration combined with Remotion dynamic video compositing for short-form video ads, testimonials, and feature highlights.
- **UGC Copy Rewriter**: Transform plain product announcements into high-converting founder POV or customer UGC hooks with one click.

#### 🏷️ Brand Kit & Voice Engine
- **Centralized Assets**: Upload logos, custom font pairings, hex palettes, and brand guidelines.
- **Persona & Tone Controls**: Choose from predefined brand voices (Professional, Playful, Bold, Minimal, Luxury) or train custom brand personalities.
- **Brand Guardrails**: Ensures all generations consistently conform to your visual identity and compliance rules.

#### 📅 Content Calendar & Automation Engine
- **Interactive Visual Calendar**: Drag-and-drop schedule management with month, week, and day views.
- **Automations Engine**: Configure one-time campaigns or set recurring automation rules (e.g. 3x weekly product tips, daily motivation, weekend promotions).
- **Draft & Template Library**: Centralized asset repository to save, tag, and reuse high-performing templates and drafts.

#### ⚡ Real-Time Architecture Powered by Convex
- **Reactive State**: Instant UI updates with zero manual refreshes — approve a post on desktop and watch it update immediately across all devices.
- **Tenant Isolation**: Secure, multi-tenant database layer ensuring complete data segregation and strict access control.
- **High-Throughput Scheduling**: Distributed job pipeline with guaranteed execution, retry handling, and error diagnostics.

#### 💳 AI Credits & Billing Ledger
- **Unified Credit System**: Clear separation between `i-credits` (image and text generation) and `v-credits` (video seconds).
- **7-Day Free Trial**: Get started immediately with 50 i-credits and 100 v-credits on signup.
- **Self-Service Subscriptions**: Pro ($29/mo or $23/mo billed annually) and Max ($149/mo) plans with instant customer portal management via Dodo Payments.

---

### 🛠️ Improvements & Hardening
- **Performance**: Static server-side prerendering on public landing pages for sub-second initial load and pristine Core Web Vitals (LCP < 1.2s, CLS = 0).
- **Mobile First**: Fully responsive dashboard, mobile drawer navigation, touch-optimized Maya swipe cards, and deep-link social profile redirection.
- **Error Handling**: Granular channel connection diagnostics, friendly OAuth error states, and automatic reconnection prompts.
- **Security**: Strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and App Check protection.

---

### 📦 Release Versioning
- `magicboxai` (Root Monorepo): `1.0.0`
- `magicbox-web` (User Dashboard App): `1.0.0`
- `magicbox-landing` (Marketing & Landing): `1.0.0`
- `magicbox-admin` (Administrative Console): `1.0.0`
- `@magicbox/backend` (Convex Core Backend): `1.0.0`
- `functions` (Cloud Functions Services): `1.0.0`
