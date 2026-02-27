import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDuration, formatPercent } from "@/utils/formatters";
import type { Session } from "@/types/api";

interface SessionSummaryTableProps {
  sessions: Session[] | undefined;
  isLoading: boolean;
}

export default function SessionSummaryTable({ sessions, isLoading }: SessionSummaryTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Recent Sessions</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground text-base">Recent Sessions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No sessions recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground text-base">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground">Task</TableHead>
              <TableHead className="text-muted-foreground">Duration</TableHead>
              <TableHead className="text-muted-foreground">Deep Work</TableHead>
              <TableHead className="text-muted-foreground">Instability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.slice(0, 10).map((session) => (
              <TableRow
                key={session.id}
                className="border-border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/session/${session.id}`)}
              >
                <TableCell className="text-foreground text-sm">{formatDate(session.started_at)}</TableCell>
                <TableCell className="text-foreground text-sm">{session.task_type}</TableCell>
                <TableCell className="text-foreground text-sm font-metric">{formatDuration(session.duration_minutes)}</TableCell>
                <TableCell className="text-stable text-sm font-metric">{formatPercent(session.deep_work_ratio)}</TableCell>
                <TableCell className="text-instability text-sm font-metric">{formatPercent(session.avg_instability)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
