import { Brain, Repeat, Timer, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatReentryCost } from "@/utils/formatters";
import type { DashboardAnalytics } from "@/types/api";

interface AttentionSummaryProps {
  analytics: DashboardAnalytics | undefined;
  isLoading: boolean;
}

const cards = [
  {
    key: "deep_work" as const,
    label: "Deep Work",
    icon: Brain,
    color: "text-stable",
    getValue: (a: DashboardAnalytics) => formatPercent(a.deep_work_ratio),
  },
  {
    key: "switches" as const,
    label: "Total Switches",
    icon: Repeat,
    color: "text-fatigue",
    getValue: (a: DashboardAnalytics) => a.switch_count?.toString() ?? "—",
  },
  {
    key: "reentry" as const,
    label: "Re-entry Cost",
    icon: Timer,
    color: "text-drift",
    getValue: (a: DashboardAnalytics) => formatReentryCost(a.switch_count),
  },
  {
    key: "instability" as const,
    label: "Avg Instability",
    icon: Activity,
    color: "text-instability",
    getValue: (a: DashboardAnalytics) => formatPercent(a.avg_instability),
  },
];

export default function AttentionSummary({ analytics, isLoading }: AttentionSummaryProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.key} className="bg-card border-border">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <p className={`text-2xl font-bold font-metric ${card.color}`}>
                  {analytics ? card.getValue(analytics) : "—"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
