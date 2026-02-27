import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginApi, registerApi, logoutApi } from "@/api/auth";
import { setToken, clearToken, getToken } from "@/api/client";
import type { User, LoginRequest, RegisterRequest } from "@/types/api";

const USER_STORAGE_KEY = "cortexflow_user";

/** Sync a key/value to the extension's chrome.storage (when in extension context). */
function syncToExtension(key: string, value: string | null | undefined) {
  try {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      if (value !== null && value !== undefined) {
        chrome.storage.local.set({ [key]: String(value) });
      } else {
        chrome.storage.local.remove(key);
      }
    }
  } catch {
    // Not in extension context or storage unavailable
  }
}

/** Decode a JWT payload (no signature validation — we trust our own token). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Restore persisted user from localStorage. */
function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Sync the logged-in user ID (and name) to the Chrome extension storage.
 *  The website runs as a normal webpage — chrome.storage is NOT directly
 *  available. We instead post a message that the injected content script
 *  (content/telemetry.js) receives and proxies into chrome.storage.local.
 */
function syncUserToExtension(userId: string | null, userName?: string | null) {
  try {
    const targetOrigin = window.location.origin;
    const post = (payload: Record<string, string> | string[]) => {
      const action = Array.isArray(payload) ? "REMOVE" : "SET";
      window.postMessage(
        { __cortexflow: true, action, payload: Array.isArray(payload) ? payload : { ...payload } },
        targetOrigin
      );
    };
    if (userId) {
      const data: Record<string, string> = { cortexflow_user_id: String(userId) };
      if (userName != null && userName !== "") data.cortexflow_user_name = String(userName);
      post(data);
      // Retry a few times so content script is sure to receive (timing)
      [100, 400].forEach((ms) => setTimeout(() => post({ ...data }), ms));
    } else {
      post(["cortexflow_user_id", "cortexflow_user_name"]);
    }
  } catch {
    // Non-browser or postMessage not available
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!token;

  // On mount (and on any token/user change): sync user ID to extension.
  useEffect(() => {
    if (token) {
      const uid = user?.id ?? (decodeJwt(token)?.user_id as string | undefined) ?? null;
      syncUserToExtension(uid ? String(uid) : null, user?.name ?? undefined);
    } else {
      syncUserToExtension(null);
    }
  }, [token, user]);

  // When user returns to the dashboard tab, re-sync so extension always has latest.
  useEffect(() => {
    const onVisible = () => {
      if (!token) return;
      const uid = user?.id ?? (decodeJwt(token)?.user_id as string | undefined) ?? null;
      if (uid) syncUserToExtension(String(uid), user?.name ?? undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [token, user]);

  // When extension popup asks for a re-sync (e.g. "Sync from dashboard"), push user id/name again.
  useEffect(() => {
    const onRequestSync = () => {
      if (!token) return;
      const uid = user?.id ?? (decodeJwt(token)?.user_id as string | undefined) ?? null;
      if (uid) syncUserToExtension(String(uid), user?.name ?? undefined);
    };
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "cortexflow-request-sync") onRequestSync();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [token, user]);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await loginApi(data);
      console.log("Login response:", res); // temporary — confirm user id field name
      const userId =
        (res as { user?: { id?: string }; user_id?: string }).user?.id ??
        (res as { user_id?: string }).user_id ??
        (res as { id?: string }).id ??
        null;
      setToken(res.access);
      setTokenState(res.access);
      setUser(res.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      syncToExtension("cortexflow_user_id", userId ?? undefined);
      syncUserToExtension(userId, res.user?.name ?? undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const res = await registerApi(data);
      const userId = res.user?.id ?? null;
      setToken(res.access);
      setTokenState(res.access);
      setUser(res.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      syncToExtension("cortexflow_user_id", userId ?? undefined);
      syncUserToExtension(userId, res.user?.name ?? undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Logout endpoint may fail — clear locally regardless
    }
    clearToken();
    setTokenState(null);
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    syncToExtension("cortexflow_user_id", null);
    syncUserToExtension(null); // removes cortexflow_user_id and cortexflow_user_name
    localStorage.removeItem("neuroweave_active_session");
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider");
  return context;
}
