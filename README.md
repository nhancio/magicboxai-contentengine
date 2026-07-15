# MagicBox

MagicBox is an AI marketing automation platform for brand-aware content generation, approval, scheduling, and direct publishing.

- Canonical architecture, setup, product, SEO, payments, video, and Convex migration context: [`Context.MD`](./Context.MD)
- Canonical production backlog, release gates, six-month plan, and redundant-file inventory: [`NEXTSTEPS.md`](./NEXTSTEPS.md)

Quick verification:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Historical project Markdown files are retained for review but are superseded by the two canonical documents above. Operational `marketing-agent/**/*.md` files and canonical `legal/*.md` policies remain standalone by design.

<!-- Historical content below is retained temporarily for provenance. -->

## Architecture

```
magicboxai/
├── shared/              # Shared code across all apps
│   ├── components/ui/   # Reusable UI components (shadcn-style)
│   ├── lib/             # Firebase, auth, Firestore, utilities
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript type definitions
├── apps/
│   ├── landing/         # magicboxai.in - Marketing landing page
│   ├── web/             # app.magicboxai.in - Main application
│   └── admin/           # admin.magicboxai.in - Admin panel
```

## Subdomain Mapping

| Subdomain | App | Port (dev) | Description |
|-----------|-----|------------|-------------|
| magicboxai.in | landing | 5173 | Public landing page |
| app.magicboxai.in | web | 5174 | Main app (Google login) |
| admin.magicboxai.in | admin | 5175 | Admin panel (Firebase admin auth) |

## Quick Start

### Prerequisites
- Node.js 20+
- Firebase project (for auth & data)

### Setup

1. Clone the repo and install dependencies for each app:

```bash
cd apps/landing && npm install
cd ../web && npm install
cd ../admin && npm install
```

2. **Connect Firebase** – Copy env files and add your Firebase config. See **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** for step-by-step setup (project, Auth, Firestore, Storage, optional Cloud Functions).

```bash
cp .env.example apps/web/.env
cp .env.example apps/admin/.env
# Edit apps/web/.env and apps/admin/.env with your Firebase config from the Firebase Console.
```

3. Start each app:

```bash
# Terminal 1 - Landing page
cd apps/landing && npm run dev

# Terminal 2 - Main app
cd apps/web && npm run dev

# Terminal 3 - Admin panel
cd apps/admin && npm run dev
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Auth**: Firebase Google OAuth for app and admin; admin access is checked with custom claims / verified admin records
- **Database**: Firebase Firestore
- **AI generation**: Firebase Cloud Functions with Gemini, Imagen, and gated Veo support
- **Charts**: Recharts remains installed in app packages but is listed for dependency cleanup if no import remains
- **Animations**: Framer Motion

## Authentication

### User App (app.magicboxai.in)
- Google Sign-In via Firebase Authentication
- User data stored in Firestore `users` collection

### Admin Panel (admin.magicboxai.in)
- Google sign-in via Firebase Authentication.
- Admin authorization is checked through server-set custom claims, the `verifyAdminStatus` callable when deployed, and the configured admin record fallback.
- There are no hardcoded admin credentials in the current admin source.

## Deployment

Each app builds independently and can be deployed to any static hosting (Vercel, Netlify, Cloudflare Pages):

```bash
cd apps/landing && npm run build   # → dist/
cd apps/web && npm run build       # → dist/
cd apps/admin && npm run build     # → dist/
```

Configure your DNS:
- `magicboxai.in` → landing app
- `app.magicboxai.in` → web app
- `admin.magicboxai.in` → admin app
