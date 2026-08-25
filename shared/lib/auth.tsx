import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, isAuthDomainFirstParty } from "./firebase";

/**
 * `popup` opens Google in a child window and needs a real user gesture.
 * `redirect` navigates the whole tab and is the only option without one — but
 * it can only complete when the auth handler is first-party (see
 * `isAuthDomainFirstParty`). `auto` picks per browser.
 */
export type SignInMode = "auto" | "popup" | "redirect";
export type SignInResult = "signed_in" | "redirecting" | "cancelled";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** True while a `signInWithRedirect` navigation is being started or resolved. */
  redirecting: boolean;
  /** Whether a gesture-free redirect sign-in can actually complete here. */
  canAutoRedirect: boolean;
  signInWithGoogle: (mode?: SignInMode) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

/** Embedded webviews (Instagram, LinkedIn, Facebook, Gmail…) block `window.open` outright. */
const IN_APP_BROWSER =
  /\b(FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line|MicroMessenger|Snapchat|Pinterest|TikTok|GSA)\b/i;

function isEmbeddedBrowser(ua: string): boolean {
  return IN_APP_BROWSER.test(ua);
}

function isHandheld(ua: string): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS defaults to a desktop UA string; touch points give it away.
  return /Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
}

/**
 * Popups are unreliable on phones (blocked in webviews, and a stray tab even
 * when allowed), so redirect is preferred there — but only where it can finish.
 * With a cross-origin auth handler, redirect never resolves in Safari/Firefox,
 * so popup stays the safer default until the handler is proxied onto this origin.
 */
function resolveMode(mode: SignInMode): "popup" | "redirect" {
  if (mode !== "auto") return mode;
  if (typeof navigator === "undefined") return "popup";
  const ua = navigator.userAgent;
  if (!isAuthDomainFirstParty()) return "popup";
  return isEmbeddedBrowser(ua) || isHandheld(ua) ? "redirect" : "popup";
}

/** Popup failures that a full-page redirect can still recover from. */
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/internal-error",
]);

/** The user backed out on purpose — surfacing an error toast would be noise. */
const POPUP_CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

/**
 * Helper to determine if an auth error is caused by the user closing/cancelling
 * the popup, or by browser Cross-Origin-Opener-Policy (COOP) restrictions when
 * evaluating popup window references upon closure.
 */
export function isPopupCancelledError(e: unknown): boolean {
  if (!e) return false;

  const code =
    e instanceof FirebaseError
      ? e.code
      : typeof e === "object" && e !== null && "code" in e
      ? String((e as { code?: unknown }).code)
      : "";

  if (POPUP_CANCELLED_CODES.has(code)) return true;

  const message =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message)
      : String(e);

  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("popup-closed-by-user") ||
    lowerMessage.includes("cancelled-popup-request") ||
    lowerMessage.includes("user-cancelled") ||
    lowerMessage.includes("popup closed") ||
    lowerMessage.includes("closed by user") ||
    lowerMessage.includes("cross-origin-opener-policy") ||
    lowerMessage.includes("window.closed")
  );
}

/**
 * Helper to determine if an auth error is a popup environment failure that
 * can be retried via full-page redirect.
 */
export function isPopupFallbackError(e: unknown): boolean {
  if (!e) return false;

  const code =
    e instanceof FirebaseError
      ? e.code
      : typeof e === "object" && e !== null && "code" in e
      ? String((e as { code?: unknown }).code)
      : "";

  if (POPUP_FALLBACK_CODES.has(code)) return true;

  const message =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
      ? String((e as { message?: unknown }).message)
      : String(e);

  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("popup-blocked") ||
    lowerMessage.includes("operation-not-supported") ||
    lowerMessage.includes("web-storage-unsupported")
  );
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Sets a non-sensitive cross-subdomain hint cookie (Domain=.magicboxai.in) so
 * the landing page can show "Go to dashboard" for signed-in users. It carries
 * no auth token — it's only a UI hint. On non-magicboxai.in hosts (localhost,
 * *.web.app) it falls back to a host-only cookie.
 */
function setSessionHint(signedIn: boolean) {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domain = host.endsWith("magicboxai.in") ? "; Domain=.magicboxai.in" : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = signedIn
    ? `mb_signed_in=1; Path=/${domain}; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
    : `mb_signed_in=; Path=/${domain}; Max-Age=0; SameSite=Lax${secure}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // Drain any pending redirect sign-in on load. Firebase resolves it as part of
  // auth initialization, but consuming it here is what surfaces a failed
  // round-trip instead of silently dropping the user back on /login.
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).catch((e) => {
      console.warn("Redirect sign-in did not complete:", e);
    });
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setSessionHint(!!firebaseUser);
      if (firebaseUser && db) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          // Credits live in Convex (`credits.claimTrial` grants the trial
          // server-side). Writing a `credits` blob here is denied by
          // firestore.rules, which took the whole write — and therefore the
          // user document itself — down with it.
          await setDoc(
            userRef,
            {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Failed to update user doc:", e);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async (mode: SignInMode = "auto"): Promise<SignInResult> => {
    if (!auth || !googleProvider)
      throw new Error("Firebase not configured. Add your Firebase config to .env.");

    if (resolveMode(mode) === "redirect") {
      setRedirecting(true);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (e) {
        setRedirecting(false);
        throw e;
      }
      // Navigation is underway. The caller keeps its handoff state visible
      // until the browser leaves for Google.
      return "redirecting";
    }

    try {
      await signInWithPopup(auth, googleProvider);
      return "signed_in";
    } catch (e) {
      if (isPopupCancelledError(e)) {
        return "cancelled";
      }
      if (isPopupFallbackError(e)) {
        // Popup was refused by the browser. Redirect is the only remaining path,
        // and we still hold the user's gesture, so take it even where the auth
        // handler is cross-origin — a chance at signing in beats a dead button.
        setRedirecting(true);
        try {
          await signInWithRedirect(auth, googleProvider);
          return "redirecting";
        } catch (redirectError) {
          setRedirecting(false);
          if (isPopupCancelledError(redirectError)) {
            return "cancelled";
          }
          throw redirectError;
        }
      }
      throw e;
    }
  };

  const signOut = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        redirecting,
        canAutoRedirect: isAuthDomainFirstParty(),
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
