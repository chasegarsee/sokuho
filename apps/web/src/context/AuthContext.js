"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    return signInWithPopup(auth, googleProvider);
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }, []);

  // Facebook linking handled via custom OAuth flow/server

  // No server session cookie; client-only auth for MVP

  const value = useMemo(
    () => ({ user, isLoading, signInWithGoogle, signOutUser }),
    [user, isLoading, signInWithGoogle, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


