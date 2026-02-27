import type { NetworkState } from "@/types/api";

interface BrainVisualizationProps {
  networkState: NetworkState | undefined;
  isLoading: boolean;
}

export default function BrainVisualization({ networkState, isLoading }: BrainVisualizationProps) {
  const ecn = networkState?.ECN ?? 0.3;
  const dmn = networkState?.DMN ?? 0.3;
  const salience = networkState?.Salience ?? 0.3;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-48 h-48 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 relative">
      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {/* Salience — outermost */}
        <circle
          cx="100" cy="100" r="90"
          fill="none"
          stroke="hsl(var(--fatigue))"
          strokeWidth="2"
          opacity={0.2 + salience * 0.6}
          className="animate-pulse-ring"
          style={{ animationDelay: "0s", animationDuration: `${3 + (1 - salience) * 2}s` }}
        />
        {/* DMN — middle */}
        <circle
          cx="100" cy="100" r="65"
          fill="none"
          stroke="hsl(var(--drift))"
          strokeWidth="2"
          opacity={0.2 + dmn * 0.6}
          className="animate-pulse-ring"
          style={{ animationDelay: "0.5s", animationDuration: `${3 + (1 - dmn) * 2}s` }}
        />
        {/* ECN — innermost */}
        <circle
          cx="100" cy="100" r="40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          opacity={0.2 + ecn * 0.6}
          className="animate-pulse-ring"
          style={{ animationDelay: "1s", animationDuration: `${3 + (1 - ecn) * 2}s` }}
        />
        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="hsl(var(--primary))" opacity="0.8" />
      </svg>
      {/* Labels */}
      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" /> ECN
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-drift" /> DMN
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-fatigue" /> Salience
        </span>
      </div>
    </div>
  );
}
