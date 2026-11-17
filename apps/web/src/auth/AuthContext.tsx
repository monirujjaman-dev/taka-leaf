import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, isTransient, onSignedOut, refreshSession, setSession, takePrimedSession } from "../api/client";
import type { AuthResponse, AuthUser } from "../api/types";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: AuthUser }
  /** The session could not be checked (busy server, no connection); it may well still be valid. */
  | { status: "unavailable"; error: ApiError };

interface AuthValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** After Settings changes the name: keeps the signed-in user in step without a reload. */
  updateUser: (user: AuthUser) => void;
  /** Checks the session again after it could not be checked. */
  retry: () => void;
}

const settle = (user: AuthUser | null): AuthState => (user ? { status: "signedIn", user } : { status: "signedOut" });
const failed = (error: unknown): AuthState => (isTransient(error) ? { status: "unavailable", error } : { status: "signedOut" });

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    // A returning visitor still has a refresh cookie: pick the session back up (main.tsx has
    // usually started this already).
    (takePrimedSession() ?? refreshSession())
      .then((user) => active && setState(settle(user)))
      .catch((error: unknown) => active && setState(failed(error)));
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
  const retry = useCallback(() => {
    setState({ status: "loading" });
    refreshSession().then(
      (user) => setState(settle(user)),
      (error: unknown) => setState(failed(error)),
    );
  }, []);
  const value = useMemo(() => ({ state, signIn, signOut, updateUser, retry }), [state, signIn, signOut, updateUser, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
