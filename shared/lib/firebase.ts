import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True when Firebase's sign-in helper (`/__/auth/*`) is served from this same
 * origin. When it is not — the default `<project>.firebaseapp.com` — every
 * piece of auth machinery is third-party to the app, so Safari/ITP partitions
 * or evicts its storage. `signInWithRedirect` cannot complete at all in that
 * state, and refresh tokens go stale early, which surfaces later as callables
 * rejecting with `unauthenticated`.
 *
 * Self-host by proxying `/__/auth/*` to the Firebase Hosting site (see
 * `apps/web/vercel.json`) and setting `VITE_FIREBASE_AUTH_DOMAIN` to the app
 * host. Sign-in strategy keys off this, so both configurations stay correct.
 */
export function isAuthDomainFirstParty(): boolean {
  if (typeof window === "undefined") return false;
  const domain = firebaseConfig.authDomain as string | undefined;
  return !!domain && domain.toLowerCase() === window.location.hostname.toLowerCase();
}

/**
 * `getAuth` silently drops to in-memory persistence when its preferred store is
 * unavailable, which is exactly what happens in Safari private mode and on
 * ITP-evicted profiles — the session then dies on the next navigation. An
 * explicit ordered chain keeps a durable store whenever one exists.
 *
 * `initializeAuth` also omits the popup/redirect resolver that `getAuth`
 * installs by default, so it has to be passed back in or `signInWithPopup` /
 * `signInWithRedirect` throw `auth/operation-not-supported-in-this-environment`.
 */
function createAuth(instance: FirebaseApp): Auth {
  try {
    return initializeAuth(instance, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized (HMR, or another entrypoint got there first).
    return getAuth(instance);
  }
}

// Only initialize when config is present (avoids auth/invalid-api-key when .env is empty)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let appCheck: AppCheck | null = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : (getApps()[0] as FirebaseApp);
    auth = createAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, "us-central1");
    googleProvider = new GoogleAuthProvider();
    // Always show the account chooser. Without it Google auto-selects the last
    // session, which silently signs people into the wrong workspace on shared
    // or multi-account devices — and there is no visible way back.
    googleProvider.setCustomParameters({ prompt: "select_account" });
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;
    if (appCheckSiteKey) {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (import.meta.env.PROD) {
      console.error(
        "Firebase App Check is required in production. Set VITE_FIREBASE_APPCHECK_SITE_KEY."
      );
    }
  } catch (error) {
    console.warn("Firebase initialization failed. Running in demo mode.", error);
  }
}

export { app, auth, db, storage, functions, googleProvider, appCheck };
