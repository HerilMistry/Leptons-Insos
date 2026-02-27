import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginApi, registerApi, logoutApi } from "@/api/auth";
import { setToken, clearToken, getToken } from "@/api/client";
import type { User, LoginRequest, RegisterRequest } from "@/types/api";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState(false);

  // On mount, if we have a token but no user, we're "authenticated" (user info would come from a /me endpoint)
  const isAuthenticated = !!token;

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await loginApi(data);
      setToken(res.access);
      setTokenState(res.access);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const res = await registerApi(data);
      setToken(res.access);
      setTokenState(res.access);
      setUser(res.user);
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
