import React, { createContext, useContext, useState, useCallback } from "react";
import { startSession as startSessionApi, stopSession as stopSessionApi } from "@/api/sessions";
import type { TaskType, StartSessionRequest } from "@/types/api";
import { ACTIVE_SESSION_KEY } from "@/utils/constants";
import { writeLocalSession } from "@/utils/sessionHistory";
import { useAuthContext } from "@/context/AuthContext";

/** Sync session state into the Chrome extension storage.
 *  Uses window.postMessage → content script bridge (see content/telemetry.js)
 *  because the website is a normal webpage and cannot access chrome.storage directly.
 */
function syncSessionToExtension(
  sessionId: string | null,
  userId: string | null,
  taskType: string | null
) {
  try {
    if (sessionId) {
      window.postMessage(
        {
          __cortexflow: true,
          action: "SET",
          payload: {
            cortexflow_session_id:     String(sessionId),
            cortexflow_user_id:        String(userId ?? ""),
            cortexflow_task_type:      taskType || "general",
            cortexflow_session_active: true,
            cortexflow_session_start:  Date.now(),
          },
        },
        window.location.origin
      );
    } else {
      // Session ended — clear session fields (keep user_id)
      window.postMessage(
        {
          __cortexflow: true,
          action: "SET",
          payload: { cortexflow_session_id: null, cortexflow_session_active: false },
        },
        window.location.origin
      );
      window.postMessage(
        { __cortexflow: true, action: "REMOVE", payload: ["cortexflow_task_type"] },
        window.location.origin
      );
    }
  } catch {
    // Not in extension context
  }
}

interface ActiveSession {
  id: string;
  task_type: TaskType;
  task_label?: string;
  task_description?: string;
  started_at: string;
}

interface SessionContextType {
  activeSession: ActiveSession | null;
  isSessionActive: boolean;
  startSession: (payload: StartSessionRequest) => Promise<void>;
  stopSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function loadStoredSession(): ActiveSession | null {
  try {
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => {
    const stored = loadStoredSession();
    // Discard stale mock-mode IDs (e.g. "session-1772229329139") that are not
    // valid UUIDs — the real backend would reject them with a 500 anyway.
    if (stored && !UUID_RE.test(stored.id)) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }
    return stored;
  });

  const isSessionActive = !!activeSession;

  const startSession = useCallback(async (payload: StartSessionRequest) => {
    const res = await startSessionApi(payload);
    const session: ActiveSession = {
      id: res.session_id,
      task_type: payload.task_type,
      task_label: payload.task_label,
      task_description: payload.task_description,
      started_at: new Date().toISOString(),
    };
    setActiveSession(session);
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));

    // Sync to Chrome extension so telemetry can pick up session immediately
    syncSessionToExtension(res.session_id, user?.id ?? null, payload.task_type);
  }, [user]);

  const stopSession = useCallback(async () => {
    if (!activeSession) return;
    await stopSessionApi(activeSession.id);

    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(activeSession.started_at).getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    // Persist the completed session to localStorage for history
    writeLocalSession({
      id: activeSession.id,
      task_type: activeSession.task_type,
      task_label: activeSession.task_label,
      task_description: activeSession.task_description,
      started_at: activeSession.started_at,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      deep_work_ratio: null,
      avg_instability: null,
      switch_count: null,
    });

    setActiveSession(null);
    localStorage.removeItem(ACTIVE_SESSION_KEY);

    // Tell extension the session ended
    syncSessionToExtension(null, user?.id ?? null, null);
  }, [activeSession, user]);

  return (
    <SessionContext.Provider value={{ activeSession, isSessionActive, startSession, stopSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSessionContext must be used within SessionProvider");
  return context;
}
