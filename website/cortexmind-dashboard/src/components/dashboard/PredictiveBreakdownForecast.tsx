import { useRef, useState, useEffect } from "react";
import type { DashboardAnalytics } from "@/types/api";

/* ── Risk‑slope helper ──────────────────────────────────────── */
function getRiskSlope(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

/* ── Props ──────────────────────────────────────────────────── */
interface Props {
  analytics: DashboardAnalytics | undefined;
}

/* ── Component ──────────────────────────────────────────────── */
export default function PredictiveBreakdownForecast({ analytics }: Props) {
  const riskHistory = useRef<number[]>([]);
  const [forecast, setForecast] = useState<{
    active: boolean;
    seconds: number;
  }>({ active: false, seconds: 0 });
  const [fadingOut, setFadingOut] = useState(false);

  /* Compute a synthetic risk from the latest telemetry */
  useEffect(() => {
    if (!analytics) return;

    const net = analytics.network_state ?? { ECN: 0, DMN: 0, Salience: 0, Load: 0 };
    const latest = analytics.timeline?.at(-1);
    const instability = latest?.instability ?? analytics.avg_instability ?? 0;
    const drift = latest?.drift ?? 0;
    const fatigue = latest?.fatigue ?? 0;
    const risk = Math.min(
      1,
      instability * 0.35 + drift * 0.3 + fatigue * 0.2 + (1 - net.ECN) * 0.15,
    );

    /* Push into sliding window (max 5) */
    const hist = riskHistory.current;
    hist.push(risk);
    if (hist.length > 5) hist.shift();

    const slope = getRiskSlope(hist);
    const currentRisk = risk;

    if (slope > 0.015 && currentRisk > 0.4) {
      const windowsToBreakdown = Math.ceil((0.72 - currentRisk) / slope);
      const secondsToBreakdown = windowsToBreakdown * 5;
      if (secondsToBreakdown > 0 && secondsToBreakdown <= 120) {
        setFadingOut(false);
        setForecast({ active: true, seconds: secondsToBreakdown });
      } else {
        triggerFadeOut();
      }
    } else {
      triggerFadeOut();
    }
  }, [analytics]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Smooth fade‑out helper */
  function triggerFadeOut() {
    if (!forecast.active) return;
    setFadingOut(true);
    const t = setTimeout(() => {
      setForecast({ active: false, seconds: 0 });
      setFadingOut(false);
    }, 500);
    return () => clearTimeout(t);
  }

  if (!forecast.active) return null;

  const minutesLeft = Math.floor(forecast.seconds / 60);
  const secondsLeft = forecast.seconds % 60;

  return (
    <>
      <style>{`
        @keyframes forecastFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderLeft: "3px solid #f59e0b",
          borderRadius: 12,
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          animation: fadingOut ? undefined : "forecastFadeIn 0.4s ease",
          opacity: fadingOut ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#f59e0b",
                lineHeight: 1.3,
              }}
            >
              Breakdown Forecasted
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              Risk trajectory rising — ECN losing dominance
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#f59e0b",
              lineHeight: 1.1,
            }}
          >
            ~{minutesLeft}m {secondsLeft}s
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              marginTop: 2,
            }}
          >
            until threshold
          </div>
        </div>
      </div>
    </>
  );
}
