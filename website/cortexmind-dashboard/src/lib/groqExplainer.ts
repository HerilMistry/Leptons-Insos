/**
 * Groq Frontend Explainer
 * -----------------------
 * Calls the Groq LLM API directly from the browser to generate
 * a plain-language neuro report from session history data.
 *
 * API key is read from VITE_GROQ_API_KEY (Vite env variable).
 */

import type { TenMinSummary } from "./rollingAggregator";
import type { Session } from "@/types/api";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
  // Vite exposes env vars as import.meta.env.VITE_*
  const key = import.meta.env?.VITE_GROQ_API_KEY ?? "";
  if (!key) {
    console.warn("[GroqExplainer] VITE_GROQ_API_KEY is not set");
  }
  return key as string;
}

export interface NeuroReport {
  explanation: string;
  recommendation: string;
}

/**
 * Generate a short, actionable neuro-report from the 10-min summary.
 * Falls back to a local heuristic if the API key is missing or the call fails.
 */
export async function generateNeuroReport(
  summary: TenMinSummary
): Promise<NeuroReport> {
  const apiKey = getApiKey();

  // ── Local fallback when no API key ────────────────────────
  if (!apiKey) {
    return localFallbackReport(summary);
  }

  const { averages, dominantMetric, riskTrend } = summary;

  const userMsg = [
    `10-minute rolling averages:`,
    `  Risk: ${(averages.avgRisk * 100).toFixed(1)}%`,
    `  Instability: ${(averages.avgInstability * 100).toFixed(1)}%`,
    `  Drift: ${(averages.avgDrift * 100).toFixed(1)}%`,
    `  Fatigue: ${(averages.avgFatigue * 100).toFixed(1)}%`,
    `  Conflict: ${(averages.avgConflict * 100).toFixed(1)}%`,
    `  ECN: ${(averages.avgECN * 100).toFixed(1)}%`,
    `  DMN: ${(averages.avgDMN * 100).toFixed(1)}%`,
    `Dominant metric: ${dominantMetric}`,
    `Risk trend: ${riskTrend}`,
    ``,
    `Respond in valid JSON only: { "explanation": "...", "recommendation": "..." }`,
  ].join("\n");

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a neuroscience coach. Explain brain network activity in simple language. Keep it short and actionable. Always respond with valid JSON containing exactly two keys: explanation and recommendation.",
          },
          { role: "user", content: userMsg },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.warn("[GroqExplainer] API error", res.status);
      return localFallbackReport(summary);
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as NeuroReport;
    return {
      explanation: parsed.explanation || "No explanation available.",
      recommendation: parsed.recommendation || "Take a short break.",
    };
  } catch (err) {
    console.warn("[GroqExplainer] fetch failed, using fallback", err);
    return localFallbackReport(summary);
  }
}

/** Deterministic fallback when Groq is unavailable. */
function localFallbackReport(summary: TenMinSummary): NeuroReport {
  const { averages, dominantMetric, riskTrend } = summary;
  const pct = (v: number) => (v * 100).toFixed(0) + "%";

  let explanation = "";
  let recommendation = "";

  if (dominantMetric === "instability") {
    explanation = `Your Salience Network is over-active (instability ${pct(averages.avgInstability)}). Frequent context switches are fragmenting your attention.`;
    recommendation = "Close unnecessary tabs and commit to one task for the next 5 minutes.";
  } else if (dominantMetric === "drift") {
    explanation = `Your Default Mode Network is dominating (drift ${pct(averages.avgDrift)}). You're mentally drifting away from the task.`;
    recommendation = "Re-read the last paragraph or re-state your current goal out loud.";
  } else if (dominantMetric === "fatigue") {
    explanation = `Executive resources are depleted (fatigue ${pct(averages.avgFatigue)}). Your brain needs recovery time.`;
    recommendation = "Take a 5-minute break — walk, stretch, or look away from the screen.";
  } else {
    explanation = `Overall cognitive risk is ${pct(averages.avgRisk)} with a ${riskTrend} trend.`;
    recommendation = riskTrend === "rising"
      ? "Risk is climbing — consider a micro-break before it peaks."
      : "You're in a stable zone. Keep up the focused work.";
  }

  return { explanation, recommendation };
}


