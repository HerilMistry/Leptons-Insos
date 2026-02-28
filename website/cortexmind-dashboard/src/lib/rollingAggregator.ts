/**
 * Rolling 10-Minute Aggregator
 * ----------------------------
 * In-memory circular buffer storing the last 120 telemetry snapshots
 * (5 s cadence × 120 = 10 minutes).  All computation happens in the browser.
 */

export interface TelemetryEntry {
  timestamp: number;
  risk: number;
  instability: number;
  drift: number;
  fatigue: number;
  conflict: number;
  ECN: number;
  DMN: number;
  Salience: number;
  Load: number;
}

export interface RollingAverages {
  avgRisk: number;
  avgInstability: number;
  avgDrift: number;
  avgFatigue: number;
  avgConflict: number;
  avgECN: number;
  avgDMN: number;
}

export type RiskTrend = "stable" | "rising" | "falling";

export interface TenMinSummary {
  averages: RollingAverages;
  dominantMetric: "risk" | "instability" | "drift" | "fatigue";
  riskTrend: RiskTrend;
  entryCount: number;
}

const MAX_ENTRIES = 120; // 10 min × 12 entries/min

class RollingAggregator {
  private buffer: TelemetryEntry[] = [];

  /** Push a new telemetry snapshot into the rolling window. */
  push(entry: TelemetryEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > MAX_ENTRIES) {
      this.buffer.shift();
    }
  }

  /** Clear the entire buffer (e.g. after a focus exercise reset). */
  reset(): void {
    this.buffer = [];
  }

  /** Number of entries currently held. */
  get size(): number {
    return this.buffer.length;
  }

  /** Return the raw buffer (read-only copy). */
  getEntries(): ReadonlyArray<TelemetryEntry> {
    return this.buffer;
  }

  /** Compute rolling averages across the current window. */
  private computeAverages(): RollingAverages {
    const n = this.buffer.length || 1;
    let sumRisk = 0, sumI = 0, sumD = 0, sumF = 0, sumC = 0, sumECN = 0, sumDMN = 0;
    for (const e of this.buffer) {
      sumRisk += e.risk;
      sumI += e.instability;
      sumD += e.drift;
      sumF += e.fatigue;
      sumC += e.conflict;
      sumECN += e.ECN;
      sumDMN += e.DMN;
    }
    return {
      avgRisk: sumRisk / n,
      avgInstability: sumI / n,
      avgDrift: sumD / n,
      avgFatigue: sumF / n,
      avgConflict: sumC / n,
      avgECN: sumECN / n,
      avgDMN: sumDMN / n,
    };
  }

  /** Compare last 3 vs previous 3 entries to determine risk trend. */
  private computeTrend(): RiskTrend {
    if (this.buffer.length < 6) return "stable";
    const last3 = this.buffer.slice(-3);
    const prev3 = this.buffer.slice(-6, -3);
    const avgLast = last3.reduce((s, e) => s + e.risk, 0) / 3;
    const avgPrev = prev3.reduce((s, e) => s + e.risk, 0) / 3;

    // Check if continuously rising across all 3
    const risingContinuously =
      last3[0].risk >= prev3[2].risk &&
      last3[1].risk >= last3[0].risk &&
      last3[2].risk >= last3[1].risk;

    if (risingContinuously && avgLast > avgPrev + 0.02) return "rising";
    if (avgLast < avgPrev - 0.02) return "falling";
    return "stable";
  }

  /** Identify which metric is the most elevated. */
  private dominantMetric(avg: RollingAverages): TenMinSummary["dominantMetric"] {
    const candidates: { key: TenMinSummary["dominantMetric"]; val: number }[] = [
      { key: "risk", val: avg.avgRisk },
      { key: "instability", val: avg.avgInstability },
      { key: "drift", val: avg.avgDrift },
      { key: "fatigue", val: avg.avgFatigue },
    ];
    candidates.sort((a, b) => b.val - a.val);
    return candidates[0].key;
  }

  /** Public API — returns the full 10-minute summary. */
  get10MinSummary(): TenMinSummary {
    const averages = this.computeAverages();
    return {
      averages,
      dominantMetric: this.dominantMetric(averages),
      riskTrend: this.computeTrend(),
      entryCount: this.buffer.length,
    };
  }
}

// Singleton instance shared across the app
export const aggregator = new RollingAggregator();
export default RollingAggregator;
