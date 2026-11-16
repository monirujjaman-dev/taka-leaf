import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onSignedOut, refreshSession, setSession } from "../api/client";
import type { AuthResponse, AuthUser } from "../api/types";

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: AuthUser };

interface AuthValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** After Settings changes the name: keeps the signed-in user in step without a reload. */
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    // A returning visitor still has a refresh cookie: pick the session back up.
    refreshSession()
      .then((user) => active && setState(user ? { status: "signedIn", user } : { status: "signedOut" }))
      .catch(() => active && setState({ status: "signedOut" }));
    const stop = onSignedOut(() => {
      queryClient.clear();
      setState({ status: "signedOut" });
    });
    return () => {
      active = false;
      stop();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password, client: "web" } });
    setSession(session);
    setState({ status: "signedIn", user: session.user });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
      queryClient.clear();
      setState({ status: "signedOut" });
    }
  }, [queryClient]);

  const updateUser = useCallback((user: AuthUser) => setState({ status: "signedIn", user }), []);
  const value = useMemo(() => ({ state, signIn, signOut, updateUser }), [state, signIn, signOut, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
