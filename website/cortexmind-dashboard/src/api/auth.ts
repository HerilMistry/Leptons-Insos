import { apiFetch } from "./client";
import type { AuthResponse, LoginRequest, RegisterRequest } from "@/types/api";

/**
 * POST /auth/login/
 * Request: { email: string, password: string }
 * Response: { access: string, refresh: string, user: { id, email, name } }
 */
export function loginApi(data: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * POST /auth/register/
 * Request: { email: string, password: string, name: string }
 * Response: { access: string, refresh: string, user: { id, email, name } }
 */
export function registerApi(data: RegisterRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * POST /auth/logout/
 * Invalidates the current token on the server
 */
export function logoutApi(): Promise<void> {
  return apiFetch<void>("/auth/logout/", {
    method: "POST",
  });
}
