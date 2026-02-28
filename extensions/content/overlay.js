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

const COOLDOWN_MS = 45000;  // minimum 45 seconds between banners
let lastBannerTime = 0;
let lastBannerType = null;

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

  // ── Intervention logic (signal-specific messages) ─────────

  function maybeShowIntervention(data, features) {
    if (!data || data.error) return;

    const riskThreshold = window.CF_CONFIG?.RISK_DANGER_THRESHOLD || 0.75;
    if ((data.risk || 0) < riskThreshold) return;

    const now = Date.now();
    if (now - lastBannerTime < COOLDOWN_MS) return;  // respect cooldown

    const i = data.instability || 0;
    const d = data.drift       || 0;
    const f = data.fatigue     || 0;

    const errorRate     = features?.error_rate            || 0;
    const hesitations   = features?.hesitation_rate      || 0;
    const dirChanges    = features?.direction_change_rate || 0;
    const wpm           = features?.wpm_norm               || 0;
    const burstRate     = features?.burst_rate           || 0;
    const tabHidden     = features?.tab_hidden_ratio     || 0;
    const scrollEnt     = features?.scroll_entropy       || 0;
    const clickRate     = features?.click_rate           || 0;
    const mouseDistNorm = features?.mouse_distance_norm  || 0;

    let msg = null;
    let type = null;
    let emoji = "🧠";
    let color = "#f59e0b";

    // 1. Erratic mouse = anxiety / restlessness
    if (dirChanges > 0.6 && hesitations > 0.4 && i > 0.5) {
      msg = "Your mouse is moving erratically — your mind might be jumping around. Take a breath and slow down.";
      type = "erratic_mouse"; emoji = "🖱️"; color = "#f59e0b";
    }
    // 2. High error rate = cognitive overload or rushing
    else if (errorRate > 0.25 && i > 0.4) {
      msg = "You're making a lot of corrections — could be rushing or overloaded. Slow down, you'll be faster.";
      type = "high_errors"; emoji = "⌨️"; color = "#f59e0b";
    }
    // 3. Typing slowed way down but not idle = zoning out
    else if (wpm < 0.1 && burstRate < 0.1 && d > 0.5) {
      msg = "Your typing stopped but you're still here — are you zoned out? Re-read your last paragraph.";
      type = "typing_stopped"; emoji = "💭"; color = "#3b82f6";
    }
    // 4. Rapid erratic scrolling
    else if (scrollEnt > 0.6 && i > 0.5) {
      msg = "You're scrolling up and down rapidly — this usually means you're looking for something to distract you. Pick one thing and stick to it.";
      type = "erratic_scroll"; emoji = "📜"; color = "#f59e0b";
    }
    // 5. Tab was hidden = actually left the page
    else if (tabHidden > 0.4) {
      msg = "You spent time away from this tab. Welcome back — take 10 seconds to remember where you were before diving back in.";
      type = "tab_switched"; emoji = "🔙"; color = "#8b5cf6";
    }
    // 6. High click rate + high instability = impulsive clicking
    else if (clickRate > 0.5 && i > 0.6) {
      msg = "Lots of clicking around — are you actually reading or just scanning? Try picking one spot and staying there.";
      type = "impulsive_clicking"; emoji = "👆"; color = "#f59e0b";
    }
    // 7. Drift dominant = passive / zoning out
    else if (d > 0.7) {
      msg = "You seem to be on autopilot right now. Still engaged? Try saying out loud what you just read or wrote.";
      type = "drift"; emoji = "🌊"; color = "#3b82f6";
    }
    // 8. Fatigue high
    else if (f > 0.8) {
      msg = "You've been at this for a while — your focus is degrading naturally. A 5-minute break will actually save you time.";
      type = "fatigue"; emoji = "😴"; color = "#6b7280";
    }
    // 9. General breakdown (fallback)
    else if (data.breakdown_imminent) {
      msg = "Attention breakdown detected. Step away from the screen for 60 seconds — seriously, it helps.";
      type = "breakdown"; emoji = "⚠️"; color = "#ef4444";
    }

    if (!msg || type === lastBannerType) return;  // don't repeat same message twice in a row

    showBanner(msg, emoji, color);
    lastBannerTime = now;
    lastBannerType = type;

    logIntervention(type, msg, data);
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

    // Intervention check (features passed when available from INFERENCE_RESULT message)
    maybeShowIntervention(data, data.features || {});
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
      updateOverlay(message.payload);
      maybeShowIntervention(message.payload, message.features || {});
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
