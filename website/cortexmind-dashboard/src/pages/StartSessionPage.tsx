import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

// ---- Task type options ----
const TASK_OPTIONS = [
  { value: "coding", emoji: "\ud83d\udcbb", label: "Coding" },
  { value: "writing", emoji: "\u270d\ufe0f", label: "Writing" },
  { value: "reading", emoji: "\ud83d\udcd6", label: "Reading" },
  { value: "video", emoji: "\ud83c\udfac", label: "Lecture / Video" },
  { value: "general", emoji: "\ud83e\udde0", label: "General" },
] as const;

type TaskValue = (typeof TASK_OPTIONS)[number]["value"];

// ---- Duration Clock Picker ----
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
        <span className="font-mono text-4xl font-bold text-muted-foreground/60 pb-6">
          :
        </span>

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
            <span className="text-[#6c63ff] font-semibold">
              {totalLabel()}
            </span>{" "}
            total
          </>
        )}
      </p>
    </div>
  );
}

// ---- Main Page ----
export default function StartSessionPage() {
  const [selectedTask, setSelectedTask] = useState<TaskValue>("general");
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [submitting, setSubmitting] = useState(false);

  const { activeSession, isSessionActive, startSession, stopSession } =
    useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalMinutes < 5) return;

    const option = TASK_OPTIONS.find((o) => o.value === selectedTask)!;
    setSubmitting(true);
    try {
      await startSession({
        task_type: selectedTask as any,
        task_label: option.label,
        task_description: option.label,
        estimated_duration: totalMinutes,
      });
      toast({
        title: "Session started",
        description: `Tracking "${option.label}" for ${totalMinutes} min.`,
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStopCurrent = async () => {
    try {
      await stopSession();
      toast({
        title: "Session stopped",
        description: "Previous session has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const canStart = totalMinutes >= 5 && !isSessionActive;

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
            <CardTitle className="text-foreground">
              Start a New Session
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose your task type and set a duration to begin tracking
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Section 1: Task Type Selector */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Select Task Mode
                </label>
                <div className="flex flex-wrap gap-3">
                  {TASK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedTask(opt.value)}
                      className={`flex flex-col items-center gap-1 min-w-[90px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                        selectedTask === opt.value
                          ? "border-[#6366f1] bg-[rgba(99,102,241,0.15)] text-white font-medium"
                          : "border-transparent bg-[rgba(255,255,255,0.04)] text-muted-foreground hover:bg-[rgba(255,255,255,0.08)] hover:text-foreground"
                      }`}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-xs whitespace-nowrap">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Duration Clock Picker */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Estimated Duration
                </label>
                <DurationPicker
                  totalMinutes={totalMinutes}
                  onChange={setTotalMinutes}
                />
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
