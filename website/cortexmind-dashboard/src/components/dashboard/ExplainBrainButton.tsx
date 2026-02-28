import { useState, useCallback, useEffect } from "react";
import type { DashboardAnalytics, Session } from "@/types/api";

/* ── Groq config ──────────────────────────────────────────── */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
  return (import.meta.env?.VITE_GROQ_API_KEY ?? "") as string;
}

/* ── Types ────────────────────────────────────────────────── */
interface Props {
  analytics: DashboardAnalytics | undefined;
  session: Session | undefined;
  allSessions: Session[] | undefined;
}

/* ── Component ────────────────────────────────────────────── */
export default function ExplainBrainButton({ analytics, session, allSessions }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const hasSession = !!(
    analytics &&
    session &&
    (analytics.avg_instability ||
      analytics.network_state?.ECN ||
      analytics.timeline?.length)
  );

  const handleClick = useCallback(async () => {
    setOpen(true);
    setError(null);

    if (!hasSession) {
      setExplanation(null);
      return;
    }

    setLoading(true);
    setExplanation(null);

    // Derive latest values from the most recent timeline point
    const latest = analytics!.timeline?.at(-1);
    const net = analytics!.network_state ?? { ECN: 0, DMN: 0, Salience: 0, Load: 0 };
    const instability = latest?.instability ?? analytics!.avg_instability ?? 0;
    const drift = latest?.drift ?? 0;
    const fatigue = latest?.fatigue ?? 0;
    // Approximate risk from available signals
    const risk = Math.min(
      1,
      instability * 0.35 + drift * 0.30 + fatigue * 0.20 + (1 - net.ECN) * 0.15
    );
    const durationMin = session!.duration_minutes ?? 0;
    const deepWorkPct = Math.round((analytics!.deep_work_ratio ?? 0) * 100);
    const switches = analytics!.switch_count ?? 0;

    // Build session history summary (last 10 sessions)
    const recentSessions = (allSessions ?? []).slice(0, 10);
    let historyBlock = "";
    if (recentSessions.length > 1) {
      const avgDrift = recentSessions.reduce((s, x) => s + (x.avg_drift ?? 0), 0) / recentSessions.length;
      const avgFatigue = recentSessions.reduce((s, x) => s + (x.avg_fatigue ?? 0), 0) / recentSessions.length;
      const avgInstab = recentSessions.reduce((s, x) => s + (x.avg_instability ?? 0), 0) / recentSessions.length;
      const avgDeepWork = recentSessions.reduce((s, x) => s + (x.deep_work_ratio ?? 0), 0) / recentSessions.length;
      const totalSwitches = recentSessions.reduce((s, x) => s + (x.switch_count ?? 0), 0);
      const totalMin = recentSessions.reduce((s, x) => s + (x.duration_minutes ?? 0), 0);
      const taskBreakdown = recentSessions.reduce<Record<string, number>>((acc, x) => {
        acc[x.task_type] = (acc[x.task_type] || 0) + 1;
        return acc;
      }, {});

      historyBlock = `

USER HISTORY (last ${recentSessions.length} sessions, ${Math.round(totalMin)} total minutes):
Average instability: ${Math.round(avgInstab * 100)}%
Average drift: ${Math.round(avgDrift * 100)}%
Average fatigue: ${Math.round(avgFatigue * 100)}%
Average deep work ratio: ${Math.round(avgDeepWork * 100)}%
Total context switches across sessions: ${totalSwitches}
Task distribution: ${Object.entries(taskBreakdown).map(([t, c]) => `${t}(${c})`).join(", ")}
Sessions logged: ${recentSessions.length}`;
    }

    const userPrompt = `Explain my current cognitive state:
Task: ${session!.task_type}
Session duration: ${Math.round(durationMin)} minutes
Instability: ${Math.round(instability * 100)}%
Drift: ${Math.round(drift * 100)}%
Fatigue: ${Math.round(fatigue * 100)}%
Overall risk: ${Math.round(risk * 100)}%
ECN activation: ${Math.round(net.ECN * 100)}%
DMN activation: ${Math.round(net.DMN * 100)}%
Salience Network: ${Math.round(net.Salience * 100)}%
Cognitive load: ${Math.round(net.Load * 100)}%
Deep work achieved: ${deepWorkPct}% of session
Total context switches: ${switches}${historyBlock}

Explain what the Brain Network Activity, Cognitive Timeline, and Network State radar are showing right now and what it means for my focus. If history data is available, compare current session to the user's trends.`;

    const systemPrompt = `You are CortexFlow's cognitive analyst. You explain brain state data to students in clear, warm, human language. You reference the three neural networks: ECN (Executive Control), DMN (Default Mode), Salience Network. Never use bullet points. Write in 3 short paragraphs max. Be specific about the numbers. Be encouraging, not alarming. If user history is provided, compare the current session to their historical patterns and note trends (improving, worsening, or stable). End with one concrete actionable suggestion.`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 400,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setExplanation(data.choices?.[0]?.message?.content ?? "No response.");
    } catch {
      setError("Unable to analyze right now. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [analytics, session, allSessions, hasSession]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          background: loading
            ? "rgba(99,102,241,0.25)"
            : "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.4)",
          color: "#a5b4fc",
          padding: "8px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          cursor: loading ? "wait" : "pointer",
          transition: "background 0.2s",
          animation: loading ? "explain-pulse 1.2s ease-in-out infinite" : "none",
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.currentTarget.style.background = "rgba(99,102,241,0.3)");
        }}
        onMouseLeave={(e) => {
          if (!loading) (e.currentTarget.style.background = "rgba(99,102,241,0.15)");
        }}
      >
        {loading ? "Analyzing..." : "🧠 Explain My Brain State"}
      </button>

      {/* Pulse animation style */}
      <style>{`
        @keyframes explain-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Drawer overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: "relative",
              width: "min(420px, 90vw)",
              maxHeight: "100vh",
              overflowY: "auto",
              background: "#0d0f14",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px 0 0 16px",
              padding: "24px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              animation: "explain-slide-in 0.25s ease-out",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)",
                width: 28,
                height: 28,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>

            {/* Title */}
            <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: "#fff" }}>
              🧠 Cognitive State Analysis
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginBottom: 20,
                letterSpacing: "0.04em",
              }}
            >
              {new Date().toLocaleString()}
            </div>

            {/* Content */}
            {!hasSession && !loading && !error && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>
                Start a session first to get a cognitive analysis.
              </p>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    border: "3px solid rgba(99,102,241,0.2)",
                    borderTopColor: "#6366f1",
                    borderRadius: "50%",
                    animation: "explain-spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  Consulting the cognitive model…
                </p>
              </div>
            )}

            {error && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#ef4444" }}>{error}</p>
            )}

            {explanation && !loading && (
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>
                {explanation.split("\n\n").map((para, i) => (
                  <p key={i} style={{ marginBottom: i < explanation.split("\n\n").length - 1 ? 14 : 0 }}>
                    {para}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Slide-in + spin animations */}
          <style>{`
            @keyframes explain-slide-in {
              from { transform: translateX(100%); opacity: 0; }
              to   { transform: translateX(0); opacity: 1; }
            }
            @keyframes explain-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
