// ============================================================
// CortexFlow — Central Configuration
// ============================================================
// All integration settings live here.
// Backend teammate: change API_BASE_URL to match your Django port.
// ============================================================

const CF_CONFIG = Object.freeze({

  // ── Backend API ──────────────────────────────────────────
  API_BASE_URL: "http://localhost:8000",

  // ── Telemetry ────────────────────────────────────────────
  TELEMETRY_INTERVAL_MS: 5000,          // collect metrics every 5 s
  MAX_DURATION_NORM: 1.0,               // max normalised session duration

  // ── Risk thresholds ──────────────────────────────────────
  RISK_WARN_THRESHOLD: 0.35,            // yellow orb
  RISK_DANGER_THRESHOLD: 0.60,          // red orb + intervention banner

  // ── Dashboard URL ────────────────────────────────────────
  DASHBOARD_URL: "http://localhost:5173",  // Vite frontend

  // ── Distractor domains ───────────────────────────────────
  DISTRACTOR_DOMAINS: [
    "youtube.com",
    "reddit.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "netflix.com",
    "twitch.tv",
    "pinterest.com"
  ],

  // ── Intervention banner cooldown ─────────────────────────
  BANNER_COOLDOWN_MS: 30000,            // 30 s between banners

  // ── Intervention history ─────────────────────────────────
  MAX_INTERVENTION_HISTORY: 50,

  // ── Intervention messages ────────────────────────────────
  INTERVENTION_MESSAGES: [
    "You seem distracted — try a 2-minute breathing exercise.",
    "Your focus has drifted. Consider switching back to your main task.",
    "Cognitive load is rising. Take a short break before continuing.",
    "High tab-switching detected. Close tabs you don't need right now.",
    "Breakdown may be imminent — pause, stretch, and reset."
  ]
});

// Make available to both content scripts and importers
if (typeof window !== "undefined") {
  window.CF_CONFIG = CF_CONFIG;
}
