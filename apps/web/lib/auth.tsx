"use client";
// Client-side auth context: holds the current user + access token and exposes
// login/register/logout. Token is kept in localStorage for the starter build.
// (Hardening note: the server also issues an httpOnly refresh cookie for a
// future in-memory-token + silent-refresh flow on a shared custom domain.)
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { api, setToken, getToken } from "./api";

export interface User {
  id: string;
  email: string;
  displayName: string;
  freeDemoUsed?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await api<{ accessToken: string; user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    setToken(accessToken);
    setUser(user);
  }, []);

  const register = useCallback(
    async (email: string, displayName: string, password: string) => {
      const { accessToken, user } = await api<{ accessToken: string; user: User }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, displayName, password }),
        }
      );
      setToken(accessToken);
      setUser(user);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
