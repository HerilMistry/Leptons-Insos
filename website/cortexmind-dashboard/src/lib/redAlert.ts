/**
 * Red Alert System
 * ----------------
 * Evaluates rolling averages + trend and fires a red-alert state
 * when cognitive risk is dangerously high.
 */

import type { TenMinSummary } from "./rollingAggregator";

export interface RedAlertState {
  active: boolean;
  reason: string;
}

/** Evaluate whether a red alert should fire. */
export function evaluateRedAlert(summary: TenMinSummary): RedAlertState {
  const { averages, riskTrend } = summary;

  if (averages.avgRisk > 0.75) {
    return { active: true, reason: "Average risk exceeds 75% over the last 10 minutes." };
  }
  if (riskTrend === "rising" && averages.avgRisk > 0.65) {
    return { active: true, reason: "Risk is climbing and already above 65%." };
  }
  if (averages.avgConflict > 0.80) {
    return { active: true, reason: "Accumulated cognitive conflict exceeds 80%." };
  }

  return { active: false, reason: "" };
}
