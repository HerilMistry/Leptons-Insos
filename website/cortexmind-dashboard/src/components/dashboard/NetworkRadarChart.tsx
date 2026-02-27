import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { NetworkState } from "@/types/api";

interface NetworkRadarChartProps {
  data: NetworkState | undefined;
  isLoading: boolean;
}

export default function NetworkRadarChart({ data, isLoading }: NetworkRadarChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Network State</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Network State</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No network data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const radarData = [
    { metric: "ECN", value: data.ECN },
    { metric: "DMN", value: data.DMN },
    { metric: "Salience", value: data.Salience },
    { metric: "Load", value: data.Load },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">Network State</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RechartsRadar data={radarData}>
            <PolarGrid stroke="hsl(240 12% 16%)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(215 19% 62%)", fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 1]} tick={{ fill: "hsl(215 19% 62%)", fontSize: 10 }} />
            <Radar
              dataKey="value"
              stroke="hsl(245 95% 69%)"
              fill="hsl(245 95% 69%)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
