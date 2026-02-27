import React, { createContext, useContext, useState, useCallback } from "react";
import { startSession as startSessionApi, stopSession as stopSessionApi } from "@/api/sessions";
import type { TaskType, StartSessionRequest } from "@/types/api";
import { ACTIVE_SESSION_KEY } from "@/utils/constants";
import { writeLocalSession } from "@/utils/sessionHistory";

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(loadStoredSession);

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
  }, []);

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
  }, [activeSession]);

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
