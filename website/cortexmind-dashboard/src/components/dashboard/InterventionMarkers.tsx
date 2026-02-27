import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Intervention } from "@/types/api";

interface InterventionMarkersProps {
  interventions: Intervention[] | undefined;
  isLoading: boolean;
}

const typeColors: Record<string, string> = {
  instability: "bg-instability",
  drift: "bg-drift",
  fatigue: "bg-fatigue",
};

export default function InterventionMarkers({ interventions, isLoading }: InterventionMarkersProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Interventions</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  if (!interventions || interventions.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Interventions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No interventions triggered during this session</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">Interventions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline bar */}
          <div className="h-2 bg-muted rounded-full w-full relative">
            {interventions.map((intervention, i) => (
              <div
                key={i}
                className={`absolute top-0 h-2 w-2 rounded-full ${typeColors[intervention.type] || "bg-muted-foreground"}`}
                style={{
                  left: `${(i / Math.max(interventions.length - 1, 1)) * 100}%`,
                  transform: "translateX(-50%)",
                }}
                title={`${intervention.type} (severity: ${intervention.severity})`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-instability" /> Instability</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-drift" /> Drift</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fatigue" /> Fatigue</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
