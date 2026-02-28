import React from "react";
import type { NetworkState } from "@/types/api";

interface Props {
  networkState: NetworkState | undefined;
  isLoading: boolean;
}

const BrainNetworkViz = React.memo(function BrainNetworkViz({
  networkState,
  isLoading,
}: Props) {
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

  /* Dominant network */
  let dominantLabel: string;
  let dominantColor: string;
  if (ecn >= dmn && ecn >= salience) {
    dominantLabel = "ECN Dominant — Executive control active";
    dominantColor = "#6366f1";
  } else if (dmn >= ecn && dmn >= salience) {
    dominantLabel = "DMN Dominant — Mind-wandering risk";
    dominantColor = "#8b5cf6";
  } else {
    dominantLabel = "Salience Dominant — Conflict detected";
    dominantColor = "#f59e0b";
  }

  /* Ring configs — outermost to innermost */
  const rings = [
    { label: "Salience", val: salience, r: 92, color: "#f59e0b", delay: "0s" },
    { label: "DMN",      val: dmn,      r: 66, color: "#8b5cf6", delay: "0.5s" },
    { label: "ECN",      val: ecn,      r: 40, color: "#6366f1", delay: "1s" },
  ];

  return (
    <div className="flex flex-col items-center justify-center relative">
      <style>{`
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>

      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {rings.map((ring) => {
          const opacity = 0.2 + ring.val * 0.6;
          const strokeW = 1.5 + ring.val * 1.5;
          const duration = `${3 + (1 - ring.val) * 2}s`;
          const glowR = ring.r + 4;

          return (
            <g key={ring.label}>
              {/* Glow layer */}
              <circle
                cx="100" cy="100" r={glowR}
                fill="none"
                stroke={ring.color}
                strokeWidth={ring.val * 6}
                opacity={ring.val * 0.08}
              />
              {/* Main ring */}
              <circle
                cx="100" cy="100" r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeW}
                opacity={opacity}
                style={{
                  animation: `ringPulse ${duration} ease-in-out infinite`,
                  animationDelay: ring.delay,
                  transformOrigin: "100px 100px",
                }}
              />
              {/* Value arc — filled proportionally */}
              <circle
                cx="100" cy="100" r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeW + 1}
                opacity={0.15 + ring.val * 0.35}
                strokeDasharray={`${ring.val * 2 * Math.PI * ring.r} ${2 * Math.PI * ring.r}`}
                strokeDashoffset={2 * Math.PI * ring.r * 0.25}
                strokeLinecap="round"
                style={{ transformOrigin: "100px 100px" }}
              />
              {/* Percentage label on right side */}
              <text
                x={100 + ring.r + 8}
                y="101"
                fontSize="8"
                fill={ring.color}
                opacity={0.5 + ring.val * 0.5}
                dominantBaseline="middle"
              >
                {Math.round(ring.val * 100)}%
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="#6366f1" opacity="0.8" />
        <circle cx="100" cy="100" r="7" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.3" />
      </svg>

      {/* Dominant label */}
      <div style={{ fontSize: 11, color: dominantColor, textAlign: "center", marginTop: 6 }}>
        ● {dominantLabel}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} /> ECN
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#8b5cf6" }} /> DMN
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} /> Salience
        </span>
      </div>
    </div>
  );
});

export default BrainNetworkViz;
