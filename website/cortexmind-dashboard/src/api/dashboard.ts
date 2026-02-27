import { apiFetch } from "./client";
import type { DashboardAnalytics } from "@/types/api";
import { MOCK_MODE } from "@/mocks/mockFlag";
import { MOCK_ANALYTICS, MOCK_ANALYTICS_FALLBACK } from "@/mocks/mockData";

const mockDelay = () => new Promise<void>((r) => setTimeout(r, 800));

/**
 * GET /dashboard/analytics/?session_id=<id>
 * Response: {
 *   timeline: Array<{ timestamp, instability, drift, fatigue }>,
 *   network_state: { ECN, DMN, Salience, Load },
 *   deep_work_ratio: number,
 *   switch_count: number,
 *   avg_instability: number,
 *   interventions: Array<{ timestamp, type, severity }>
 * }
 */
export async function getDashboardAnalytics(sessionId: string): Promise<DashboardAnalytics> {
  if (MOCK_MODE) {
    await mockDelay();
    return MOCK_ANALYTICS[sessionId] ?? MOCK_ANALYTICS_FALLBACK;
  }
  return apiFetch<DashboardAnalytics>(`/dashboard/analytics/?session_id=${sessionId}`);
}
