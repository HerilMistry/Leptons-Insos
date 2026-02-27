// ============================================================
// CortexFlow — Overlay UI (Content Script)
// ============================================================
// Floating orb + intervention panel injected into every page.
// Receives telemetry responses via custom event from telemetry.js.
//
// Features implemented from Copilot prompts:
//   • Orb pulses (cf-breakdown class) when breakdown_imminent
//   • 30-second cooldown between banners
//   • Intervention history stored in chrome.storage (max 50)
//   • Escape to dismiss banner, Shift+F to toggle panel
// ============================================================

(() => {
  "use strict";

  // ── Banner cooldown ──────────────────────────────────────
  let lastBannerTime = 0;

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
    if (panel) panel.classList.toggle("cf-hidden");
  }

  // ── Banner helpers ───────────────────────────────────────

  function showBanner(msg) {
    const banner = document.getElementById("cf-banner");
    const bannerMsg = document.getElementById("cf-banner-msg");
    if (!banner || !bannerMsg) return;
    bannerMsg.textContent = msg;
    banner.classList.remove("cf-hidden");
  }

  function hideBanner() {
    const banner = document.getElementById("cf-banner");
    if (banner) banner.classList.add("cf-hidden");
  }

  // ── Intervention logic ───────────────────────────────────

  function maybeShowIntervention(data) {
    if (!data || data.error) return;

    const riskThreshold = window.CF_CONFIG?.RISK_DANGER_THRESHOLD || 0.75;
    if ((data.risk || 0) < riskThreshold) return;

    // Cooldown check
    const cooldown = window.CF_CONFIG?.BANNER_COOLDOWN_MS || 30000;
    if (Date.now() - lastBannerTime < cooldown) return;

    const messages = window.CF_CONFIG?.INTERVENTION_MESSAGES || [
      "Your focus may be slipping. Consider a short break."
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    showBanner(msg);
    lastBannerTime = Date.now();

    // Store intervention history
    storeInterventionHistory(msg, data.risk);
  }

  // ── Intervention history (chrome.storage) ────────────────

  function storeInterventionHistory(msg, risk) {
    const maxEntries = window.CF_CONFIG?.MAX_INTERVENTION_HISTORY || 50;

    chrome.storage.local.get("intervention_history", (result) => {
      const history = result.intervention_history || [];
      history.push({
        timestamp: Date.now(),
        message: msg,
        risk: risk
      });

      // Keep only the last N entries
      while (history.length > maxEntries) {
        history.shift();
      }

      chrome.storage.local.set({ intervention_history: history });
    });
  }

  // ── Update UI with telemetry data ────────────────────────

  function updateOverlay(data) {
    if (!data || data.error) return;

    const orb = document.getElementById("cf-orb");
    if (orb) {
      // Colour the orb based on risk
      const risk = data.risk || 0;
      const warn = window.CF_CONFIG?.RISK_WARN_THRESHOLD || 0.5;
      const danger = window.CF_CONFIG?.RISK_DANGER_THRESHOLD || 0.75;

      orb.classList.remove("cf-green", "cf-yellow", "cf-red", "cf-breakdown");

      if (risk >= danger) {
        orb.classList.add("cf-red");
      } else if (risk >= warn) {
        orb.classList.add("cf-yellow");
      } else {
        orb.classList.add("cf-green");
      }

      // Pulse when breakdown imminent
      if (data.breakdown_imminent) {
        orb.classList.add("cf-breakdown");
      }
    }

    // Fill panel stats
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

    // Intervention check
    maybeShowIntervention(data);
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

  // ── Listen for telemetry data from telemetry.js ──────────

  window.addEventListener("cortexflow-telemetry", (e) => {
    updateOverlay(e.detail);
  });

  // ── Initialise ───────────────────────────────────────────

  if (document.body) {
    createOverlay();
  } else {
    document.addEventListener("DOMContentLoaded", createOverlay);
  }

  console.log("[CortexFlow] Overlay injected.");
})();
