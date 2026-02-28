// ============================================================
// CortexFlow — Telemetry Collector (Content Script)
// ============================================================

// ── ONE-TIME SELF-RELOAD TRIGGER ──────────────────────────
// Fires once on the first page navigation after the extension files were
// updated on disk.  Uses a chrome.storage flag to avoid a reload loop.
// This block is removed automatically after reload (by clearing the flag).
;(function cortexflowBootReload() {
  try {
    chrome.storage.local.get("__cf_boot_reload", ({ __cf_boot_reload }) => {
      if (!__cf_boot_reload) {
        chrome.storage.local.set({ __cf_boot_reload: true }, () => {
          setTimeout(() => chrome.runtime.reload(), 300);
        });
      }
    });
  } catch { /* extension context already invalidated — skip */ }
})();

// ── END RELOAD TRIGGER ─────────────────────────────────────

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
  let backspaceCount = 0;
  let deleteCount = 0;
  let totalKeyCount = 0;
  let burstCount = 0;
  let inBurst = false;
  let lastKeyTime = null;
  let mousePositions = [];
  let mouseClicks = 0;
  let mouseHesitations = 0;
  let mouseDirectionChanges = 0;
  let mouseTotalDistance = 0;
  let lastMouseMoveTime = null;
  let idleSince = Date.now();
  let idleMs = 0;
  let lastActivityTime = Date.now();
  let tabHiddenMs = 0;
  let tabHiddenStart = null;

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

  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    if (document.hidden) {
      tabHiddenStart = now;
    } else {
      if (tabHiddenStart) {
        tabHiddenMs += now - tabHiddenStart;
        tabHiddenStart = null;
      }
      markActive();
    }
  });

  // Keypress tracking
  document.addEventListener("keydown", (e) => {
    markActive();
    const now = Date.now();

    totalKeyCount++;
    if (e.key === "Backspace") backspaceCount++;
    if (e.key === "Delete")    deleteCount++;

    keypressTimestamps.push(now);
    if (keypressTimestamps.length > 100) keypressTimestamps.shift();

    // Burst detection: keys within 300ms = active focused typing
    if (lastKeyTime !== null) {
      const gap = now - lastKeyTime;
      if (gap < 300) {
        if (!inBurst) { burstCount++; inBurst = true; }
      } else {
        inBurst = false;
      }
    }
    lastKeyTime = now;
  });

  // Mouse tracking
  document.addEventListener("mousemove", (e) => {
    markActive();
    const now = Date.now();
    const pos = { x: e.clientX, y: e.clientY, t: now };

    if (mousePositions.length > 0) {
      const last = mousePositions[mousePositions.length - 1];
      const dx = pos.x - last.x;
      const dy = pos.y - last.y;
      mouseTotalDistance += Math.sqrt(dx * dx + dy * dy);

      // Direction change: sharp angle between consecutive movement vectors
      if (mousePositions.length >= 2) {
        const prev = mousePositions[mousePositions.length - 2];
        const a1 = Math.atan2(last.y - prev.y, last.x - prev.x);
        const a2 = Math.atan2(pos.y - last.y, pos.x - last.x);
        if (Math.abs(a1 - a2) > 1.2) mouseDirectionChanges++;  // >~70 degrees
      }

      // Hesitation: mouse was still for >800ms then moved again
      if (lastMouseMoveTime && (now - lastMouseMoveTime) > 800) {
        mouseHesitations++;
      }
    }

    mousePositions.push(pos);
    if (mousePositions.length > 80) mousePositions.shift();
    lastMouseMoveTime = now;
  }, { passive: true });

  document.addEventListener("click", () => {
    markActive();
    mouseClicks++;
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

  function computeErrorRate() {
    if (totalKeyCount === 0) return 0;
    return Math.min((backspaceCount + deleteCount) / totalKeyCount, 1.0);
  }

  function computeWpmNorm() {
    if (keypressTimestamps.length < 2) return 0;
    const intervals = [];
    for (let i = 1; i < keypressTimestamps.length; i++) {
      intervals.push(keypressTimestamps[i] - keypressTimestamps[i - 1]);
    }
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const wpm = avgMs > 0 ? Math.min((60000 / avgMs) / 5, 150) : 0;
    return parseFloat((wpm / 150).toFixed(4));
  }

  function computeBurstRate(intervalMs) {
    return parseFloat(Math.min(burstCount / (intervalMs / 1000), 1.0).toFixed(4));
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

  function computeHesitationRate(intervalMs) {
    return parseFloat(Math.min(mouseHesitations / (intervalMs / 1000), 1.0).toFixed(4));
  }

  function computeDirectionChangeRate(intervalMs) {
    return parseFloat(Math.min(mouseDirectionChanges / (intervalMs / 1000), 1.0).toFixed(4));
  }

  function computeClickRate(intervalMs) {
    return parseFloat(Math.min(mouseClicks / (intervalMs / 1000), 1.0).toFixed(4));
  }

  function computeMouseDistanceNorm(intervalMs) {
    // Normalise by expected pixels/sec for moderate movement
    return parseFloat(Math.min(mouseTotalDistance / (intervalMs * 0.5), 1.0).toFixed(4));
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

  function computeTabHiddenRatio(intervalMs) {
    // If tab is currently hidden, count ongoing hidden time too
    let current = tabHiddenMs;
    if (tabHiddenStart) current += Date.now() - tabHiddenStart;
    return parseFloat(Math.min(current / intervalMs, 1.0).toFixed(4));
  }

  // ── Collect & send ─────────────────────────────────────────

  function collectAndSend() {
    const interval = window.CF_CONFIG?.TELEMETRY_INTERVAL_MS || 5000;

    const features = {
      switch_rate: 0,                              // placeholder; background.js injects real value
      motor_var: computeMouseVelocityVariance(),
      distractor_attempts: 0,                      // extension cannot detect this directly
      idle_ratio: computeIdleDensity(interval),
      scroll_entropy: computeScrollReversalRatio(),
      passive_playback: hasBackgroundPlayback(),
      typing_interval_var: computeTypingIntervalVariance(),
      rewind_frequency: parseFloat((rewindCount / (interval / 1000)).toFixed(4)),
      task_type: "general", // overridden by session task_type in background.js
      error_rate:    parseFloat(computeErrorRate().toFixed(4)),
      wpm_norm:      computeWpmNorm(),
      burst_rate:    computeBurstRate(interval),
      hesitation_rate:       computeHesitationRate(interval),
      direction_change_rate: computeDirectionChangeRate(interval),
      click_rate:            computeClickRate(interval),
      mouse_distance_norm:   computeMouseDistanceNorm(interval),
      tab_hidden_ratio:      computeTabHiddenRatio(interval)
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
    backspaceCount = 0;
    deleteCount = 0;
    totalKeyCount = 0;
    burstCount = 0;
    inBurst = false;
    // DO NOT reset keypressTimestamps — it's a rolling window
    mouseClicks = 0;
    mouseHesitations = 0;
    mouseDirectionChanges = 0;
    mouseTotalDistance = 0;
    // DO NOT reset mousePositions — rolling window
    tabHiddenMs = 0;
    // DO NOT reset tabHiddenStart — we may still be hidden mid-interval
  }

  // ── Start collection loop ──────────────────────────────────

  const intervalMs = window.CF_CONFIG?.TELEMETRY_INTERVAL_MS || 5000;
  const telemetryInterval = setInterval(collectAndSend, intervalMs);
})();

// ── postMessage bridge: website → chrome.storage ──────────────────────────────
// The CortexFlow website runs as a normal webpage (localhost:5173).
// Normal webpages cannot access chrome.storage directly. This content script
// IS injected there (matches: <all_urls>), so it acts as a trusted bridge:
// the website posts CORTEXFLOW_SYNC messages; this listener writes them to
// chrome.storage.local so the background service worker can read them.
//
// Security: we validate the source origin before accepting any message.
window.addEventListener("message", (event) => {
  // Only accept messages from localhost dev origins
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];
  if (!allowedOrigins.includes(event.origin)) return;
  if (!event.data || event.data.__cortexflow !== true) return;

  const { action, payload } = event.data;

  if (action === "SET") {
    chrome.storage.local.set(payload, () => {
    });
  } else if (action === "REMOVE") {
    const keys = Array.isArray(payload) ? payload : [payload];
    chrome.storage.local.remove(keys, () => {
    });
  }
});

// Extension can request the page to re-sync user id (e.g. when popup has no user id).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "REQUEST_SYNC") return;
  window.postMessage({ type: "cortexflow-request-sync" }, window.location.origin);
  sendResponse({ ok: true });
  return true;
});
