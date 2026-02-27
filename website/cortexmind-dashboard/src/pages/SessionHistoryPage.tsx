import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pencil,
  BookOpen,
  Code2,
  MonitorPlay,
  Search,
  Clock,
  CalendarDays,
  BarChart2,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionHistory } from "@/hooks/useDashboard";
import { formatDuration, formatPercent } from "@/utils/formatters";
import AppLayout from "@/components/layout/AppLayout";
import type { Session } from "@/types/api";

// ─── Task icons + colors ─────────────────────────────────────────────────────
const TASK_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  Coding:   { icon: Code2,       color: "text-blue-400",   bg: "bg-blue-400/10"   },
  Writing:  { icon: Pencil,      color: "text-violet-400", bg: "bg-violet-400/10" },
  Reading:  { icon: BookOpen,    color: "text-emerald-400",bg: "bg-emerald-400/10"},
  Watching: { icon: MonitorPlay, color: "text-amber-400",  bg: "bg-amber-400/10"  },
  Research: { icon: Search,      color: "text-cyan-400",   bg: "bg-cyan-400/10"   },
};

function getTaskMeta(type: string) {
  return TASK_META[type] ?? { icon: Sparkles, color: "text-muted-foreground", bg: "bg-secondary" };
}

// ─── Relative time helper ────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Full date + time ────────────────────────────────────────────────────────
function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Deep work bar ───────────────────────────────────────────────────────────
function DeepWorkBar({ ratio }: { ratio: number | null }) {
  if (ratio == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(ratio * 100);
  const color =
    pct >= 75 ? "bg-emerald-400" :
    pct >= 50 ? "bg-amber-400"   :
                "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-8">{pct}%</span>
    </div>
  );
}

// ─── Session Card ────────────────────────────────────────────────────────────
function SessionCard({ session }: { session: Session }) {
  const meta = getTaskMeta(session.task_type);
  const Icon = meta.icon;
  const label = session.task_label ?? session.task_type;

  return (
    <Card className="bg-card border-border hover:border-[#6c63ff]/40 transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-2.5 rounded-xl shrink-0 ${meta.bg}`}>
            <Icon className={`h-5 w-5 ${meta.color}`} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Top row: label + badge + time */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {label}
                </p>
                {session.task_description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate italic">
                    &ldquo;{session.task_description}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${meta.color} ${meta.bg} border-current/20`}>
                  {session.task_type}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {/* Duration */}
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground font-medium">
                  {formatDuration(session.duration_minutes)}
                </span>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span
                  className="text-xs text-muted-foreground"
                  title={fullDateTime(session.started_at)}
                >
                  {relativeTime(session.started_at)}
                </span>
              </div>

              {/* Deep work */}
              {session.deep_work_ratio != null && (
                <div className="col-span-2 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <DeepWorkBar ratio={session.deep_work_ratio} />
                  </div>
                  <span className="text-xs text-muted-foreground">deep work</span>
                </div>
              )}
            </div>

            {/* Footer: full timestamp */}
            <p className="text-xs text-muted-foreground/60">
              {fullDateTime(session.started_at)}
              {session.ended_at && ` → ${new Date(session.ended_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>

          {/* Chevron */}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[#6c63ff] transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────
function SessionCardSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────
function StatsStrip({ sessions }: { sessions: Session[] }) {
  const total     = sessions.length;
  const totalMins = sessions.reduce((s, x) => s + (x.duration_minutes ?? 0), 0);
  const hours     = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const timeStr   = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const typeCount = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.task_type] = (acc[s.task_type] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Total Sessions", value: String(total) },
        { label: "Total Focus Time", value: timeStr },
        { label: "Top Task Type", value: topType },
      ].map(({ label, value }) => (
        <Card key={label} className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-foreground font-mono">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────────
const FILTER_OPTIONS = ["All", "Coding", "Writing", "Reading", "Watching", "Research"] as const;
type Filter = typeof FILTER_OPTIONS[number];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SessionHistoryPage() {
  const { data: sessions, isLoading, error, refetch } = useSessionHistory();
  const [filter, setFilter] = useState<Filter>("All");

  const filtered =
    !sessions ? [] :
    filter === "All" ? sessions :
    sessions.filter((s) => s.task_type === filter);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Session History</h1>
            <p className="text-sm text-muted-foreground">
              {sessions ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} recorded` : "Loading…"}
            </p>
          </div>
          <Link to="/session/start">
            <Button className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white gap-2">
              <Play className="h-4 w-4" />
              New Session
            </Button>
          </Link>
        </div>

        {/* Stats strip */}
        {sessions && sessions.length > 0 && !isLoading && (
          <StatsStrip sessions={sessions} />
        )}

        {/* Filter chips */}
        {sessions && sessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => {
              const count = opt === "All"
                ? sessions.length
                : sessions.filter((s) => s.task_type === opt).length;
              if (opt !== "All" && count === 0) return null;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFilter(opt)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                    filter === opt
                      ? "bg-[#6c63ff] border-[#6c63ff] text-white"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-[#6c63ff]/50"
                  }`}
                >
                  {opt} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="bg-card border-destructive/40">
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm text-destructive">Failed to load session history</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Skeleton loaders */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SessionCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Session list */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}

        {/* Empty state — no sessions at all */}
        {!isLoading && !error && sessions && sessions.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start your first session to begin tracking your focus
                </p>
              </div>
              <Link to="/session/start">
                <Button className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white gap-2">
                  <Play className="h-4 w-4" />
                  Start First Session
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Empty state — filter returns nothing */}
        {!isLoading && !error && sessions && sessions.length > 0 && filtered.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No <span className="text-foreground font-medium">{filter}</span> sessions found
              </p>
              <button
                type="button"
                onClick={() => setFilter("All")}
                className="mt-2 text-xs text-[#6c63ff] hover:underline"
              >
                Clear filter
              </button>
            </CardContent>
          </Card>
        )}

      </div>
    </AppLayout>
  );
}
