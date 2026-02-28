
// ── Task-specific signal thresholds ───────────────────────────────────────
// Each array = [level1_floor, level2_floor, level3_floor]
const TASK_THRESHOLDS = {
  coding:  { instab: [0.45, 0.60, 0.70], drift: [0.55, 0.70, 0.80], fatigue: [0.60, 0.75, 0.85] },
  writing: { instab: [0.50, 0.65, 0.75], drift: [0.50, 0.65, 0.75], fatigue: [0.60, 0.75, 0.85] },
  reading: { instab: [0.50, 0.65, 0.75], drift: [0.45, 0.60, 0.70], fatigue: [0.60, 0.75, 0.85] },
  video:   { instab: [0.60, 0.75, 0.85], drift: [0.40, 0.55, 0.65], fatigue: [0.60, 0.75, 0.85] },
  general: { instab: [0.50, 0.65, 0.75], drift: [0.50, 0.65, 0.75], fatigue: [0.60, 0.75, 0.85] },
};

// ── Per-signal hysteresis counters ───────────────────────────────────
const _sigCount      = { instab: 0, drift: 0, fatigue: 0 };
// Per-type cooldown end timestamps (ms)
const _cooldownUntil = { instab: 0, drift: 0, fatigue: 0 };
const TYPE_COOLDOWNS = { instab: 3 * 60000, drift: 4 * 60000, fatigue: 8 * 60000 };
// Re-entry / cognitive inertia tracking
let _inBreakdown   = false;
let _recoveryCount = 0;
// Task-type cache (updated from chrome.storage)
let _currentTask    = "general";
let _sessionStartMs = null;  // for elapsed-time messages
// Legacy cooldown kept for backward-compat
const COOLDOWN_MS  = 5000;
let lastBannerTime = 0;
let lastBannerType = null;
// Breakdown banner state
let previousRiskLevel      = 'green';  // 'green' | 'yellow' | 'red'
let currentRiskLevel       = 'green';
let isBreakdownActive      = false;
let breakdownCooldownUntil = 0;        // timestamp, not boolean
let consecutiveHighRisk    = 0;