// ═══════════════════════════════════════════════════════════════
// SESSION-HISTORY–BASED REPORT
// ═══════════════════════════════════════════════════════════════

export interface SessionReport {
  title: string;
  overview: string;
  instabilityAnalysis: string;
  driftAnalysis: string;
  fatigueAnalysis: string;
  deepWorkAnalysis: string;
  recommendations: string[];
  generatedAt: number;
}

/**
 * Aggregate session-level metrics into a single object
 * that can be sent to Groq or used for a local fallback.
 */
export interface SessionAggregate {
  sessionCount: number;
  totalWindows: number;
  totalDeepWorkWindows: number;
  avgInstability: number;
  avgDrift: number;
  avgFatigue: number;
  avgDeepWorkRatio: number;
  totalSwitchCount: number;
  taskTypes: string[];
  totalDurationMin: number;
}

export function aggregateSessions(sessions: Session[]): SessionAggregate {
  const n = sessions.length || 1;
  let sumI = 0, sumD = 0, sumF = 0, sumDW = 0, sumSwitch = 0, sumDur = 0;
  let totalWin = 0, totalDWWin = 0;
  const taskSet = new Set<string>();

  for (const s of sessions) {
    sumI += s.avg_instability ?? 0;
    sumD += s.avg_drift ?? 0;
    sumF += s.avg_fatigue ?? 0;
    sumDW += s.deep_work_ratio ?? 0;
    sumSwitch += s.switch_count ?? 0;
    sumDur += s.duration_minutes ?? 0;
    totalWin += s.total_windows ?? 0;
    totalDWWin += s.deep_work_windows ?? 0;
    taskSet.add(s.task_type);
  }

  return {
    sessionCount: sessions.length,
    totalWindows: totalWin,
    totalDeepWorkWindows: totalDWWin,
    avgInstability: sumI / n,
    avgDrift: sumD / n,
    avgFatigue: sumF / n,
    avgDeepWorkRatio: sumDW / n,
    totalSwitchCount: sumSwitch,
    taskTypes: Array.from(taskSet),
    totalDurationMin: sumDur,
  };
}

/**
 * Generate a comprehensive neurological report from recent sessions
 * using the Groq LLM. Falls back to a local heuristic if no API key.
 */
export async function generateSessionReport(
  sessions: Session[],
): Promise<SessionReport> {
  const agg = aggregateSessions(sessions);
  const apiKey = getApiKey();

  if (!apiKey) {
    return localSessionFallback(agg);
  }

  const pct = (v: number) => (v * 100).toFixed(1) + "%";

  const userMsg = [
    `Analyze these cognitive session metrics from the last 10 minutes:`,
    ``,
    `Sessions: ${agg.sessionCount}`,
    `Task types: ${agg.taskTypes.join(", ")}`,
    `Total duration: ${agg.totalDurationMin} min`,
    `Total telemetry windows: ${agg.totalWindows}`,
    ``,
    `Averaged Metrics:`,
    `  Instability (Salience Network overload): ${pct(agg.avgInstability)}`,
    `  Drift (Default Mode Network intrusion): ${pct(agg.avgDrift)}`,
    `  Fatigue (Executive Control depletion): ${pct(agg.avgFatigue)}`,
    `  Deep Work Ratio: ${pct(agg.avgDeepWorkRatio)}`,
    `  Total context switches: ${agg.totalSwitchCount}`,
    ``,
    `Generate a comprehensive neurological assessment. Respond in valid JSON:`,
    `{`,
    `  "title": "short title for this report",`,
    `  "overview": "2-3 sentence high-level summary of cognitive state",`,
    `  "instabilityAnalysis": "analysis of Salience Network / attention switching",`,
    `  "driftAnalysis": "analysis of Default Mode Network / mind wandering",`,
    `  "fatigueAnalysis": "analysis of Executive Control Network / mental fatigue",`,
    `  "deepWorkAnalysis": "analysis of deep work quality and sustained focus",`,
    `  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "actionable recommendation 3"]`,
    `}`,
  ].join("\n");

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a neuroscience coach analyzing brain network activity during focused work sessions. " +
              "Explain findings using neuroscience concepts (Executive Control Network, Default Mode Network, " +
              "Salience Network) in accessible language. Be specific and actionable. " +
              "Always respond with valid JSON matching the requested schema.",
          },
          { role: "user", content: userMsg },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      console.warn("[GroqExplainer] API error", res.status);
      return localSessionFallback(agg);
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Omit<SessionReport, "generatedAt">;

    return {
      title: parsed.title || "Cognitive Assessment",
      overview: parsed.overview || "No overview available.",
      instabilityAnalysis: parsed.instabilityAnalysis || "",
      driftAnalysis: parsed.driftAnalysis || "",
      fatigueAnalysis: parsed.fatigueAnalysis || "",
      deepWorkAnalysis: parsed.deepWorkAnalysis || "",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      generatedAt: Date.now(),
    };
  } catch (err) {
    console.warn("[GroqExplainer] session report fetch failed", err);
    return localSessionFallback(agg);
  }
}

