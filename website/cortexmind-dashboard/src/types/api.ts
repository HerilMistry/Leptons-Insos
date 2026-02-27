// === Auth Types ===
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// === Session Types ===
export type TaskType = "Writing" | "Reading" | "Coding" | "Watching" | "Research";

export interface Session {
  id: string;
  task_type: TaskType;
  task_label?: string;
  task_description?: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  deep_work_ratio: number | null;
  avg_instability: number | null;
  switch_count: number | null;
}

export interface StartSessionRequest {
  task_type: TaskType;
  task_label?: string;
  task_description?: string;
  estimated_duration?: number;
}

export interface StartSessionResponse {
  session_id: string;
  baseline_profile: Record<string, number>;
}

// === Dashboard / Analytics Types ===
export interface TimelinePoint {
  timestamp: string;
  instability: number;
  drift: number;
  fatigue: number;
}

export interface NetworkState {
  ECN: number;
  DMN: number;
  Salience: number;
  Load: number;
}

export interface Intervention {
  timestamp: string;
  type: "instability" | "drift" | "fatigue";
  severity: number;
}

export interface DashboardAnalytics {
  timeline: TimelinePoint[];
  network_state: NetworkState;
  deep_work_ratio: number;
  switch_count: number;
  avg_instability: number;
  interventions: Intervention[];
}
