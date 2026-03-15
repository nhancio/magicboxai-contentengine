# MagicBox AI

AI-powered content creation platform for building digital avatars, generating social media content, and managing multi-platform publishing.

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
| admin.magicboxai.in | admin | 5175 | Admin panel (admin123/admin123) |

## Quick Start

### Prerequisites
- Node.js 18+
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
- **Auth**: Firebase Google OAuth (app), hardcoded credentials (admin)
- **Database**: Firebase Firestore
- **Image Gen**: Firebase Cloud Functions + DALL-E 3
- **Charts**: Recharts
- **Animations**: Framer Motion

## Authentication

### User App (app.magicboxai.in)
- Google Sign-In via Firebase Authentication
- User data stored in Firestore `users` collection

### Admin Panel (admin.magicboxai.in)
- Username: `admin123`
- Password: `admin123`
- Stored in localStorage for session persistence

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
