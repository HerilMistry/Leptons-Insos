import type { TaskType } from "@/types/api";

export const TASK_TYPES: TaskType[] = [
  "Writing",
  "Reading",
  "Coding",
  "Watching",
  "Research",
];

export const TOKEN_KEY = "neuroweave_token";
export const ACTIVE_SESSION_KEY = "neuroweave_active_session";
export const SESSION_HISTORY_KEY = "neuroweave_session_history";

/** Minutes lost per context switch (used for re-entry cost calculation) */
export const REENTRY_COST_MINUTES_PER_SWITCH = 18;
