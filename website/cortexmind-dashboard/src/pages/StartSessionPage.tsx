import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Loader2,
  Pencil,
  BookOpen,
  Code2,
  MonitorPlay,
  Search,
  RefreshCcw,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";
import { classifyTaskIntent } from "@/api/nlp.js";
import AppLayout from "@/components/layout/AppLayout";

// ─── Task-type icons ─────────────────────────────────────────────────────────
const TASK_ICONS: Record<string, React.ElementType> = {
  Writing: Pencil,
  Reading: BookOpen,
  Coding: Code2,
  Watching: MonitorPlay,
  Research: Search,
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface TaskResult {
  raw_input: string;
  task_type: string;
  task_label: string;
  confidence: number;
}

// ─── Duration Clock Picker ───────────────────────────────────────────────────
function DurationPicker({
  totalMinutes,
  onChange,
}: {
  totalMinutes: number;
  onChange: (v: number) => void;
}) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const setHours = (h: number) => {
    const clamped = Math.max(0, Math.min(8, h));
    onChange(clamped * 60 + minutes);
  };

  const setMinutes = (m: number) => {
    let snapped = Math.round(m / 5) * 5;
    if (snapped < 0) snapped = 55;
    if (snapped > 59) snapped = 0;
    onChange(hours * 60 + snapped);
  };

  const handleWheel = (type: "hours" | "minutes", e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if (type === "hours") setHours(hours + delta);
    else setMinutes(minutes + delta * 5);
  };

  const pad = (n: number) => String(n).padStart(2, "0");

  const totalLabel = () => {
    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minutes`;
  };

  const colClass = (active: boolean) =>
    `flex flex-col items-center gap-1 px-6 py-3 rounded-xl border transition-all duration-200 ${
      active
        ? "border-[#6c63ff] bg-[#6c63ff]/10 shadow-[0_0_16px_#6c63ff33]"
        : "border-border bg-secondary/60"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-4">
        {/* Hours */}
        <div className={colClass(hours > 0)}>
          <button
            type="button"
            onClick={() => setHours(hours + 1)}
            className="text-muted-foreground hover:text-[#6c63ff] transition-colors p-1"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <div
            className="font-mono text-4xl font-bold text-foreground select-none cursor-ns-resize w-16 text-center"
            onWheel={(e) => handleWheel("hours", e)}
          >
            {pad(hours)}
          </div>
          <button
            type="button"
            onClick={() => setHours(hours - 1)}
            className="text-muted-foreground hover:text-[#6c63ff] transition-colors p-1"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase mt-1">
            hrs
          </span>
        </div>

        {/* Separator */}
        <span className="font-mono text-4xl font-bold text-muted-foreground/60 pb-6">:</span>

        {/* Minutes */}
        <div className={colClass(minutes > 0)}>
          <button
            type="button"
            onClick={() => setMinutes(minutes + 5)}
            className="text-muted-foreground hover:text-[#6c63ff] transition-colors p-1"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <div
            className="font-mono text-4xl font-bold text-foreground select-none cursor-ns-resize w-16 text-center"
            onWheel={(e) => handleWheel("minutes", e)}
          >
            {pad(minutes)}
          </div>
          <button
            type="button"
            onClick={() => setMinutes(minutes - 5)}
            className="text-muted-foreground hover:text-[#6c63ff] transition-colors p-1"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase mt-1">
            min
          </span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {totalMinutes === 0 ? (
          <span className="text-amber-400">Set a duration to continue</span>
        ) : (
          <>
            <span className="text-[#6c63ff] font-semibold">{totalLabel()}</span> total
          </>
        )}
      </p>
    </div>
  );
}

// ─── Task Confirmation Card ───────────────────────────────────────────────────
function TaskConfirmCard({
  result,
  onRetype,
}: {
  result: TaskResult;
  onRetype: () => void;
}) {
  const Icon = TASK_ICONS[result.task_type] ?? Sparkles;
  const pct = Math.round(result.confidence * 100);

  return (
    <div className="rounded-xl border border-[#6c63ff]/40 bg-[#6c63ff]/5 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#6c63ff]/15 shrink-0">
          <Icon className="h-5 w-5 text-[#6c63ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{result.task_label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">
            &ldquo;{result.raw_input}&rdquo;
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/30">
          {result.task_type}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#9b8fff] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRetype}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#6c63ff] transition-colors"
      >
        <RefreshCcw className="h-3 w-3" />
        Not right? Retype
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function StartSessionPage() {
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [submitting, setSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { activeSession, isSessionActive, startSession, stopSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Analyze via Groq ──────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    setAnalyzing(true);
    const result = await classifyTaskIntent(trimmed);
    setAnalyzing(false);

    if (!result) {
      toast({
        title: "Could not understand task",
        description: "Please rephrase your task description and try again.",
        variant: "destructive",
      });
      return;
    }

    setTaskResult(result);
  }, [inputText, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  // ── Start Session ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskResult || totalMinutes < 5) return;

    setSubmitting(true);
    try {
      await startSession({
        task_type: taskResult.task_type as any,
        task_label: taskResult.task_label,
        task_description: taskResult.raw_input,
        estimated_duration: totalMinutes,
      });
      toast({
        title: "Session started",
        description: `Tracking "${taskResult.task_label}" — ${totalMinutes} min.`,
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStopCurrent = async () => {
    try {
      await stopSession();
      toast({ title: "Session stopped", description: "Previous session has been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const canStart = !!taskResult && totalMinutes >= 5 && !isSessionActive;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Active session warning */}
        {isSessionActive && activeSession && (
          <Card className="bg-fatigue/5 border-fatigue/30 mb-6">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-fatigue shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  A session is already active ({activeSession.task_type})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You must stop the current session before starting a new one.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-fatigue/30 text-fatigue hover:bg-fatigue/10"
                  onClick={handleStopCurrent}
                >
                  Stop Current Session
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Start a New Session</CardTitle>
            <CardDescription className="text-muted-foreground">
              Describe what you&apos;re about to work on — CortexFlow will detect your task type
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">

              {/* ── Section 1: NLP Task Input ─────────────────────────── */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  What are you working on?
                </label>

                {!taskResult ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      rows={3}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={analyzing}
                      placeholder={"Describe what you're about to work on...\ne.g. \"Debugging my Python backend code\""}
                      className="w-full resize-none rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/50 focus:border-[#6c63ff]/50 disabled:opacity-50 transition-all"
                    />
                    <Button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={!inputText.trim() || analyzing}
                      className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-medium"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing task...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze Task →
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <TaskConfirmCard
                    result={taskResult}
                    onRetype={() => {
                      setTaskResult(null);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                  />
                )}
              </div>

              {/* ── Section 2: Duration Clock Picker ──────────────────── */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Estimated Duration
                </label>
                <DurationPicker totalMinutes={totalMinutes} onChange={setTotalMinutes} />
                {totalMinutes > 0 && totalMinutes < 5 && (
                  <p className="text-xs text-amber-400 text-center">
                    Minimum session length is 5 minutes
                  </p>
                )}
              </div>

            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold disabled:opacity-40"
                disabled={!canStart || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Session"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
