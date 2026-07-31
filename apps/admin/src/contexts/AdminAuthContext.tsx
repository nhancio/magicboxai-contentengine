import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, googleProvider } from "@shared/lib/firebase";
import { identifyUser, resetAnalytics } from "@shared/lib/analytics";

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        identifyUser(firebaseUser.uid, { app: "admin" });
        try {
          // Method 1: Check Firebase custom claims (secure, server-set)
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          if (tokenResult.claims.admin === true) {
            setIsAdmin(true);
            setLoading(false);
            return;
          }

          // Method 2: Verify via Cloud Function (checks claims + Firestore)
          if (functions) {
            try {
              const verifyFn = httpsCallable<void, { isAdmin: boolean }>(
                functions,
                "verifyAdminStatus"
              );
              const result = await verifyFn();
              if (result.data.isAdmin) {
                // Force token refresh to get updated claims
                await firebaseUser.getIdToken(true);
                setIsAdmin(true);
                setLoading(false);
                return;
              }
            } catch {
              // Cloud function may not be deployed yet, fall through to Firestore check
            }
          }

          // Method 3: Fallback to Firestore admins collection
          if (db) {
            const adminDoc = await getDoc(doc(db, "admins", firebaseUser.email || ""));
            setIsAdmin(adminDoc.exists());
          } else {
            setIsAdmin(false);
          }
        } catch (err) {
          console.error("Error checking admin status:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        resetAnalytics();
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    if (!auth || !googleProvider) throw new Error("Firebase not initialized");
    await signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    if (auth) firebaseSignOut(auth);
  };

  return (
    <AdminAuthContext.Provider value={{
      isAuthenticated: !!user && isAdmin,
      isAdmin,
      user,
      loading,
      login,
      logout
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
