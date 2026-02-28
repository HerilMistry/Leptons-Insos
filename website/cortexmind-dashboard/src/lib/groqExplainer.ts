/**
 * Groq Frontend Explainer
 * -----------------------
 * Calls the Groq LLM API directly from the browser to generate
 * a plain-language neuro report from rolling telemetry data.
 *
 * API key is read from VITE_GROQ_API_KEY (Vite env variable).
 */

import type { TenMinSummary } from "./rollingAggregator";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
  // Vite exposes env vars as import.meta.env.VITE_*
  const key = (import.meta as any).env?.VITE_GROQ_API_KEY ?? "";
  if (!key) {
    console.warn("[GroqExplainer] VITE_GROQ_API_KEY is not set");
  }
  return key;
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
