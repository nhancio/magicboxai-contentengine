# MagicBox Suite — Web App Design System (editorial monochrome + purple)

The web app was migrated from a dark glassmorphism theme to an **editorial light theme** matching the marketing landing page. Foundation (fonts, tokens, tailwind, shared UI components, AppLayout) is DONE. This doc is the brief for restyling individual pages.

## The look
- **Light, warm, editorial.** Warm off-white background, warm near-black ink, generous whitespace, thin `border-border` hairlines, sharp-ish corners (radius 0.5rem).
- **Fonts:** headings (`h1/h2/h3` or `.font-display`) = **Instrument Serif** (elegant serif). Body = **Instrument Sans**. Small labels/eyebrows/metrics units = **JetBrains Mono** (`.font-mono`, uppercase, tracking-widest).
- **Purple is the accent** — primary buttons, active states, links, key highlights. Everything else is monochrome.
- Motion is subtle (fade/slide-in already available as `.animate-fade-in`, `.animate-slide-up`).

## Token classes — USE THESE, never hardcoded dark colors
| Need | Use |
|---|---|
| Page / app bg | `bg-background` |
| Primary text | `text-foreground` |
| Secondary/muted text | `text-muted-foreground` |
| Card / panel surface | `bg-card border border-border rounded-lg` (or the `.glass-card` / `.glass` utility, already redefined to light cards) |
| Subtle grey fill (inputs, chips, tab track) | `bg-secondary` or `bg-muted` |
| Hover fill | `hover:bg-accent` |
| Hairline / divider | `border-border` |
| Primary button | `<Button>` default (purple) — already correct |
| Purple accent text/highlight | `text-brand` / `bg-brand/10` / `border-brand/20` |
| Ink (black) button/surface | `variant="ink"` on Button, or `bg-foreground text-background` |
| Eyebrow label | `<span className="eyebrow">…</span>` (mono, uppercase) |

## Find-and-replace guide (old dark class → new)
- `bg-zinc-950` / `bg-zinc-900` / `bg-black` → `bg-background` (page) or `bg-card` (panel)
- `text-white` → `text-foreground`
- `text-white/60`, `text-white/50`, `text-white/40` → `text-muted-foreground`
- `text-white/70`, `text-white/80` → `text-foreground/70` or `text-foreground`
- `bg-white/5`, `bg-white/[0.03]` → `bg-card` (panels) or `bg-secondary` (subtle fills)
- `bg-white/10` → `bg-accent`
- `border-white/10`, `border-white/[0.06]`, `border-white/5` → `border-border`
- `border-white/20` → `border-foreground/20`
- purple scale (`purple-400/500/600`, `text-purple-300`, `from-purple-500 to-indigo-600` gradients) → use `brand` / `text-brand` / `bg-brand`; replace gradient logo/mark blocks with a solid `bg-foreground text-background` or `bg-brand text-brand-foreground` square. Drop heavy glows; keep at most `.glow-purple-sm`.
- `.text-gradient` still works (now solid purple). `.glass`, `.glass-card`, `.glass-hover` still work (now light cards).
- Big display headings: switch font weight-heavy sans to serif — use `font-display` and lighter tracking. Section titles ~`text-2xl`–`text-4xl font-display`.
- Status colors: keep green/emerald/amber/red for semantic states but pick the readable-on-light shade (e.g. `text-emerald-700`, `bg-emerald-500/10`, `text-red-600`).

## Rules
- Preserve ALL logic, props, state, data flow, routes, and Firebase calls. This is a restyle only — do not change behavior.
- Every page must have NO remaining `text-white`, `bg-white/`, `bg-zinc-`, `border-white/`, or raw `purple-`/`indigo-` gradient classes after you finish.
- Keep it clean and restrained — lots of whitespace, hairline borders, serif headings, one purple accent per view. Think "editorial product UI," not "dashboard with neon."
- Where a page shows a big empty state or a success moment, use the lightweight shared placeholder: `import { LottiePlayer } from "@shared/components/ui/lottie"`. The previous bundled Lottie JSON pattern was removed to avoid the `lottie-web` eval warning and extra route weight.
- After editing, ensure the app still builds (`cd apps/web && npm run build`).

## Reference
`apps/web/src/components/layout/AppLayout.tsx` is the canonical example of the new style (sidebar, active states, logo mark, mono labels). Match its vocabulary.
