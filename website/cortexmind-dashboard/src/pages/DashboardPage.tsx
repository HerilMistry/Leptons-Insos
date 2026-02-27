import { useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BrainVisualization from "@/components/dashboard/BrainVisualization";
import TimelineChart from "@/components/dashboard/TimelineChart";
import NetworkRadarChart from "@/components/dashboard/NetworkRadarChart";
import AttentionSummary from "@/components/dashboard/AttentionSummary";
import InterventionMarkers from "@/components/dashboard/InterventionMarkers";
import SessionSummaryTable from "@/components/dashboard/SessionSummaryTable";
import { useSessionHistory, useDashboardAnalytics } from "@/hooks/useDashboard";
import AppLayout from "@/components/layout/AppLayout";

export default function DashboardPage() {
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useSessionHistory();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Default to most recent session
  const activeSessionId = selectedSessionId || sessions?.[0]?.id || null;

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useDashboardAnalytics(activeSessionId);

  const isEmpty = !sessionsLoading && (!sessions || sessions.length === 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Cognitive state analytics</p>
          </div>
          {sessions && sessions.length > 0 && (
            <Select
              value={activeSessionId || undefined}
              onValueChange={setSelectedSessionId}
            >
              <SelectTrigger className="w-64 bg-secondary border-border text-foreground">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-foreground">
                    {s.task_type} — {new Date(s.started_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Error state */}
        {(sessionsError || analyticsError) && (
          <Card className="bg-card border-destructive/50">
            <CardContent className="p-6 text-center">
              <p className="text-destructive mb-2">Failed to load data</p>
              <p className="text-sm text-muted-foreground">
                {(sessionsError as Error)?.message || (analyticsError as Error)?.message}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {isEmpty && !sessionsError && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No sessions yet</h2>
              <p className="text-muted-foreground mb-6">Start your first cognitive monitoring session to see analytics here.</p>
              <Button asChild>
                <Link to="/session/start">Start a Session</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dashboard content */}
        {!isEmpty && !sessionsError && (
          <>
            {/* Brain + Attention Cards */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-foreground text-base">Brain Network Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <BrainVisualization
                    networkState={analytics?.network_state}
                    isLoading={analyticsLoading}
                  />
                </CardContent>
              </Card>
              <div className="lg:col-span-2">
                <AttentionSummary analytics={analytics} isLoading={analyticsLoading} />
              </div>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <TimelineChart data={analytics?.timeline} isLoading={analyticsLoading} />
              <NetworkRadarChart data={analytics?.network_state} isLoading={analyticsLoading} />
            </div>

            {/* Interventions */}
            <InterventionMarkers interventions={analytics?.interventions} isLoading={analyticsLoading} />

            {/* Session table */}
            <SessionSummaryTable sessions={sessions} isLoading={sessionsLoading} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
