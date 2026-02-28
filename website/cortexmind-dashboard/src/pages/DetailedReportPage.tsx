/**
 * Detailed Report — BrainDashboard Page
 * ======================================
 * Fully frontend: rolling aggregation, Groq explainability,
 * red-alert system, and focus-reset exercise.
 *
 * Telemetry arrives every 5 s via chrome.storage / postMessage bridge.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Brain,
  Activity,
  Wind,
  Battery,
  Zap,
  FileText,
  RefreshCw,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import FocusExercise from "@/components/dashboard/FocusExercise";
import { aggregator, type TelemetryEntry, type TenMinSummary } from "@/lib/rollingAggregator";
import { generateNeuroReport, type NeuroReport } from "@/lib/groqExplainer";
import { evaluateRedAlert, type RedAlertState } from "@/lib/redAlert";

// ── Circular Gauge ──────────────────────────────────────────

function RiskGauge({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 75 ? "#ef4444" : pct >= 45 ? "#f59e0b" : "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-white/10"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
      </svg>
      <span
        className="text-3xl font-bold -mt-[94px] mb-[54px]"
        style={{ color }}
      >
        {pct}%
      </span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
        Risk
      </span>
    </div>
  );
}

// ── Metric Bar ──────────────────────────────────────────────

function MetricBar({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Trend Arrow ─────────────────────────────────────────────

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "rising")
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-sm font-medium">
        <TrendingUp className="h-4 w-4" /> Rising
      </span>
    );
  if (trend === "falling")
    return (
      <span className="inline-flex items-center gap-1 text-green-400 text-sm font-medium">
        <TrendingDown className="h-4 w-4" /> Falling
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
      <Minus className="h-4 w-4" /> Stable
    </span>
  );
}

// ── Red Alert Modal ─────────────────────────────────────────

function RedAlertModal({
  reason,
  onStartExercise,
  onDismiss,
}: {
  reason: string;
  onStartExercise: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border-2 border-red-500/60 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-red-900/30">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
          <h2 className="text-xl font-bold text-red-400">
            High Cognitive Risk Detected
          </h2>
        </div>
        <p className="text-muted-foreground mb-6">{reason}</p>
        <div className="flex gap-3">
          <Button
            onClick={onStartExercise}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Start Focus Reset
          </Button>
          <Button variant="outline" onClick={onDismiss} className="flex-1">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── History Table ───────────────────────────────────────────

function RecentHistory({ entries }: { entries: ReadonlyArray<TelemetryEntry> }) {
  const recent = entries.slice(-20).reverse();
  if (recent.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        No telemetry data yet. Start a session to see live data.
      </p>
    );
  }
  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground">
            <th className="text-left py-1 px-2">Time</th>
            <th className="text-right py-1 px-2">Risk</th>
            <th className="text-right py-1 px-2">I</th>
            <th className="text-right py-1 px-2">D</th>
            <th className="text-right py-1 px-2">F</th>
            <th className="text-right py-1 px-2">Conflict</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((e, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="py-1 px-2 text-muted-foreground">
                {new Date(e.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {(e.risk * 100).toFixed(0)}%
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {(e.instability * 100).toFixed(0)}%
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {(e.drift * 100).toFixed(0)}%
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {(e.fatigue * 100).toFixed(0)}%
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {(e.conflict * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═════════════════════════════════════════════════════════════

export default function DetailedReportPage() {
  // ── Local state ────────────────────────────────────────────
  const [summary, setSummary] = useState<TenMinSummary | null>(null);
  const [report, setReport] = useState<NeuroReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [redAlert, setRedAlert] = useState<RedAlertState>({ active: false, reason: "" });
  const [showExercise, setShowExercise] = useState(false);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [entries, setEntries] = useState<ReadonlyArray<TelemetryEntry>>([]);
  const alertDismissedRef = useRef(false);

  // ── Listen for telemetry via chrome.storage or extension postMessage ──
  useEffect(() => {
    // Handler for messages from the extension content script
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "INFERENCE_RESULT" && !event.data?.__cortexflow_telemetry) return;

      const payload = event.data?.payload ?? event.data?.data ?? event.data;
      if (!payload || typeof payload.risk !== "number") return;

      const entry: TelemetryEntry = {
        timestamp: Date.now(),
        risk: payload.risk ?? 0,
        instability: payload.instability ?? 0,
        drift: payload.drift ?? 0,
        fatigue: payload.fatigue ?? 0,
        conflict: payload.accumulated_conflict ?? 0,
        ECN: payload.network?.ECN ?? 0,
        DMN: payload.network?.DMN ?? 0,
        Salience: payload.network?.Salience ?? 0,
        Load: payload.network?.Load ?? 0,
      };

      aggregator.push(entry);
      const newSummary = aggregator.get10MinSummary();
      setSummary(newSummary);
      setEntries([...aggregator.getEntries()]);

      // Evaluate red alert
      if (!alertDismissedRef.current) {
        const alert = evaluateRedAlert(newSummary);
        setRedAlert(alert);
      }
    }

    window.addEventListener("message", onMessage);

    // Also listen via chrome.runtime if available (popup context)
    let chromeListener: ((msg: any) => void) | null = null;
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chromeListener = (msg: any) => {
        if (msg.type === "INFERENCE_RESULT" && msg.payload) {
          onMessage({ data: { type: "INFERENCE_RESULT", payload: msg.payload } } as any);
        }
      };
      chrome.runtime.onMessage.addListener(chromeListener);
    }

    // Poll chrome.storage for latest inference (fallback for when postMessage isn't bridged)
    const pollId = setInterval(() => {
      try {
        const stored = localStorage.getItem("cortexflow_latest_inference");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.risk === "number") {
            // Deduplicate via timestamp
            const lastEntry = aggregator.getEntries().slice(-1)[0];
            if (!lastEntry || Date.now() - lastEntry.timestamp > 4000) {
              onMessage({ data: { type: "INFERENCE_RESULT", payload: parsed } } as any);
            }
          }
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => {
      window.removeEventListener("message", onMessage);
      if (chromeListener && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(chromeListener);
      }
      clearInterval(pollId);
    };
  }, []);

  // ── Generate report via Groq ─────────────────────────────
  const handleGenerateReport = useCallback(async () => {
    if (!summary) return;
    setReportLoading(true);
    try {
      const r = await generateNeuroReport(summary);
      setReport(r);
    } catch {
      setReport({
        explanation: "Failed to generate report.",
        recommendation: "Try again in a moment.",
      });
    }
    setReportLoading(false);
  }, [summary]);

  // ── Focus exercise callbacks ──────────────────────────────
  const handleExerciseComplete = useCallback(() => {
    setShowExercise(false);
    setExerciseDone(true);
    aggregator.reset();
    setSummary(null);
    setRedAlert({ active: false, reason: "" });
    setReport(null);
    setEntries([]);
    alertDismissedRef.current = false;
    // Auto-dismiss "Session Reset Complete" after 5 s
    setTimeout(() => setExerciseDone(false), 5000);
  }, []);

  const handleDismissAlert = useCallback(() => {
    alertDismissedRef.current = true;
    setRedAlert({ active: false, reason: "" });
  }, []);

  // ── Computed values ───────────────────────────────────────
  const avg = summary?.averages;
  const hasData = summary && summary.entryCount > 0;

  return (
    <AppLayout>
      {/* Red alert border flash */}
      {redAlert.active && (
        <div className="fixed inset-0 pointer-events-none z-[9980] border-4 border-red-500 rounded-lg animate-pulse" />
      )}

      {/* Red alert modal */}
      {redAlert.active && (
        <RedAlertModal
          reason={redAlert.reason}
          onStartExercise={() => {
            setRedAlert({ active: false, reason: "" });
            setShowExercise(true);
          }}
          onDismiss={handleDismissAlert}
        />
      )}

      {/* Focus exercise overlay */}
      {showExercise && (
        <FocusExercise
          onComplete={handleExerciseComplete}
          onCancel={() => setShowExercise(false)}
        />
      )}

      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detailed Report</h1>
            <p className="text-sm text-muted-foreground">
              Live rolling 10-minute cognitive analysis
              {hasData && (
                <span className="ml-2 text-xs text-primary">
                  ({summary.entryCount} samples)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateReport}
              disabled={!hasData || reportLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {reportLoading ? "Generating…" : "Generate Report"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowExercise(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Focus Exercise
            </Button>
          </div>
        </div>

        {/* Reset complete banner */}
        {exerciseDone && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="py-4 text-center text-green-400 font-medium">
              ✓ Session Reset Complete — rolling buffer cleared.
            </CardContent>
          </Card>
        )}

        {/* No data state */}
        {!hasData && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Brain className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Waiting for telemetry…
              </h2>
              <p className="text-muted-foreground text-sm">
                Start a session from the extension or the Start Session page.
                Data will appear here every 5 seconds.
              </p>
            </CardContent>
          </Card>
        )}

        {hasData && avg && (
          <>
            {/* Top row: Gauge + Metrics + Trend */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Risk gauge */}
              <Card className="bg-card border-border flex items-center justify-center">
                <CardContent className="py-8">
                  <RiskGauge value={avg.avgRisk} />
                </CardContent>
              </Card>

              {/* Metric bars */}
              <Card className="bg-card border-border lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    10-Min Averages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricBar label="Instability" value={avg.avgInstability} icon={Activity} color="#f59e0b" />
                  <MetricBar label="Drift" value={avg.avgDrift} icon={Wind} color="#3b82f6" />
                  <MetricBar label="Fatigue" value={avg.avgFatigue} icon={Battery} color="#8b5cf6" />
                  <MetricBar label="Conflict" value={avg.avgConflict} icon={Zap} color="#ef4444" />
                </CardContent>
              </Card>

              {/* Trend + dominant metric */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Risk Trend</p>
                    <TrendArrow trend={summary.riskTrend} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Dominant Metric
                    </p>
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {summary.dominantMetric}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ECN (Executive)</p>
                    <span className="text-sm font-mono">{(avg.avgECN * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">DMN (Default Mode)</p>
                    <span className="text-sm font-mono">{(avg.avgDMN * 100).toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Groq Report */}
            {report && (
              <Card className="bg-card border-border border-l-4 border-l-indigo-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-indigo-400" />
                    Neuro Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Explanation</p>
                    <p className="text-sm text-foreground">{report.explanation}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Recommendation</p>
                    <p className="text-sm text-green-400">{report.recommendation}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent telemetry history */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Recent Telemetry (last 20)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecentHistory entries={entries} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
