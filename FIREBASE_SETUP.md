# Firebase setup for MagicBox AI

Use this guide to connect Firebase so sign-in, Firestore (library, avatars, ads), and optional AI image generation work.

---

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or use an existing one).
3. Name it (e.g. `magicbox-ai`), enable/disable Google Analytics as you like, then create the project.

---

## 2. Register your web app and get config

1. In the project overview, click the **Web** icon (`</>`).
2. Register an app nickname (e.g. `MagicBox Web`).
3. Copy the **firebaseConfig** object. You’ll use these values in `.env`:

   | Firebase config key | Your `.env` variable |
   |---------------------|----------------------|
   | `apiKey`            | `VITE_FIREBASE_API_KEY` |
   | `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId`         | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`             | `VITE_FIREBASE_APP_ID` |

---

## 3. Enable Authentication (Google sign-in)

1. In the left sidebar: **Build → Authentication**.
2. Click **Get started** if prompted.
3. Open the **Sign-in method** tab.
4. Click **Google**, turn **Enable** on, set a support email, and **Save**.

---

## 4. Create Firestore database

1. **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (you can add rules next).
4. Pick a location (e.g. `us-central1`) and **Enable**.

**Indexes:** The app queries `influencers` and `ads` by `userId` and `createdAt`. If you see an error in the browser console asking for an index, click the link in the error to create that index in the console.

**Security rules (minimal for development):** In Firestore → **Rules**, you can start with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /influencers/{docId} {
      allow read, write: if request.auth != null;
    }
    match /ads/{docId} {
      allow read, write: if request.auth != null;
    }
    match /apiLogs/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 5. Enable Storage

1. **Build → Storage**.
2. Click **Get started**.
3. Use the default rules (or stricter ones for production) and choose a location.

Cloud Functions can upload generated images here under `users/{uid}/influencers/` and `users/{uid}/ads/`.

---

## 6. (Optional) Deploy Cloud Functions and set OpenAI key

If you use AI image generation (DALL·E 3) via a callable function **generateImage**:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. In the project root: `firebase use <your-project-id>`
4. In the `functions` folder (if present), install deps and set the secret:

   ```bash
   cd functions
   npm install
   firebase functions:secrets:set OPENAI_API_KEY
   ```

   Paste your [OpenAI API key](https://platform.openai.com/api-keys) when prompted.

5. Deploy: `firebase deploy --only functions`

---

## 7. Add config to your app (`.env`)

1. Copy the example env and fill in Firebase values:

   ```bash
   cp .env.example apps/web/.env
   cp .env.example apps/admin/.env
   ```

2. Open each `.env` and set the Firebase variables from step 2:

   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

3. Restart the dev servers: `./run_web.sh`, `./run_admin.sh`, etc.

---

## Checklist

- [ ] Firebase project created
- [ ] Web app registered and config copied to `apps/web/.env` and `apps/admin/.env`
- [ ] Google sign-in enabled in Authentication
- [ ] Firestore database created (and rules/indexes if needed)
- [ ] Storage enabled
- [ ] (Optional) `OPENAI_API_KEY` set in Firebase Functions secrets and `firebase deploy --only functions` run
- [ ] `.env` files filled and dev servers restarted

After this, **Sign in with Google**, **Library**, **Avatars**, **Ads**, and **Admin** (with real data) should work with Firebase.
