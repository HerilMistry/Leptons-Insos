import type { Session, DashboardAnalytics } from "@/types/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoAt(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Generates a sine-wave-like sequence with realistic noise */
function wavePoints(
  length: number,
  base: number,
  amplitude: number,
  phaseShift = 0
): number[] {
  return Array.from({ length }, (_, i) => {
    const wave = Math.sin((i / length) * Math.PI * 2 + phaseShift) * amplitude;
    const noise = (Math.random() - 0.5) * 0.06;
    return Math.min(1, Math.max(0, base + wave + noise));
  });
}

// ─── Mock Sessions ────────────────────────────────────────────────────────────

export const MOCK_SESSIONS: Session[] = [
  {
    id: "session-001",
    task_type: "Coding",
    task_label: "Debugging Python backend",
    started_at: isoAt(0, 9, 0),
    ended_at: isoAt(0, 10, 55),
    duration_minutes: 115,
    deep_work_ratio: 0.74,
    avg_instability: 0.22,
    switch_count: 6,
  },
  {
    id: "session-002",
    task_type: "Writing",
    task_label: "Writing climate change essay",
    started_at: isoAt(1, 14, 30),
    ended_at: isoAt(1, 16, 10),
    duration_minutes: 100,
    deep_work_ratio: 0.81,
    avg_instability: 0.17,
    switch_count: 3,
  },
  {
    id: "session-003",
    task_type: "Research",
    task_label: "Neural network architecture research",
    started_at: isoAt(2, 10, 0),
    ended_at: isoAt(2, 11, 45),
    duration_minutes: 105,
    deep_work_ratio: 0.63,
    avg_instability: 0.31,
    switch_count: 11,
  },
  {
    id: "session-004",
    task_type: "Reading",
    task_label: "Reading ML paper on transformers",
    started_at: isoAt(4, 20, 0),
    ended_at: isoAt(4, 21, 20),
    duration_minutes: 80,
    deep_work_ratio: 0.88,
    avg_instability: 0.12,
    switch_count: 2,
  },
  {
    id: "session-005",
    task_type: "Watching",
    task_label: "Watching neural networks lecture",
    started_at: isoAt(7, 19, 15),
    ended_at: isoAt(7, 20, 30),
    duration_minutes: 75,
    deep_work_ratio: 0.55,
    avg_instability: 0.39,
    switch_count: 14,
  },
];

// ─── Mock Analytics per session ──────────────────────────────────────────────

function buildAnalytics(
  sessionId: string,
  daysAgo: number,
  startHour: number,
  durationMinutes: number,
  cfg: {
    deepWork: number;
    switches: number;
    avgInstability: number;
    ecn: number;
    dmn: number;
    salience: number;
    load: number;
  }
): DashboardAnalytics {
  const POINTS = 40;
  const intervalMs = (durationMinutes * 60 * 1000) / POINTS;

  const instabilityArr = wavePoints(POINTS, cfg.avgInstability, 0.15, 0);
  const driftArr = wavePoints(POINTS, 0.25, 0.12, 1.2);
  const fatigueArr = wavePoints(POINTS, 0.18, 0.1, 2.4);

  const timeline = Array.from({ length: POINTS }, (_, i) => {
    const ts = new Date(
      new Date(isoAt(daysAgo, startHour, 0)).getTime() + i * intervalMs
    ).toISOString();
    return {
      timestamp: ts,
      instability: parseFloat(instabilityArr[i].toFixed(3)),
      drift: parseFloat(driftArr[i].toFixed(3)),
      fatigue: parseFloat(fatigueArr[i].toFixed(3)),
    };
  });

  // Scatter ~30 % of switches as interventions across the timeline
  const interventionCount = Math.max(1, Math.floor(cfg.switches * 0.4));
  const interventionTypes: Array<"instability" | "drift" | "fatigue"> = [
    "instability",
    "drift",
    "fatigue",
  ];
  const interventions = Array.from({ length: interventionCount }, (_, i) => {
    const idx = Math.floor((i / interventionCount) * POINTS);
    return {
      timestamp: timeline[idx].timestamp,
      type: interventionTypes[i % 3],
      severity: parseFloat((0.4 + Math.random() * 0.5).toFixed(2)),
    };
  });

  return {
    timeline,
    network_state: {
      ECN: cfg.ecn,
      DMN: cfg.dmn,
      Salience: cfg.salience,
      Load: cfg.load,
    },
    deep_work_ratio: cfg.deepWork,
    switch_count: cfg.switches,
    avg_instability: cfg.avgInstability,
    interventions,
  };
}

export const MOCK_ANALYTICS: Record<string, DashboardAnalytics> = {
  "session-001": buildAnalytics("session-001", 0, 9, 115, {
    deepWork: 0.74,
    switches: 6,
    avgInstability: 0.22,
    ecn: 0.78,
    dmn: 0.31,
    salience: 0.55,
    load: 0.66,
  }),
  "session-002": buildAnalytics("session-002", 1, 14, 100, {
    deepWork: 0.81,
    switches: 3,
    avgInstability: 0.17,
    ecn: 0.85,
    dmn: 0.22,
    salience: 0.48,
    load: 0.72,
  }),
  "session-003": buildAnalytics("session-003", 2, 10, 105, {
    deepWork: 0.63,
    switches: 11,
    avgInstability: 0.31,
    ecn: 0.61,
    dmn: 0.47,
    salience: 0.69,
    load: 0.54,
  }),
  "session-004": buildAnalytics("session-004", 4, 20, 80, {
    deepWork: 0.88,
    switches: 2,
    avgInstability: 0.12,
    ecn: 0.91,
    dmn: 0.18,
    salience: 0.42,
    load: 0.77,
  }),
  "session-005": buildAnalytics("session-005", 7, 19, 75, {
    deepWork: 0.55,
    switches: 14,
    avgInstability: 0.39,
    ecn: 0.52,
    dmn: 0.61,
    salience: 0.74,
    load: 0.43,
  }),
};

/** Fallback analytics used when sessionId is not in the map */
export const MOCK_ANALYTICS_FALLBACK: DashboardAnalytics =
  MOCK_ANALYTICS["session-001"];