(() => {
  "use strict";

  // ── Build DOM ────────────────────────────────────────────

  function createOverlay() {
    // Container
    const wrapper = document.createElement("div");
    wrapper.id = "cf-overlay-root";

    // Floating orb
    const orb = document.createElement("div");
    orb.id = "cf-orb";
    orb.title = "CortexFlow — click to expand";
    orb.textContent = "CF";
    wrapper.appendChild(orb);

    // Intervention banner
    const banner = document.createElement("div");
    banner.id = "cf-banner";
    banner.classList.add("cf-hidden");
    const bannerMsg = document.createElement("span");
    bannerMsg.id = "cf-banner-msg";
    const bannerClose = document.createElement("button");
    bannerClose.id = "cf-banner-close";
    bannerClose.textContent = "✕";
    bannerClose.addEventListener("click", hideBanner);
    banner.appendChild(bannerMsg);
    banner.appendChild(bannerClose);
    wrapper.appendChild(banner);

    // Detail panel
    const panel = document.createElement("div");
    panel.id = "cf-panel";
    panel.classList.add("cf-hidden");
    panel.innerHTML = `
      <div class="cf-panel-header">
        <span>CortexFlow</span>
        <button id="cf-panel-close">✕</button>
      </div>
      <div class="cf-panel-body">
        <div class="cf-stat"><label>Risk</label><span id="cf-risk">—</span></div>
        <div class="cf-stat"><label>Instability</label><span id="cf-instability">—</span></div>
        <div class="cf-stat"><label>Drift</label><span id="cf-drift">—</span></div>
        <div class="cf-stat"><label>Fatigue</label><span id="cf-fatigue">—</span></div>
        <div class="cf-stat"><label>Conflict</label><span id="cf-conflict">—</span></div>
        <hr>
        <div class="cf-network-title">Network Activity</div>
        <div class="cf-stat"><label>ECN</label><span id="cf-ecn">—</span></div>
        <div class="cf-stat"><label>DMN</label><span id="cf-dmn">—</span></div>
        <div class="cf-stat"><label>Salience</label><span id="cf-salience">—</span></div>
        <div class="cf-stat"><label>Load</label><span id="cf-load">—</span></div>
        <hr>
        <div class="cf-attribution-title">Top Attribution</div>
        <div id="cf-attribution">—</div>
        <hr>
        <div class="cf-attribution-title">Recent Interventions</div>
        <div id="cf-interventions" class="cf-interventions-list">
          <span class="cf-interventions-empty">No interventions yet</span>
        </div>
      </div>
    `;
    wrapper.appendChild(panel);

    document.body.appendChild(wrapper);

    // Orb click toggles panel
    orb.addEventListener("click", togglePanel);
    panel.querySelector("#cf-panel-close").addEventListener("click", () => {
      panel.classList.add("cf-hidden");
    });
  }

  // ── Panel toggle ─────────────────────────────────────────

  function togglePanel() {
    const panel = document.getElementById("cf-panel");
    if (panel) {
      panel.classList.toggle("cf-hidden");
      // Refresh interventions list when opening
      if (!panel.classList.contains("cf-hidden")) {
        chrome.storage.local.get("intervention_history", ({ intervention_history }) => {
          updateInterventionPanel(intervention_history || []);
        });
      }
    }
  }

  // ── Banner helpers ───────────────────────────────────────

  function hideBanner() {
    const banner = document.getElementById("cf-banner");
    if (banner) banner.classList.add("cf-hidden");
  }

  function showBanner(msg, emoji, color) {
    const banner = document.getElementById("cf-banner");
    const text   = document.getElementById("cf-banner-msg");
    if (!banner || !text) return;

    text.textContent = (emoji || "🧠") + "  " + msg;
    banner.style.borderLeftColor = color || "#f59e0b";
    banner.classList.remove("cf-hidden");

    // Auto-dismiss after 12 seconds
    setTimeout(() => banner.classList.add("cf-hidden"), 12000);
  }

  // ── Graduated Intervention System ────────────────────────

  function getSignalLevel(val, thresholds) {
    if (val >= thresholds[2]) return 3;
    if (val >= thresholds[1]) return 2;
    if (val >= thresholds[0]) return 1;
    return 0;
  }

  function applyOrbHint(cls) {
    const orb = document.getElementById("cf-orb");
    if (!orb) return;
    if (orb.classList.contains("cf-red") || orb.classList.contains("cf-breakdown")) return;
    orb.classList.remove("cf-amber-pulse", "cf-drift-pulse", "cf-fatigue-dim");
    orb.classList.add(cls);
  }

  function tryPauseVideo() {
    document.querySelectorAll("video").forEach(function(v) { if (!v.paused) v.pause(); });
  }

  function getElapsedMin() {
    if (!_sessionStartMs) return null;
    return Math.floor((Date.now() - _sessionStartMs) / 60000);
  }

  function showSoftFocusCheck() {
    const banner = document.getElementById("cf-banner");
    const textEl = document.getElementById("cf-banner-msg");
    if (!banner || !textEl) return;
    textEl.innerHTML = '💭 Still with it? <button id="cf-focus-yes" style="margin-left:8px;padding:2px 10px;border-radius:6px;background:#22c55e;color:#fff;border:none;cursor:pointer;font-size:12px;">Yes, focused ✓</button>';
    banner.style.borderLeftColor = "#3b82f6";
    banner.classList.remove("cf-hidden");
    const yes = document.getElementById("cf-focus-yes");
    if (yes) yes.addEventListener("click", function() { hideBanner(); _sigCount.drift = 0; });
    setTimeout(function() { banner.classList.add("cf-hidden"); }, 15000);
  }

  function showBreathingTimer() {
    var old = document.getElementById("cf-breathing-timer");
    if (old) old.remove();
    var el = document.createElement("div");
    el.id = "cf-breathing-timer";
    el.innerHTML = '<div id="cf-bt-inner"><div id="cf-bt-title">😮‍💨 Micro-Break</div><div id="cf-bt-sub">Executive resources depleted — 60s reset:</div><div id="cf-bt-ring"></div><div id="cf-bt-countdown">60</div><button id="cf-bt-skip">Skip</button></div>';
    document.body.appendChild(el);
    var rem = 60;
    var cd  = document.getElementById("cf-bt-countdown");
    var iv  = setInterval(function() {
      if (cd) cd.textContent = --rem;
      if (rem <= 0) { clearInterval(iv); el.remove(); }
    }, 1000);
    var skip = document.getElementById("cf-bt-skip");
    if (skip) skip.addEventListener("click", function() { clearInterval(iv); el.remove(); });
  }

  // ── Breakdown Banner ─────────────────────────────────────

  function updateOrbColor(level) {
    var orb = document.getElementById("cf-orb");
    if (!orb) return;
    orb.classList.remove("cf-green", "cf-yellow", "cf-red", "cf-breakdown");
    if (level === 'red') {
      orb.style.background = 'radial-gradient(circle at 30% 30%, #ff6b6b, #dc2626)';
      orb.style.boxShadow = '0 0 18px rgba(220,38,38,0.7)';
      orb.classList.add("cf-red");
    } else if (level === 'yellow') {
      orb.style.background = 'radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b)';
      orb.style.boxShadow = '0 0 14px rgba(245,158,11,0.5)';
      orb.classList.add("cf-yellow");
    } else {
      orb.style.background = 'radial-gradient(circle at 30% 30%, #34d399, #10b981)';
      orb.style.boxShadow = '0 0 12px rgba(16,185,129,0.4)';
      orb.classList.add("cf-green");
    }
  }

  function handleInferenceResult(inferenceData) {
    var risk   = inferenceData.risk || 0;
    var breakdown_imminent = inferenceData.breakdown_imminent;
    var attribution = inferenceData.attribution;
    // attribution is the only field needed for the banner

    // Per-task red threshold (coding is stricter since mouse noise is expected)
    var RED_THRESHOLDS = { coding: 0.50, writing: 0.60, reading: 0.55, video: 0.65, general: 0.65 };
    var redAt = RED_THRESHOLDS[_currentTask] || 0.65;

    // Determine current level
    previousRiskLevel = currentRiskLevel;
    if (risk >= redAt || breakdown_imminent) {
      currentRiskLevel = 'red';
    } else if (risk >= 0.45) {
      currentRiskLevel = 'yellow';
    } else {
      currentRiskLevel = 'green';
    }

    // Update orb color always (unless breakdown banner is active)
    if (!isBreakdownActive) {
      updateOrbColor(currentRiskLevel);
    }

    // Track consecutive high risk windows
    if (currentRiskLevel === 'red') {
      consecutiveHighRisk++;
    } else {
      consecutiveHighRisk = 0;
    }

    // TRIGGER BANNER: fire when entering red FROM yellow or green
    var justEnteredRed = currentRiskLevel === 'red' && previousRiskLevel !== 'red';
    var cooldownExpired = Date.now() > breakdownCooldownUntil;

    if (justEnteredRed && cooldownExpired && !isBreakdownActive) {
      showBreakdownBanner(attribution);
    }
  }

  function showBreakdownBanner(attribution) {
    isBreakdownActive = true;

    // Find highest attribution reason
    var reason = "multiple focus signals spiking";
    if (attribution && typeof attribution === 'object') {
      var entries = Object.entries(attribution);
      if (entries.length > 0) {
        var topKey = entries.reduce(function(a, b) { return a[1] > b[1] ? a : b; })[0];
        var reasonMap = {
          switch_rate: "too many tab switches pulling you away",
          motor_var: "restless movement \u2014 attention is scattered",
          idle_ratio: "you\u2019ve mentally checked out",
          scroll_entropy: "aimless scrolling detected",
          distractor_attempts: "distractor sites pulling focus"
        };
        reason = reasonMap[topKey] || reason;
      }
    }

    // Remove any existing banner first
    var existing = document.getElementById('cortexflow-breakdown-banner');
    if (existing) existing.remove();

    // Create banner
    var banner = document.createElement('div');
    banner.id = 'cortexflow-breakdown-banner';
    banner.style.cssText = [
      "position:fixed !important",
      "top:0 !important",
      "left:0 !important",
      "width:100% !important",
      "z-index:2147483647 !important",
      "background:linear-gradient(135deg,#dc2626,#991b1b) !important",
      "color:white !important",
      "padding:14px 20px !important",
      "font-family:system-ui,-apple-system,sans-serif !important",
      "font-size:14px !important",
      "display:flex !important",
      "justify-content:space-between !important",
      "align-items:center !important",
      "box-shadow:0 4px 20px rgba(220,38,38,0.6) !important",
      "box-sizing:border-box !important"
    ].join(";");

    var leftSpan = document.createElement('span');
    leftSpan.innerHTML = '\uD83E\uDDE0 <strong>Focus breakdown detected</strong> \u2014 ' + reason;
    var dismissBtn = document.createElement('button');
    dismissBtn.id = 'cortexflow-dismiss-btn';
    dismissBtn.textContent = 'Got it, refocusing \u2192';
    dismissBtn.style.cssText = [
      "background:transparent !important",
      "border:1px solid rgba(255,255,255,0.6) !important",
      "color:white !important",
      "padding:6px 14px !important",
      "border-radius:6px !important",
      "cursor:pointer !important",
      "font-size:13px !important",
      "font-family:inherit !important",
      "white-space:nowrap !important",
      "margin-left:20px !important"
    ].join(";");

    dismissBtn.addEventListener('click', dismissBanner);
    banner.appendChild(leftSpan);
    banner.appendChild(dismissBtn);
    document.body.prepend(banner);

    // Auto-dismiss after 15 seconds
    setTimeout(function() {
      if (isBreakdownActive) dismissBanner();
    }, 15000);
  }

  function dismissBanner() {
    var banner = document.getElementById('cortexflow-breakdown-banner');
    if (banner) {
      banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      banner.style.transform = 'translateY(-100%)';
      banner.style.opacity = '0';
      setTimeout(function() { if (banner.parentNode) banner.remove(); }, 300);
    }
    isBreakdownActive = false;
    // Short 1-second cooldown — banner re-fires every time risk re-enters red
    breakdownCooldownUntil = Date.now() + 1000;
    // Reset orb to current actual color
    updateOrbColor(currentRiskLevel);
  }

  // Main graduated intervention dispatcher
  function runGraduatedInterventions(data, features) {
    if (!data || data.error) return;
    var now = Date.now();

    // Refresh task type + session start (non-blocking)
    chrome.storage.local.get(["cortexflow_task_type", "cortexflow_session_start"], function(s) {
      if (s.cortexflow_task_type) _currentTask = s.cortexflow_task_type.toLowerCase();
      if (s.cortexflow_session_start && !_sessionStartMs) _sessionStartMs = s.cortexflow_session_start;
    });

    var thr  = TASK_THRESHOLDS[_currentTask] || TASK_THRESHOLDS.general;
    var i    = data.instability || 0;
    var d    = data.drift       || 0;
    var f    = data.fatigue     || 0;
    var risk = data.risk        || 0;

    // ── Risk state tracking via handleInferenceResult ────
    handleInferenceResult(data);

    // Re-entry: require 2 consecutive low-risk windows before leaving breakdown state
    if (_inBreakdown) {
      if (risk < 0.35) {
        _recoveryCount++;
        if (_recoveryCount >= 2) {
          _inBreakdown   = false;
          _recoveryCount = 0;
          var orb2 = document.getElementById("cf-orb");
          if (orb2) orb2.classList.remove("cf-breakdown", "cf-amber-pulse", "cf-drift-pulse", "cf-fatigue-dim");
        }
      } else {
        _recoveryCount = 0;
      }
      return;
    }

    // Hysteresis counters
    _sigCount.instab  = i >= thr.instab[0]  ? _sigCount.instab  + 1 : Math.max(0, _sigCount.instab  - 1);
    _sigCount.drift   = d >= thr.drift[0]   ? _sigCount.drift   + 1 : Math.max(0, _sigCount.drift   - 1);
    _sigCount.fatigue = f >= thr.fatigue[0] ? _sigCount.fatigue + 1 : Math.max(0, _sigCount.fatigue - 1);

    // ── INSTABILITY (Salience Network) ────────────────────────
    var instabLv = getSignalLevel(i, thr.instab);
    if (instabLv === 1) {
      applyOrbHint("cf-amber-pulse");
    } else if (instabLv === 2 && now > _cooldownUntil.instab) {
      var sw = (features && features.switch_rate != null) ? Math.round(features.switch_rate) : "several";
      showBanner("You've switched context " + sw + "x/min — focus is fragmenting.", "🔀", "#f59e0b");
      _cooldownUntil.instab = now + TYPE_COOLDOWNS.instab;
      logIntervention("instability_l2", "context-switching warning", data);
    } else if (instabLv === 3 && _sigCount.instab >= 2 && now > _cooldownUntil.instab) {
      showBanner("Before you switch — one breath: does this serve your current goal?", "🛑", "#ef4444");
      _cooldownUntil.instab = now + TYPE_COOLDOWNS.instab;
      _inBreakdown = true;
      logIntervention("instability_l3", "impulse-control prompt", data);
    }

    // ── DRIFT (Default Mode Network) ──────────────────────────
    var driftLv = getSignalLevel(d, thr.drift);
    if (driftLv === 1) {
      applyOrbHint("cf-drift-pulse");
    } else if (driftLv === 2 && now > _cooldownUntil.drift) {
      showSoftFocusCheck();
      _cooldownUntil.drift = now + TYPE_COOLDOWNS.drift;
      logIntervention("drift_l2", "focus-check prompt", data);
    } else if (driftLv === 3 && _sigCount.drift >= 2 && now > _cooldownUntil.drift) {
      showBanner("Fully disconnected — pause and re-read your last paragraph before continuing.", "🌊", "#3b82f6");
      tryPauseVideo();
      _cooldownUntil.drift = now + TYPE_COOLDOWNS.drift;
      _inBreakdown = true;
      logIntervention("drift_l3", "full-drift intervention", data);
    }

    // ── FATIGUE (Executive depletion) ─────────────────────────
    var fatigueLv = getSignalLevel(f, thr.fatigue);
    if (fatigueLv === 1) {
      applyOrbHint("cf-fatigue-dim");
    } else if (fatigueLv === 2 && now > _cooldownUntil.fatigue) {
      var mins = getElapsedMin();
      var timeStr = mins != null ? (mins + " min") : "a while";
      showBanner("You've been at this for " + timeStr + " — a 2-min break will pay off.", "😴", "#6b7280");
      _cooldownUntil.fatigue = now + TYPE_COOLDOWNS.fatigue;
      logIntervention("fatigue_l2", "break suggestion", data);
    } else if (fatigueLv === 3 && _sigCount.fatigue >= 2 && now > _cooldownUntil.fatigue) {
      showBreathingTimer();
      _cooldownUntil.fatigue = now + TYPE_COOLDOWNS.fatigue;
      _inBreakdown = true;
      logIntervention("fatigue_l3", "breathing timer", data);
    }
  }

  // Legacy wrapper — keeps external callers working
  function maybeShowIntervention(data, features) {
    runGraduatedInterventions(data, features);
  }

  function logIntervention(type, message, data) {
    chrome.storage.local.get("intervention_history", ({ intervention_history }) => {
      const history = intervention_history || [];
      history.push({
        t:       Date.now(),
        type,
        message,
        risk:    data.risk,
        i:       data.instability,
        d:       data.drift,
        f:       data.fatigue,
      });
      if (history.length > 100) history.splice(0, history.length - 100);
      chrome.storage.local.set({ intervention_history: history });
      // Refresh panel if visible
      updateInterventionPanel(history);
    });
  }

  function updateInterventionPanel(history) {
    const container = document.getElementById("cf-interventions");
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = '<span class="cf-interventions-empty">No interventions yet</span>';
      return;
    }

    // Show last 5, newest first
    const recent = history.slice(-5).reverse();
    container.innerHTML = recent.map((item) => {
      const ago = formatTimeAgo(item.t);
      const typeLabel = item.type.replace(/_/g, " ");
      return `<div class="cf-intervention-item">
        <span class="cf-intervention-type">${typeLabel}</span>
        <span class="cf-intervention-ago">${ago}</span>
      </div>`;
    }).join("");
  }

  function formatTimeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ── Update UI with telemetry data ────────────────────────

  function updateOverlay(data, features) {
    if (!data || data.error) return;

    // Fill panel stats (always updated, even during breakdown)
    setText("cf-risk", fmtPct(data.risk));
    setText("cf-instability", fmtPct(data.instability));
    setText("cf-drift", fmtPct(data.drift));
    setText("cf-fatigue", fmtPct(data.fatigue));
    setText("cf-conflict", fmtPct(data.accumulated_conflict));

    if (data.network) {
      setText("cf-ecn", fmtPct(data.network.ECN));
      setText("cf-dmn", fmtPct(data.network.DMN));
      setText("cf-salience", fmtPct(data.network.Salience));
      setText("cf-load", fmtPct(data.network.Load));
    }

    if (data.attribution) {
      const topKey = Object.entries(data.attribution)
        .sort((a, b) => b[1] - a[1])[0];
      setText("cf-attribution", topKey ? `${topKey[0]}: ${fmtPct(topKey[1])}` : "—");
    }

    // Graduated intervention check (also calls updateRiskState which handles orb color)
    runGraduatedInterventions(data, features || data.features || {});
  }

  // ── Utilities ────────────────────────────────────────────

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function fmtPct(v) {
    return v != null ? (v * 100).toFixed(1) + "%" : "—";
  }

  // ── Keyboard shortcuts ───────────────────────────────────

  document.addEventListener("keydown", (e) => {
    // Escape dismisses the banner
    if (e.key === "Escape") {
      const banner = document.getElementById("cf-banner");
      if (banner && !banner.classList.contains("cf-hidden")) {
        hideBanner();
      }
    }
    // Shift+F toggles the detail panel
    if (e.key === "F" && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      togglePanel();
    }
  });

  // ── Listen for telemetry data ─────────────────────────────

  window.addEventListener("cortexflow-telemetry", (e) => {
    const d = e.detail?.inference ?? e.detail;
    if (d) updateOverlay(d);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "INFERENCE_RESULT") {
      // Pass features as second arg so graduated interventions get raw signals
      updateOverlay(message.payload, message.features || {});
    }
    if (message.type === "SESSION_ENDED") {
      // Reset overlay state when session ends from website or extension
      const orb = document.getElementById("cf-orb");
      if (orb) {
        orb.classList.remove("cf-red", "cf-yellow", "cf-breakdown", "cf-amber-pulse", "cf-drift-pulse", "cf-fatigue-dim");
        orb.classList.add("cf-green");
      }
      _inBreakdown   = false;
      _recoveryCount = 0;
      _sigCount.instab = _sigCount.drift = _sigCount.fatigue = 0;
      isBreakdownActive      = false;
      breakdownCooldownUntil = 0;
      consecutiveHighRisk    = 0;
      previousRiskLevel      = 'green';
      currentRiskLevel       = 'green';
      const bd = document.getElementById("cortexflow-breakdown-banner");
      if (bd) bd.remove();
    }
  });

  // ── Initialise ───────────────────────────────────────────

  if (document.body) {
    createOverlay();
  } else {
    document.addEventListener("DOMContentLoaded", createOverlay);
  }

  console.log("[CortexFlow] Overlay injected.");
})();
