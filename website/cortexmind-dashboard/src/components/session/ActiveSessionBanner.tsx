import { useState, useEffect } from "react";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";

export default function ActiveSessionBanner() {
  const { activeSession, isSessionActive, stopSession } = useSession();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState("");
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!activeSession) return;

    const update = () => {
      const start = new Date(activeSession.started_at).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${m}:${String(s).padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (!isSessionActive || !activeSession) return null;

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopSession();
      toast({ title: "Session stopped", description: "Your session has been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stable opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-stable" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Session Active
        </span>
        <span className="text-sm text-muted-foreground">—</span>
        <span className="text-sm text-primary font-medium">{activeSession.task_type}</span>
        <span className="text-sm text-muted-foreground">—</span>
        <span className="text-sm font-metric text-foreground">{elapsed}</span>
      </div>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleStop}
        disabled={stopping}
        className="gap-1.5"
      >
        <Square className="h-3 w-3" />
        Stop Session
      </Button>
    </div>
  );
}
