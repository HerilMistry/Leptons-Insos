import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimelinePoint } from "@/types/api";

interface TimelineChartProps {
  data: TimelinePoint[] | undefined;
  isLoading: boolean;
}

export default function TimelineChart({ data, isLoading }: TimelineChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Cognitive Timeline</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Cognitive Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No timeline data for this session
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">Cognitive Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 12% 16%)" />
            <XAxis dataKey="time" tick={{ fill: "hsl(215 19% 62%)", fontSize: 11 }} stroke="hsl(240 12% 16%)" />
            <YAxis domain={[0, 1]} tick={{ fill: "hsl(215 19% 62%)", fontSize: 11 }} stroke="hsl(240 12% 16%)" />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(240 15% 8%)", border: "1px solid hsl(240 12% 16%)", borderRadius: 8, color: "hsl(214 32% 91%)" }}
            />
            <Legend />
            <Line type="monotone" dataKey="instability" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} name="Instability" />
            <Line type="monotone" dataKey="drift" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} name="Drift" />
            <Line type="monotone" dataKey="fatigue" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={false} name="Fatigue" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
