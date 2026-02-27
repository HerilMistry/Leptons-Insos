import type { Session } from "@/types/api";
import { SESSION_HISTORY_KEY } from "./constants";

/** Read all locally-persisted completed sessions (newest first) */
export function readLocalSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Prepend a completed session to local history (deduplicates by id) */
export function writeLocalSession(session: Session): void {
  try {
    const existing = readLocalSessions().filter((s) => s.id !== session.id);
    localStorage.setItem(
      SESSION_HISTORY_KEY,
      JSON.stringify([session, ...existing])
    );
  } catch {
    // storage quota — silently ignore
  }
}

/** Clear all locally-stored session history */
export function clearLocalSessions(): void {
  localStorage.removeItem(SESSION_HISTORY_KEY);
}
