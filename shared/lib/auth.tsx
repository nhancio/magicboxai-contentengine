import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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
          await setDoc(
            doc(db, "users", firebaseUser.uid),
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

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) throw new Error("Firebase not configured. Add your Firebase config to .env.");
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
