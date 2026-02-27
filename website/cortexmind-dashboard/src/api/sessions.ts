import { apiFetch } from "./client";
import type { Session, StartSessionRequest, StartSessionResponse } from "@/types/api";
import { MOCK_MODE } from "@/mocks/mockFlag";
import { MOCK_SESSIONS } from "@/mocks/mockData";
import { readLocalSessions } from "@/utils/sessionHistory";

/** Simulate a small async delay so loading states are visible in dev */
const mockDelay = () => new Promise<void>((r) => setTimeout(r, 600));

/**
 * POST /sessions/start/
 * Request: { task_type: string, estimated_duration?: number }
 * Response: { session_id: string, baseline_profile: Record<string, number> }
 */
export async function startSession(data: StartSessionRequest): Promise<StartSessionResponse> {
  if (MOCK_MODE) {
    await mockDelay();
    const uniqueId = `session-${Date.now()}`;
    return { session_id: uniqueId, baseline_profile: { ECN: 0.72, DMN: 0.28, Salience: 0.5, Load: 0.6 } };
  }
  return apiFetch<StartSessionResponse>("/sessions/start/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * POST /sessions/stop/
 * Request: { session_id: string }
 * Response: 204 No Content
 */
export async function stopSession(sessionId: string): Promise<void> {
  if (MOCK_MODE) { await mockDelay(); return; }
  return apiFetch<void>("/sessions/stop/", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

/**
 * GET /sessions/history/
 * Response: Session[]
 */
export async function getSessionHistory(): Promise<Session[]> {
  if (MOCK_MODE) {
    await mockDelay();
    // User-created sessions come first (newest), mock seeds fill the rest
    const local = readLocalSessions();
    const localIds = new Set(local.map((s) => s.id));
    return [...local, ...MOCK_SESSIONS.filter((s) => !localIds.has(s.id))];
  }
  return apiFetch<Session[]>("/sessions/history/");
}

/**
 * GET /sessions/<id>/detail/
 * Response: Session (with full detail)
 */
export async function getSessionDetail(sessionId: string): Promise<Session> {
  if (MOCK_MODE) {
    await mockDelay();
    const local = readLocalSessions();
    return (
      local.find((s) => s.id === sessionId) ??
      MOCK_SESSIONS.find((s) => s.id === sessionId) ??
      MOCK_SESSIONS[0]
    );
  }
  return apiFetch<Session>(`/sessions/${sessionId}/detail/`);
}
