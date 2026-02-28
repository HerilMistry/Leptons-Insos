/**
 * Detailed Report — Session-History–Based Neurological Report
 * ===========================================================
 * Fetches user session history, filters sessions from the last 10 minutes,
 * generates a comprehensive Groq-powered neurological report, and offers
 * PDF download. Keeps only the last 5 reports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Activity,
  Wind,
  Battery,
  Zap,
  FileText,
  Download,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { getSessionHistory } from "@/api/sessions";
import {
  generateSessionReport,
  aggregateSessions,
  type SessionReport,
  type SessionAggregate,
} from "@/lib/groqExplainer";
import { downloadReportAsPDF } from "@/lib/pdfExport";
import type { Session } from "@/types/api";

// ── helpers ──────────────────────────────────────────────────

const pct = (v: number | null | undefined) =>
  v != null ? `${(v * 100).toFixed(1)}%` : "—";

function severityColor(v: number): string {
  if (v >= 0.65) return "#ef4444";
  if (v >= 0.40) return "#f59e0b";
  return "#22c55e";
}

function filterLast10Min(sessions: Session[]): Session[] {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes ago
  return sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff);
}

// ── Metric bar (reused) ─────────────────────────────────────

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
  const p = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>
          {p}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${p}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Session table ───────────────────────────────────────────

function SessionTable({ sessions }: { sessions: Session[] }) {
  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground">
            <th className="text-left py-1.5 px-2">Task</th>
            <th className="text-left py-1.5 px-2">Started</th>
            <th className="text-right py-1.5 px-2">Dur.</th>
            <th className="text-right py-1.5 px-2">I</th>
            <th className="text-right py-1.5 px-2">D</th>
            <th className="text-right py-1.5 px-2">F</th>
            <th className="text-right py-1.5 px-2">Deep&nbsp;Work</th>
            <th className="text-right py-1.5 px-2">Switches</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-white/5">
              <td className="py-1 px-2 font-medium">{s.task_type}</td>
              <td className="py-1 px-2 text-muted-foreground">
                {new Date(s.started_at).toLocaleTimeString()}
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {s.duration_minutes ?? "—"}m
              </td>
              <td className="py-1 px-2 text-right font-mono">{pct(s.avg_instability)}</td>
              <td className="py-1 px-2 text-right font-mono">{pct(s.avg_drift)}</td>
              <td className="py-1 px-2 text-right font-mono">{pct(s.avg_fatigue)}</td>
              <td className="py-1 px-2 text-right font-mono">{pct(s.deep_work_ratio)}</td>
              <td className="py-1 px-2 text-right font-mono">{s.switch_count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Report card ─────────────────────────────────────────────

function ReportCard({
  report,
  sessions,
  isLatest,
}: {
  report: SessionReport;
  sessions: Session[];
  isLatest: boolean;
}) {
  return (
    <Card
      className={`bg-card border-border border-l-4 ${
        isLatest ? "border-l-indigo-500" : "border-l-indigo-500/30"
      }`}
    >
      <CardHeader className="pb-1 pt-3 px-5">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-400" />
            {report.title}
            {isLatest && (
              <span className="text-xs text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">
                latest
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => downloadReportAsPDF(report, sessions)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-4">
        {/* Overview */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
          <p className="text-sm text-foreground">{report.overview}</p>
        </div>

        {/* Analysis sections */}
        <div className="grid md:grid-cols-2 gap-4">
          <AnalysisSection
            icon={Activity}
            iconColor="text-amber-400"
            title="Instability (Salience Network)"
            text={report.instabilityAnalysis}
          />
          <AnalysisSection
            icon={Wind}
            iconColor="text-blue-400"
            title="Drift (Default Mode Network)"
            text={report.driftAnalysis}
          />
          <AnalysisSection
            icon={Battery}
            iconColor="text-purple-400"
            title="Fatigue (Executive Control)"
            text={report.fatigueAnalysis}
          />
          <AnalysisSection
            icon={Zap}
            iconColor="text-green-400"
            title="Deep Work Quality"
            text={report.deepWorkAnalysis}
          />
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase mb-2">
              Recommendations
            </p>
            <ul className="space-y-1.5">
              {report.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-green-400"
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnalysisSection({
  icon: Icon,
  iconColor,
  title,
  text,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  text: string;
}) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className={`h-3 w-3 ${iconColor}`} />
        {title}
      </p>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═════════════════════════════════════════════════════════════

export default function DetailedReportPage() {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [aggregate, setAggregate] = useState<SessionAggregate | null>(null);
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch session history ─────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const history = await getSessionHistory();
      setAllSessions(history);
      const recent = filterLast10Min(history);
      setRecentSessions(recent);
      if (recent.length > 0) {
        setAggregate(aggregateSessions(recent));
      } else {
        setAggregate(null);
      }
    } catch (err: any) {
      setError("Failed to fetch session history. Is the backend running?");
    }
    setFetching(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    // Re-fetch every 30 s to pick up newly ended sessions
    const id = setInterval(fetchSessions, 30_000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  // ── Generate report ───────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (recentSessions.length === 0) return;
    setLoading(true);
    try {
      const r = await generateSessionReport(recentSessions);
      setReports((prev) => [r, ...prev].slice(0, 5));
    } catch {
      // Ignore — fallback is handled inside generateSessionReport
    }
    setLoading(false);
  }, [recentSessions]);

  const hasRecent = recentSessions.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Detailed Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive neurological analysis from your recent sessions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSessions}
              disabled={fetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${fetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!hasRecent || loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {loading ? "Generating…" : "Generate Report"}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <Card className="border-red-500/40 bg-red-500/10">
            <CardContent className="py-3 text-red-400 text-sm text-center">
              {error}
            </CardContent>
          </Card>
        )}

        {/* No recent sessions */}
        {!fetching && !hasRecent && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                No sessions in the last 10 minutes
              </h2>
              <p className="text-muted-foreground text-sm mb-1">
                Start a session and come back here to generate a neurological analysis.
              </p>
              <p className="text-muted-foreground text-xs">
                Found {allSessions.length} total session(s) in history.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Has recent sessions */}
        {hasRecent && aggregate && (
          <>
            {/* Summary row */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Session overview */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Recent Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-foreground">
                      {recentSessions.length}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      in last 10 min
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      Tasks:{" "}
                      <span className="text-foreground font-medium">
                        {aggregate.taskTypes.join(", ")}
                      </span>
                    </div>
                    <div>
                      Duration:{" "}
                      <span className="text-foreground font-medium">
                        {aggregate.totalDurationMin} min
                      </span>
                    </div>
                    <div>
                      Switches:{" "}
                      <span className="text-foreground font-medium">
                        {aggregate.totalSwitchCount}
                      </span>
                    </div>
                    <div>
                      Windows:{" "}
                      <span className="text-foreground font-medium">
                        {aggregate.totalWindows}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metric bars */}
              <Card className="bg-card border-border lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Aggregated Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricBar
                    label="Instability"
                    value={aggregate.avgInstability}
                    icon={Activity}
                    color={severityColor(aggregate.avgInstability)}
                  />
                  <MetricBar
                    label="Drift"
                    value={aggregate.avgDrift}
                    icon={Wind}
                    color={severityColor(aggregate.avgDrift)}
                  />
                  <MetricBar
                    label="Fatigue"
                    value={aggregate.avgFatigue}
                    icon={Battery}
                    color={severityColor(aggregate.avgFatigue)}
                  />
                  <MetricBar
                    label="Deep Work"
                    value={aggregate.avgDeepWorkRatio}
                    icon={Zap}
                    color={aggregate.avgDeepWorkRatio >= 0.6 ? "#22c55e" : aggregate.avgDeepWorkRatio >= 0.3 ? "#f59e0b" : "#ef4444"}
                  />
                </CardContent>
              </Card>

              {/* Quick risk assessment */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Quick Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  {aggregate.avgInstability > 0.5 ? (
                    <QuickFlag icon={AlertTriangle} color="text-red-400" text="High attention fragmentation" />
                  ) : (
                    <QuickFlag icon={CheckCircle2} color="text-green-400" text="Attention stable" />
                  )}
                  {aggregate.avgDrift > 0.5 ? (
                    <QuickFlag icon={AlertTriangle} color="text-red-400" text="Significant mind wandering" />
                  ) : (
                    <QuickFlag icon={CheckCircle2} color="text-green-400" text="Focus maintained" />
                  )}
                  {aggregate.avgFatigue > 0.5 ? (
                    <QuickFlag icon={AlertTriangle} color="text-amber-400" text="Cognitive fatigue rising" />
                  ) : (
                    <QuickFlag icon={CheckCircle2} color="text-green-400" text="Energy levels OK" />
                  )}
                  {aggregate.avgDeepWorkRatio >= 0.5 ? (
                    <QuickFlag icon={CheckCircle2} color="text-green-400" text={`Good deep work (${pct(aggregate.avgDeepWorkRatio)})`} />
                  ) : (
                    <QuickFlag icon={AlertTriangle} color="text-amber-400" text={`Low deep work (${pct(aggregate.avgDeepWorkRatio)})`} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Session table */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Sessions (Last 10 Minutes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SessionTable sessions={recentSessions} />
              </CardContent>
            </Card>
          </>
        )}

        {/* Reports list (last 5) */}
        {reports.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4 text-indigo-400" />
              Neurological Reports ({reports.length}/5)
              {loading && (
                <span className="text-xs text-indigo-400 animate-pulse">
                  generating…
                </span>
              )}
            </h3>
            {reports.map((r, i) => (
              <ReportCard
                key={r.generatedAt}
                report={r}
                sessions={recentSessions}
                isLatest={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function QuickFlag({
  icon: Icon,
  color,
  text,
}: {
  icon: React.ElementType;
  color: string;
  text: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm ${color}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
