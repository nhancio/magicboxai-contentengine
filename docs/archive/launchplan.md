# MagicBox launch plan

**Prepared:** 24 July 2026  
**Objective:** turn MagicBox into a trustworthy, self-serve revenue product for a narrow initial market, then scale only after activation, retention, support, and unit economics are proven.

## Executive decision

Launch **MagicBox Social Automation** first: one brand brief becomes platform-specific Instagram, LinkedIn, and YouTube drafts; the customer approves, schedules, and publishes them. Sell the reliable workflow and human approval control—not generic “AI agents,” autonomous claims, or a video/UGC product.

The recommended first ideal customer profile (ICP) is a **solo B2B founder or one-person marketer at a service or SaaS business** who publishes on LinkedIn and Instagram, has no content team, and needs three to five credible posts per week. They are a better first fit than agencies: the product is currently strongest for one brand/workspace, and the agency promise would require mature client approvals, reporting, collaboration, and multi-brand controls.

Do **not** launch the legacy avatar/video product, managed-account service, TikTok/X/Threads publishing, agency multi-brand claims, or performance/engagement promises as part of this launch. The code and site already describe several of these as beta, deferred, or unverified.

## Current reality and launch thesis

| What is real now | What is not yet launch-safe | Decision |
| --- | --- | --- |
| Brand-aware copy/images, approval, scheduling, and direct publishing for Instagram, LinkedIn, and YouTube | Video economics, durable video-job recovery, agency workspaces, LinkedIn video, TikTok/X/Threads publishing, managed accounts | Keep the marketing promise narrowly aligned to the first column. |
| Free plan for drafting; Pro at $29/month or $276/year for 60 scheduled posts/month; Max at $149/month or $1,416/year for 300 | The old `PRICING.md` still describes a different free video product and unsupported plan limits | Make the in-product catalogue the sole public price source; show annual totals and renewal terms plainly. |
| Consent-gated PostHog loader and basic pageview/identify plumbing | Funnel events, error monitoring, support operations, and production dashboards | Instrument the funnel before acquiring meaningful traffic. |
| Recent code hardening and high/critical dependency audit pass | Firebase/Vercel console configuration and production deployment remain manual release gates | Complete the security checklist before accepting paid customers. |

### Positioning

**Category:** AI-assisted social publishing workflow for lean B2B teams.  
**Promise:** “Turn one weekly brief into approved, on-brand LinkedIn and Instagram posts—without copying, pasting, or losing control.”  
**Proof required:** a real 10-minute screen recording, real connected test accounts, publishing receipts, and 3–5 verified design-partner stories. Never invent time, engagement, or revenue outcomes.

