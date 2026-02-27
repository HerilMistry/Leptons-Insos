// ============================================================
// CortexFlow — Telemetry Collector (Content Script)
// ============================================================
// Collects behavioural metrics every 5 seconds and sends them
// to the background service worker, which enriches them with
// tab_switch_count and forwards to the backend API.
//
// Field names match exactly what the ML model expects.
// ============================================================

(() => {
  "use strict";

  // ── Metric accumulators ────────────────────────────────────
  let scrollEvents = [];
  let scrollReversals = 0;
  let totalScrolls = 0;
  let lastScrollDir = null;

  let keypressTimestamps = [];
  let mousePositions = [];
  let idleSince = Date.now();
  let idleMs = 0;
  let lastActivityTime = Date.now();

  const IDLE_THRESHOLD_MS = 3000; // 3 s of no input = idle

  // ── Distractor detection ───────────────────────────────────

  function isDistractorSite() {
    const host = window.location.hostname.toLowerCase();
    return (window.CF_CONFIG?.DISTRACTOR_DOMAINS || []).some(
      (d) => host === d || host.endsWith("." + d)
    );
  }

  // ── Background playback flag ───────────────────────────────

  function hasBackgroundPlayback() {
    const mediaEls = document.querySelectorAll("video, audio");
    for (const el of mediaEls) {
      if (!el.paused && !el.ended) return 1;
    }
    return 0;
  }

  // ── Rewind frequency (video seeks backward) ────────────────

  let rewindCount = 0;
  document.addEventListener("seeking", (e) => {
    const vid = e.target;
    if (vid.tagName === "VIDEO" && vid.currentTime < (vid._cfPrevTime || 0)) {
      rewindCount++;
    }
  }, true);
  document.addEventListener("timeupdate", (e) => {
    if (e.target.tagName === "VIDEO") {
      e.target._cfPrevTime = e.target.currentTime;
    }
  }, true);

  // ── Input listeners ────────────────────────────────────────

  function markActive() {
    const now = Date.now();
    if (now - lastActivityTime > IDLE_THRESHOLD_MS) {
      idleMs += now - lastActivityTime - IDLE_THRESHOLD_MS;
    }
    lastActivityTime = now;
  }

  // Scroll tracking
  window.addEventListener("scroll", () => {
    markActive();
    totalScrolls++;
    const y = window.scrollY;
    const dir = y > (scrollEvents[scrollEvents.length - 1] || 0) ? "down" : "up";
    scrollEvents.push(y);
    if (lastScrollDir && dir !== lastScrollDir) {
      scrollReversals++;
    }
    lastScrollDir = dir;
  }, { passive: true });

  // Keypress tracking
  document.addEventListener("keydown", () => {
    markActive();
    keypressTimestamps.push(Date.now());
    // Keep last 100 timestamps
    if (keypressTimestamps.length > 100) keypressTimestamps.shift();
  });

  // Mouse tracking
  document.addEventListener("mousemove", (e) => {
    markActive();
    mousePositions.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    // Keep last 60 positions
    if (mousePositions.length > 60) mousePositions.shift();
  });

  // ── Metric computation ─────────────────────────────────────

  function computeTypingIntervalVariance() {
    if (keypressTimestamps.length < 3) return 0;
    const intervals = [];
    for (let i = 1; i < keypressTimestamps.length; i++) {
      intervals.push(keypressTimestamps[i] - keypressTimestamps[i - 1]);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    // Normalise: divide by 1e6 to get a 0–1-ish range
    return Math.min(variance / 1e6, 1);
  }

  function computeMouseVelocityVariance() {
    if (mousePositions.length < 3) return 0;
    const velocities = [];
    for (let i = 1; i < mousePositions.length; i++) {
      const dx = mousePositions[i].x - mousePositions[i - 1].x;
      const dy = mousePositions[i].y - mousePositions[i - 1].y;
      const dt = (mousePositions[i].t - mousePositions[i - 1].t) || 1;
      velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    const mean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const variance = velocities.reduce((a, b) => a + (b - mean) ** 2, 0) / velocities.length;
    return Math.min(variance / 10, 1);
  }

  function computeScrollReversalRatio() {
    return totalScrolls > 0 ? Math.min(scrollReversals / totalScrolls, 1) : 0;
  }

  function computeIdleDensity(intervalMs) {
    // Update idle accumulator if currently idle
    const now = Date.now();
    if (now - lastActivityTime > IDLE_THRESHOLD_MS) {
      idleMs += now - lastActivityTime - IDLE_THRESHOLD_MS;
      lastActivityTime = now; // reset to avoid double-counting
    }
    return Math.min(idleMs / intervalMs, 1);
  }

  // ── Collect & send ─────────────────────────────────────────

  function collectAndSend() {
    const interval = window.CF_CONFIG?.TELEMETRY_INTERVAL_MS || 5000;

    const features = {
      switch_rate: 0,                              // placeholder; background.js injects real value
      idle_density: computeIdleDensity(interval),
      scroll_reversal_ratio: computeScrollReversalRatio(),
      typing_interval_var: computeTypingIntervalVariance(),
      mouse_velocity_var: computeMouseVelocityVariance(),
      background_playback_flag: hasBackgroundPlayback(),
      rewind_frequency: parseFloat((rewindCount / (interval / 1000)).toFixed(4)),
      task_type: "general" // overridden by session task_type in background.js
    };

    // Send to background service worker
    try {
      if (!chrome.runtime?.id) return; // extension context invalidated
      chrome.runtime.sendMessage(
        { type: "SEND_TELEMETRY", features },
        (response) => {
          if (chrome.runtime.lastError) return; // silently ignore
          if (response && !response.error) {
            // Broadcast response to overlay
            window.dispatchEvent(
              new CustomEvent("cortexflow-telemetry", { detail: response })
            );
          }
        }
      );
    } catch {
      // Extension context invalidated — stop polling
      clearInterval(telemetryInterval);
    }

    // Reset per-interval counters
    scrollReversals = 0;
    totalScrolls = 0;
    scrollEvents = [];
    idleMs = 0;
    rewindCount = 0;
  }

  // ── Start collection loop ──────────────────────────────────

  const intervalMs = window.CF_CONFIG?.TELEMETRY_INTERVAL_MS || 5000;
  const telemetryInterval = setInterval(collectAndSend, intervalMs);

  console.log(`[CortexFlow] Telemetry collector active (every ${intervalMs / 1000}s)`);
})();
