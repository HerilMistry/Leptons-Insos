import { useQuery } from "@tanstack/react-query";
import { getDashboardAnalytics } from "@/api/dashboard";
import { getSessionHistory } from "@/api/sessions";

export function useSessionHistory() {
  return useQuery({
    queryKey: ["sessions", "history"],
    queryFn: getSessionHistory,
  });
}

export function useDashboardAnalytics(sessionId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "analytics", sessionId],
    queryFn: () => getDashboardAnalytics(sessionId!),
    enabled: !!sessionId,
  });
}