/** Local fallback for session-based reports */
function localSessionFallback(agg: SessionAggregate): SessionReport {
  const pct = (v: number) => (v * 100).toFixed(0) + "%";

  const recs: string[] = [];
  if (agg.avgInstability > 0.5) recs.push("Reduce tab switching — your Salience Network is over-firing.");
  if (agg.avgDrift > 0.5) recs.push("Re-engage with your task — the Default Mode Network is taking over.");
  if (agg.avgFatigue > 0.5) recs.push("Take a 5-minute break to restore executive resources.");
  if (agg.avgDeepWorkRatio < 0.5) recs.push("Block distractions to improve deep work quality.");
  if (recs.length === 0) recs.push("Great work — maintain your current pace.");

  return {
    title: `Cognitive Report — ${agg.sessionCount} Session(s)`,
    overview: `Across ${agg.sessionCount} session(s) over ${agg.totalDurationMin} minutes, your average instability was ${pct(agg.avgInstability)}, drift ${pct(agg.avgDrift)}, fatigue ${pct(agg.avgFatigue)}, with a deep work ratio of ${pct(agg.avgDeepWorkRatio)}.`,
    instabilityAnalysis: agg.avgInstability > 0.5
      ? `Your Salience Network is overactive at ${pct(agg.avgInstability)}. With ${agg.totalSwitchCount} context switches, attention fragmentation is high.`
      : `Instability is moderate at ${pct(agg.avgInstability)}. Your Salience Network is managing attention transitions well.`,
    driftAnalysis: agg.avgDrift > 0.5
      ? `Default Mode Network intrusion is elevated at ${pct(agg.avgDrift)}. Mind wandering is reducing task engagement.`
      : `Drift is within normal range at ${pct(agg.avgDrift)}. Your task-positive networks are maintaining control.`,
    fatigueAnalysis: agg.avgFatigue > 0.5
      ? `Executive Control Network depletion is significant at ${pct(agg.avgFatigue)}. Cognitive resources are running low.`
      : `Fatigue at ${pct(agg.avgFatigue)} is manageable. Your executive resources are holding up.`,
    deepWorkAnalysis: agg.avgDeepWorkRatio >= 0.7
      ? `Excellent deep work ratio of ${pct(agg.avgDeepWorkRatio)}. You're sustaining high-quality focused attention.`
      : `Deep work ratio of ${pct(agg.avgDeepWorkRatio)} could be improved. Consider longer uninterrupted focus blocks.`,
    recommendations: recs,
    generatedAt: Date.now(),
  };
}
