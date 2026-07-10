# MagicBox AI - Production Deployment Guide

Everything required to launch MagicBox AI in production.

---

## Prerequisites

- Node.js 18+
- Firebase project (Blaze plan for Cloud Functions)
- Google Cloud project with Gemini API enabled
- Domain: magicboxai.in (+ subdomains)
- Hosting: Vercel, Netlify, or Cloudflare Pages

---

## 1. Google Gemini API Setup

### Get API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key" → "Create API key in new project"
3. Copy the API key
4. Add to environment variables:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### Model Selection
- **Script Generation**: `gemini-2.0-flash` (fast, cost-effective)
- **Hook Optimization**: `gemini-2.0-flash`
- **Complex Scripts**: `gemini-2.5-pro` (higher quality, higher cost)

### Rate Limits (Free Tier)
- 15 RPM (requests per minute)
- 1M TPM (tokens per minute)
- 1,500 RPD (requests per day)

### Rate Limits (Pay-as-you-go)
- 2,000 RPM
- Pricing: $0.10 per 1M input tokens, $0.40 per 1M output tokens (Flash)

---

## 2. Firebase Setup

### Project Configuration
1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable services:
   - **Authentication**: Google sign-in provider
   - **Firestore**: Start in production mode
   - **Storage**: For user uploads and generated content
   - **Cloud Functions**: For API proxy (Gemini calls)

### Firestore Collections

```
users/
  {userId}/
    email: string
    displayName: string
    photoURL: string
    lastLoginAt: timestamp
    plan: "free" | "creator" | "pro"
    creditsUsed: number
    creditsLimit: number

videos/
  {videoId}/
    userId: string
    templateId: string
    avatarId: string
    script: string
    hookLine: string
    captions: string
    productImages: string[]
    videoUrl: string
    thumbnailUrl: string
    status: "generating" | "completed" | "failed"
    platform: string
    createdAt: timestamp

avatars/
  {avatarId}/
    name: string
    personality: string
    voiceTone: string
    imageUrl: string
    thumbnailUrl: string
    category: string
    isPrebuilt: boolean

templates/
  {templateId}/
    name: string
    hookLine: string
    scriptStructure: string
    targetUseCase: string
    tone: string
    thumbnailUrl: string
    category: string
    platform: string[]
    isActive: boolean

apiLogs/
  {logId}/
    endpoint: string
    userId: string
    tokensUsed: number
    model: string
    duration: number
    timestamp: timestamp
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Users can CRUD their own videos
    match /videos/{videoId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }

    // Avatars are readable by all authenticated users
    match /avatars/{avatarId} {
      allow read: if request.auth != null;
    }

    // Templates are readable by all authenticated users
    match /templates/{templateId} {
      allow read: if request.auth != null;
    }
  }
}
```

### Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024; // 10MB max
    }
    match /avatars/{allPaths=**} {
      allow read: if request.auth != null;
    }
    match /templates/{allPaths=**} {
      allow read: if request.auth != null;
    }
  }
}
```

---

## 3. Environment Variables

### Frontend Apps (apps/web/.env, apps/admin/.env)
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
# VITE_GEMINI_API_KEY is NO LONGER NEEDED on the frontend (moved to Cloud Functions)
```

### Cloud Functions (functions/.env)
```env
GEMINI_API_KEY=your_gemini_api_key
```

---

## 4. Cloud Functions Deployment

### Install dependencies
```bash
cd functions
npm install @google/genai firebase-admin firebase-functions uuid
```

### Deploy
```bash
firebase deploy --only functions
```

### Key Functions Deployed
- `generateScript` - Gemini-powered script generation (protected)
- `generateImage` - Imagen 3 powered image generation
- `analyzeImage` - Gemini 1.5/2.0 powered image analysis
- `generateUGCVideo` - Veo 3.1 powered video generation

---

## 5. Frontend Deployment

### Build all apps
```bash
# Landing page
cd apps/landing && npm run build

# Web app
cd apps/web && npm run build

# Admin panel
cd apps/admin && npm run build
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy each app
cd apps/landing && vercel --prod
cd apps/web && vercel --prod
cd apps/admin && vercel --prod
```

### Deploy to Cloudflare Pages (Alternative)
```bash
# Install Wrangler
npm i -g wrangler

# Deploy
cd apps/landing && wrangler pages deploy dist
cd apps/web && wrangler pages deploy dist
cd apps/admin && wrangler pages deploy dist
```

---

