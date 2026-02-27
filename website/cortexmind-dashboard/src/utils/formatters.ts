import { REENTRY_COST_MINUTES_PER_SWITCH } from "./constants";

/** Format a 0–1 ratio as a percentage string, e.g. "72%" */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Convert switch count to re-entry cost string, e.g. "1h 30m" */
export function formatReentryCost(switchCount: number | null | undefined): string {
  if (switchCount == null) return "—";
  const totalMinutes = switchCount * REENTRY_COST_MINUTES_PER_SWITCH;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Format duration in minutes to human-readable, e.g. "1h 25m" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format an ISO date string to a short date */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