The research supports a workflow-first position. Recent social-media-manager discussion values planning, captions, suggestions, and scheduling, but also stresses that dependable scheduling and human review matter more than a tool trying to replace strategy. [Discussion](https://www.reddit.com/r/SocialMediaManagers/comments/1ukjoyg/do_social_media_managers_prefer_more_ai_features/) LinkedIn competitors are already making broad “AI agency” and full-autopilot claims; that makes verifiable approval, brand control, and a narrow outcome more defensible. This is an inference from current [agency-workflow discussion](https://www.linkedin.com/posts/postplanify_ai-social-media-management-is-becoming-a-activity-7467896650607493121-AXcZ), not a claimed market fact.

## Non-negotiable launch gates

No paid public launch until every P0 item has a named owner and recorded evidence.

| Priority | Task | Done means | Owner |
| --- | --- | --- | --- |
| P0 | Make the public site truthful | Remove fabricated testimonials, logo marquee, fake “live examples,” `example.com` links, and any unsupported feature/metric. Hide the managed-accounts section until there is a real compliant service, pricing, operations, and legal review. | Product + marketing |
| P0 | Establish one source of truth | Fix README links to the missing `NEXTSTEPS.md`; archive or rewrite stale `LAUNCH.md`, `PRODUCTION.md`, and `PRICING.md` so they cannot contradict the live product or release process. | Product + engineering |
| P0 | Deploy the security controls | Configure Firebase App Check in production, set the Vercel App Check site key, grant the verifier role, deploy Functions/Firestore/Storage rules, rotate exposed/old secrets, and verify the deployment. Follow `SECURITY_AUDIT.md`. | Engineering |
| P0 | Verify money end-to-end | Complete Dodo KYC/live activation, separate test and live credentials/products, register and validate the signed webhook, test checkout, delayed webhook, cancellation, failed renewal, upgrade/downgrade, refund/dispute, and customer portal. A return page is not payment proof. | Founder + engineering |
| P0 | Validate the core journey on production | Run a documented test from sign-up → onboarding → brand brief → three drafts → approval → schedule → publish → receipt/status → paid entitlement. Repeat for each supported channel and a failure/retry path. | QA + engineering |
| P0 | Make publishing recoverable | Add/rehearse recovery for stuck claims, destination-level partial successes, provider idempotency, quota exhaustion, OAuth expiry, and an operator replay/runbook. Do not rely on the UI alone to infer delivery. | Engineering |
| P0 | Make support and legal real | Publish reviewed Terms, Privacy, refund/cancellation terms, processor list, support SLA, and a support route with an owner. Add a public status/incident page or a documented equivalent. | Founder + counsel + support |
| P0 | Measure and alert | Configure PostHog, error tracking, uptime checks, cloud-cost/quota alerts, payment-webhook alerts, and daily review dashboard. | Engineering + growth |
| P0 | Prove product value before scale | Recruit 10–15 design partners; at least 10 complete a first scheduled/published post and at least 5 are willing to pay or have paid after a structured review. | Founder + growth |

### P1: complete in the first 30 days after private launch

- Add an in-app publish history with per-destination status, clear retries, and human-readable error recovery.
- Add support/help content for connecting each channel, permissions, approval, billing, cancellation, and failed posts.
- Improve onboarding so the time-to-value is under 15 minutes for a first draft and under one day for a verified first publish.
- Build a durable cost ledger and separate quota system before enabling video generation broadly.
- Add a real customer case-study format and a permission workflow for quotes, logos, screenshots, and results.
- Add an affiliate/partner attribution system before promising commissions.

## Revenue model and offer

Use the existing catalogue as the starting point; do not invent a second pricing model while the product is being validated.

| Offer | Customer | Price | Job to be done | Guardrail |
| --- | --- | ---: | --- | --- |
| Free | Qualified evaluator | $0; draft/explore only | Experience brand-aware drafts | State clearly that publishing is paid; do not call it a “free trial” unless a timed, publish-capable trial is implemented. |
| Pro | First ICP | $29/month or $276/year | Publish up to 60 posts/month across supported channels | Show “$276 billed annually” beside the $23/month equivalent. |
| Max | Proven high-volume user | $149/month or $1,416/year | Up to 300 posts/month | Sell only after they genuinely need the allowance; do not imply unlimited features. |
| Founding cohort | First 10–15 paying design partners | Existing annual Pro price, optionally with a disclosed fixed discount or service credit | Close the feedback loop and obtain permissioned evidence | Use Dodo only; no manual/off-platform billing or fake scarcity. |

### Conversion design

Customers must opt in to payments. “Automatic paying” should mean an explicit subscription with clear renewal, receipts, cancellation, and customer-portal access—not hidden renewal or coerced billing.

1. Landing visitor chooses **“Create this week’s content plan”**, not a vague “Start free” CTA.
2. Sign-up collects only the information needed to create the first brand brief.
3. Onboarding asks for website/brand context, audience, offer, tone, LinkedIn/Instagram priority, then creates three platform-specific drafts.
4. The activation event is **one post approved and scheduled**; the retained-value event is **a post successfully published**.
5. Let the user see the first complete workflow. At the publish/schedule gate, explain the paid plan, allowance, billing cadence, cancellation, and supported channels in one screen.
6. Send opt-in, behavior-based help: Day 0 setup help; Day 1 brand/brief help; Day 3 approval/schedule help; Day 7 usage review. Stop or change the sequence once activation or purchase occurs.
7. Trigger upgrade prompts only from real intent (a scheduled-post limit, a ready-to-publish calendar, or a requested connected channel), never from dark patterns.

### Revenue milestones (targets, not forecasts)

| Stage | Leading proof | Revenue target | Decision |
| --- | --- | ---: | --- |
| Private alpha | 10 partners complete first publish; support issues are resolved within one business day | 5 paid Pro subscriptions = $145 MRR | Continue only if activation and willingness-to-pay are real. |
| Public beta | 25 paying Pro and 2 Max subscriptions | $1,023 MRR | Start small partnership experiments; keep founder-led sales. |
| Repeatable motion | 75 paying Pro and 5 Max subscriptions, with known acquisition source and early retention | $2,920 MRR | Scale the one channel with verified payback; do not scale all channels at once. |

MRR examples are arithmetic from the public catalogue, not expected results. Gross margin, retention, refund rate, and support burden determine whether the motion is viable.

## 90-day execution plan

### Phase 0 — Truth, reliability, and design partners (weeks 1–2)

1. Finish every P0 gate above and record a release checklist with links to evidence.
2. Replace fake proof with a single honest “private beta” section and a waitlist/application form. Remove all placeholder outbound links.
3. Produce three assets from one real test brand: a 90-second workflow demo, a 30-second short demo, and a written before/after workflow diagram. Use only media the company can legally use and label generated examples honestly.
4. Founder recruits 30 ICP prospects through warm contacts, LinkedIn, founder communities, and relevant agencies; invite 10–15 to a guided design-partner program. Do not scrape, mass-DM, or automate unsolicited outreach.
5. Run a 30-minute onboarding call with each design partner. Observe where they fail; fix the top three failures before inviting the next cohort.
6. Interview every partner after their first publish and after seven days. Ask for the alternative they used, time saved, trust concerns, price sensitivity, and what would make them cancel.

### Phase 1 — Private paid beta (weeks 3–6)

1. Convert willing design partners through the normal Dodo checkout; provide a written founding-cohort agreement/offer.
2. Publish one evidence-led case study only after written permission. Include the workflow, customer context, exact measurement method, and limitations; do not claim a causal engagement or revenue lift without evidence.
3. Ship the top onboarding/reliability fixes weekly. Keep a public changelog and send an honest release email.
4. Begin a two-week content cadence:
   - **LinkedIn:** three founder posts per week: build log, workflow teardown, and customer learning. Comment thoughtfully on 10 relevant ICP posts per day.
   - **Instagram:** three Reels plus one carousel per week showing the brief → draft → approval → schedule workflow, with captions aimed at a one-person marketing team.
   - **X:** two build-in-public posts/threads per week focused on implementation, channel API realities, and a real lesson—not generic “AI will replace your team” claims.
   - **Community:** two useful answers per week in relevant Reddit, Indie Hackers, and founder/marketer communities. Disclose MagicBox affiliation and link only when it directly answers the question.
5. Test one channel at a time with a trackable landing page, one CTA, and one ICP. Examples: `/for-solo-b2b-founders`, `/linkedin-content-workflow`, or a partner-specific page.

### Phase 2 — Public beta launch (weeks 7–8)

1. Launch only after the private cohort can complete the core journey reliably and there are real proof assets.
2. Prepare a Product Hunt draft rather than launching impulsively. Product Hunt requires a live, useful product—not vaporware—and encourages authentic maker participation rather than spam. [Featuring guidance](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines) [Posting guidance](https://help.producthunt.com/en/articles/479557-how-to-post-a-product)
3. Coordinate one launch day:
   - Landing page with a focused headline, live demo, actual pricing, FAQ, legal links, real support route, and one primary CTA.
   - Founder posts on LinkedIn, Instagram, X, and relevant communities using native assets, each with a distinct angle rather than copied text.
   - Email the opt-in waitlist; invite feedback and a limited number of guided setup sessions.
   - Staff support and maker responses for the entire launch window; record objections and conversion failures.
4. Do not buy votes, use engagement pods, impersonate customers, or offer rewards for misleading reviews. Product Hunt explicitly values authentic engagement over spammy campaigns. [Guidance](https://help.producthunt.com/en/articles/11751186-product-of-the-day-week-month)

### Phase 3 — Find one repeatable channel (weeks 9–13)

1. Double down only on the source with the best combination of activated accounts, paid conversions, retained accounts, and support cost—not impressions.
2. Launch a small partner motion: 10 marketing consultants/newsletter operators with audiences matching the ICP. Give each a demo workspace, unique tracked link, clear commission terms, and honest product limitations.
3. Test a low-volume, high-intent search campaign only after analytics can measure activation and paid conversion. Begin with exact/phrase intent such as “LinkedIn content scheduler for founders” and “AI social media approval workflow”; stop terms that create unactivated sign-ups.
4. Use paid social only to amplify a demonstrated customer workflow or case study. Do not use ads to compensate for a broken activation flow.

## Distribution system

### Channel roles

| Channel | Role | Weekly execution | Measurement |
| --- | --- | --- | --- |
| Founder LinkedIn | Primary B2B trust and conversations | 3 original posts; 50–75 thoughtful ICP interactions; 10 personalized invitations or follow-ups maximum per day | Qualified conversations, demos, design-partner applications, activated sign-ups |
| Instagram Reels/Carousels | Demonstrate the product visually | 3 workflow Reels + 1 carousel; use a unique UTM and “Create this week’s plan” CTA | Profile-to-site clicks, waitlist, qualified sign-ups |
| X / build in public | Reach SaaS/AI builders and partners | 2 specific build/learning threads; reply to conversations where technical transparency helps | Partner leads, backlinks, Product Hunt awareness—not vanity followers |
| Google SEO + GEO | Compounding high-intent acquisition | One exceptional, evidence-led page or case study every 2 weeks | Impressions, non-brand clicks, assisted activation, trial-to-paid conversion |
| Communities | Customer research and trust | 2–3 helpful, disclosed contributions each week | Useful conversations, research notes, referral traffic |
| Partners | Credibility and lower-CAC distribution | 10 targeted outreach conversations per month; co-host a workflow session | Activated referrals, paid referrals, payback |
| Product Hunt | One launch event, not a growth engine | Draft, assets, maker participation, real support coverage | New activated users and qualitative feedback |

### Content pillars

1. **The weekly content system:** turn a real founder update into three channel-specific posts.
2. **Approval without bottlenecks:** show exactly how a small team stays on-brand and human-controlled.
3. **Platform truth:** explain supported Instagram/LinkedIn/YouTube capabilities, permissions, failures, and workarounds without hiding limitations.
4. **Build quality in public:** reliability, AI safety, OAuth reviews, rate limits, and the decisions behind the product.
5. **Customer evidence:** permissioned before/after workflow stories, not generic AI claims.

### Research readout and implication

- **Google:** the live home page is crawlable, has JSON-LD, `robots.txt`, sitemap, and a fast raw fetch (0.93 seconds in the 24 July audit). The visible title is 72 characters and description 221 characters; tighten both before launch. Google recommends people-first, original, trustworthy content rather than mass-produced search content. [Google Search Central](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- **X/Twitter and Instagram:** web-indexed searches for current AI social-management conversations returned insufficient credible, audience-specific signal to base a spend decision on. Treat these as distribution experiments, not validation. Before publishing, manually monitor 30 relevant accounts/hashtags and log repeated objections, terminology, and CTAs for four weeks.
- **LinkedIn:** current posts heavily promote “AI agency” and all-in-one automation. The differentiation should be a proof-backed workflow and control, not louder autonomy claims. [Example discussion](https://www.linkedin.com/posts/adeel-mir_aiautomation-n8n-openai-activity-7470944977666297856-Mn2i)
- **Reddit and communities:** the useful pain is not simply scheduling; it is transforming scattered real work into an approved, usable content calendar. Use communities for learning and contribution, never stealth promotion. [Discussion](https://www.reddit.com/r/socialmedia/comments/1t62o82/is_the_social_media_scheduler_market_actually/)

## SEO and GEO workstream

The site already permits major AI crawlers and has a sitemap. Build authority through useful, evidence-led material; do not programmatically produce thin comparison pages or AI-generated SEO volume.

### Technical tasks

- Shorten title to approximately 50–60 characters and description to approximately 150–160 characters. Suggested starting copy:
  - Title: `AI Social Media Automation for Small Teams | MagicBox`
  - Description: `Create on-brand Instagram, LinkedIn, and YouTube posts, review them, then schedule and publish from one workflow. Start free with MagicBox.`
- Verify canonical, Open Graph image at 1200×630, Twitter large-image card, mobile accessibility, Core Web Vitals, sitemap, and all bot directives after each release.
- Register Google Search Console, Bing Webmaster Tools, and Brave Search; submit the sitemap and monitor coverage/indexing. Add IndexNow only after the publishing workflow is reliable.
- Add an author/about page, clear company/contact details, dated articles, first-party screenshots, citations, and FAQ/Article schema that matches visible content.

### First six high-intent pages

1. `How solo B2B founders create a LinkedIn content workflow each week`
2. `How to turn one product update into LinkedIn and Instagram posts`
3. `Social media approval workflow for small marketing teams`
4. `AI social media scheduling for founders: what to automate and what to review`
5. `MagicBox vs. manual content calendars` (only compare demonstrated workflow; never invent competitor data)
6. A permissioned design-partner case study with raw workflow evidence.

Each page should answer the question first, show a real example or template, disclose AI use where relevant, cite sources, and include one relevant CTA. That is consistent with Google’s people-first guidance and is more sustainable for AI search citation than keyword stuffing. [Google guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

## Funnel instrumentation and operating cadence

### Events to add

| Stage | Required event |
| --- | --- |
| Acquisition | `landing_cta_clicked`, `waitlist_submitted`, `pricing_viewed`, with UTM/referrer/landing-page properties |
| Activation | `signup_completed`, `onboarding_started`, `brand_kit_completed`, `channel_connected`, `first_drafts_generated`, `first_post_approved`, `first_post_scheduled`, `first_post_published` |
| Revenue | `checkout_started`, `checkout_completed`, `subscription_activated`, `subscription_cancelled`, `payment_failed`, `refund_requested` |
| Retention | `weekly_active_workspace`, `weekly_posts_published`, `automation_created`, `automation_failed`, `support_ticket_created` |
| Reliability | `destination_publish_failed`, `provider_token_expired`, `retry_succeeded`, `quota_rejected` |

Never send post text, OAuth tokens, emails, or other sensitive personal data to analytics. Tie paid status to signed server-side payment events, not browser events.

### Weekly review

Every Monday, review the prior seven days by channel and cohort:

1. Qualified visits → sign-ups → brand kits → first schedules → first publishes → checkouts → paid subscriptions.
2. Time to first scheduled post and time to first published post.
3. Publish success rate, retry rate, cost per successful published post, support tickets, refunds, and payment failures.
4. Week-1 and week-4 retained workspaces; cancellation reason by plan.
5. Content page impressions/clicks, partner referrals, and organic/paid attribution.

Choose one bottleneck, form one hypothesis, ship one improvement, and record the result. Do not optimize total sign-ups if first publish or paid conversion is weak.

## Owners and the first 10 working days

| Day | Outcome |
| --- | --- |
| 1 | Name founder, engineering, growth, support, and legal owners. Freeze unsupported public claims. |
| 2 | Remove fabricated/placeholder proof and managed-account claim; reconcile all launch/pricing docs. |
| 3 | Complete Firebase App Check and secrets/config checklist; deploy and verify rules/functions. |
| 4 | Run payment and core-journey production tests; create incident/support runbook. |
| 5 | Configure PostHog events, error reporting, alerts, and dashboard. |
| 6 | Record the real workflow demo and create private-beta landing/application page. |
| 7–8 | Recruit and onboard the first five design partners; observe every session. |
| 9 | Ship the highest-impact reliability/onboarding fix; publish the first founder learning post. |
| 10 | Review activation, support, and willingness-to-pay; decide whether to invite the next cohort. |

## Decisions needed from the founder

No clarification blocks the plan. Before execution, confirm these choices:

1. Approve the recommended first ICP: solo B2B founders/one-person marketers publishing to LinkedIn and Instagram.
2. Choose whether the first paid motion is immediately self-serve Pro or a guided paid beta; the recommendation is guided beta first, using the existing checkout.
3. Confirm who owns customer support, refunds, and live incident response.
4. Decide whether to remove the managed-accounts section now (recommended) or define an actual compliant, staffed service before it is promoted.

## References

- [Google: helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Product Hunt: featuring guidelines](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines)
- [Product Hunt: posting a product](https://help.producthunt.com/en/articles/479557-how-to-post-a-product)
- [Product Hunt: authentic launch engagement](https://help.producthunt.com/en/articles/11751186-product-of-the-day-week-month)
- [Current social-media-manager discussion](https://www.reddit.com/r/SocialMediaManagers/comments/1ukjoyg/do_social_media_managers_prefer_more_ai_features/)
- [Current discussion of the gap before scheduling](https://www.reddit.com/r/socialmedia/comments/1t62o82/is_the_social_media_scheduler_market_actually/)