## 6. Domain & DNS Configuration

### DNS Records (Cloudflare/your DNS provider)
```
Type    Name              Value
A       magicboxai.in     76.76.21.21 (Vercel)
CNAME   app               cname.vercel-dns.com
CNAME   admin             cname.vercel-dns.com
```

### SSL
- Automatically provisioned by Vercel/Cloudflare
- Ensure all subdomains have SSL certificates

---

## 7. CDN & Storage

### Video/Image Storage
- **Primary**: Firebase Storage (included with Firebase)
- **Future Scale**: Cloudflare R2 or AWS S3
  - Video files: Store in `/videos/{userId}/{videoId}.mp4`
  - Thumbnails: Store in `/thumbnails/{videoId}.jpg`
  - Avatars: Store in `/avatars/{avatarId}.png`

### CDN Configuration
- Firebase Storage provides CDN by default
- For higher traffic: Add Cloudflare CDN in front
- Cache policy: Videos cached for 30 days, images for 7 days

---

## 8. Monitoring & Observability

### Error Tracking
- **Sentry** (recommended): Add to all frontend apps
  ```bash
  npm install @sentry/react
  ```
- Configure in `main.tsx`:
  ```typescript
  Sentry.init({ dsn: "your-sentry-dsn", environment: "production" });
  ```

### Performance Monitoring
- **Firebase Performance Monitoring**: Built-in with Firebase
- **Vercel Analytics**: Automatic with Vercel deployment

### Logging
- Cloud Functions: Logs available in Google Cloud Console
- Frontend: Console errors → Sentry
- API calls: Logged in Firestore `apiLogs` collection

### Uptime Monitoring
- **Better Uptime** or **UptimeRobot** (free tier)
- Monitor: magicboxai.in, app.magicboxai.in, admin.magicboxai.in
- Alert via: Email, Slack, Discord

---

## 9. Analytics

### Product Analytics
- **Mixpanel** or **PostHog** (recommended, has free tier)
  ```bash
  npm install posthog-js
  ```
- Key events to track:
  - `user_signed_up`
  - `template_selected`
  - `avatar_selected`
  - `video_generated`
  - `video_exported`
  - `product_image_uploaded`
  - `script_generated`

### Web Analytics
- **Google Analytics 4**: Add to landing page
- **Vercel Analytics**: Automatic Web Vitals

---

## 10. Security Checklist

- [x] Firebase Auth for user authentication
- [ ] Rate limiting on Cloud Functions (max 10 req/min per user)
- [ ] Input sanitization on all user inputs
- [ ] CORS configured correctly on Cloud Functions
- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] Environment variables not exposed in client bundle
- [ ] CSP headers configured
- [ ] No hardcoded API keys in source code
- [ ] Gemini API key only used server-side (Cloud Functions)

---

## 11. Launch Checklist

### Pre-Launch
- [ ] All environment variables configured
- [ ] Firebase project on Blaze plan
- [ ] Gemini API key created and tested
- [ ] Firestore indexes created
- [ ] Security rules deployed
- [ ] All 3 apps built and deployed
- [ ] DNS configured for all subdomains
- [ ] SSL certificates active
- [ ] Error tracking (Sentry) configured
- [ ] Analytics (PostHog/GA4) configured
- [ ] Sample avatars uploaded to Firestore
- [ ] Sample templates created in Firestore
- [ ] Admin panel accessible and working
- [ ] Test full user flow: signup → avatar → template → generate

### Post-Launch
- [ ] Monitor error rates in Sentry
- [ ] Monitor Gemini API usage/costs
- [ ] Monitor Firebase usage/costs
- [ ] Check analytics events flowing
- [ ] Set up weekly metrics review
- [ ] Create user feedback channel (Discord/email)

---

## Cost Estimates (Monthly)

| Service | Free Tier | Expected (10K users) | Scale (100K users) |
|---------|-----------|---------------------|-------------------|
| Firebase (Auth + Firestore) | Free | ~$25 | ~$200 |
| Firebase Storage | 5GB free | ~$10 | ~$100 |
| Cloud Functions | 2M invocations free | ~$15 | ~$150 |
| Gemini API | 1,500 req/day free | ~$50 | ~$500 |
| Vercel Hosting | Free | Free (Pro $20) | $20 |
| Sentry | Free (5K events) | Free | $26 |
| Domain | - | $12/year | $12/year |
| **Total** | **~$0** | **~$100/mo** | **~$1,000/mo** |
