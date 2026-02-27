// ============================================================
// CortexFlow — Background Service Worker
// ============================================================
// Responsibilities:
//   • Session lifecycle (start / end)
//   • Tab-switch counting (content scripts can't see cross-tab)
//   • Forwarding telemetry to the backend API
// ============================================================

// ── Import config (service worker can use importScripts) ───
importScripts("../config.js");

// ── State ──────────────────────────────────────────────────
let sessionId = null;
let userId = null;
let taskType = "general";
let tabSwitchCount = 0;
let sessionStartTime = null;

// ── Helpers ────────────────────────────────────────────────

function apiUrl(path) {
  return `${CF_CONFIG.API_BASE_URL}${path}`;
}

async function loadUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get("cortexflow_user_id", (data) => {
      resolve(data.cortexflow_user_id || null);
    });
  });
}

// ── Session management ─────────────────────────────────────

async function startSession(task = "general") {
  userId = await loadUserId();
  if (!userId) {
    console.warn("[CortexFlow] No user ID found in storage. Session not started.");
    return { error: "no_user_id" };
  }

  taskType = task;
  tabSwitchCount = 0;
  sessionStartTime = Date.now();

  try {
    const res = await fetch(apiUrl("/api/session/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, task_type: taskType })
    });
    const data = await res.json();
    sessionId = data.session_id;

    // Persist session info
    chrome.storage.local.set({
      cortexflow_session_id: sessionId,
      cortexflow_task_type: taskType,
      cortexflow_session_active: true,
      cortexflow_session_start: sessionStartTime
    });

    console.log("[CortexFlow] Session started:", sessionId);
    return data;
  } catch (err) {
    console.error("[CortexFlow] Failed to start session:", err);
    return { error: err.message };
  }
}

async function endSession() {
  sessionId = null;
  sessionStartTime = null;
  tabSwitchCount = 0;

  chrome.storage.local.set({
    cortexflow_session_id: null,
    cortexflow_session_active: false
  });

  console.log("[CortexFlow] Session ended.");
  return { status: "ended" };
}

// ── Telemetry relay ────────────────────────────────────────

async function sendTelemetry(features) {
  if (!sessionId) return { error: "no_session" };

  // Compute normalised duration (0 → 1 over ~60 min)
  const elapsed = (Date.now() - sessionStartTime) / 1000; // seconds
  const durationNorm = Math.min(elapsed / 3600, CF_CONFIG.MAX_DURATION_NORM);

  // Inject tab_switch_count (only background can track this)
  const enrichedFeatures = {
    ...features,
    tab_switch_count: tabSwitchCount
  };

  try {
    const res = await fetch(apiUrl("/api/telemetry"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        task_type: taskType,
        features: enrichedFeatures,
        duration_norm: parseFloat(durationNorm.toFixed(4))
      })
    });
    const data = await res.json();

    // Persist latest risk data for popup
    chrome.storage.local.set({
      cortexflow_latest_risk: data.risk,
      cortexflow_latest_telemetry: data
    });

    return data;
  } catch (err) {
    console.error("[CortexFlow] Telemetry send failed:", err);
    return { error: err.message };
  }
}

// ── Tab switch tracking ────────────────────────────────────

chrome.tabs.onActivated.addListener(() => {
  if (sessionId) {
    tabSwitchCount++;
    chrome.storage.local.set({ cortexflow_tab_switches: tabSwitchCount });
  }
});

// Also track window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (sessionId && windowId !== chrome.windows.WINDOW_ID_NONE) {
    tabSwitchCount++;
    chrome.storage.local.set({ cortexflow_tab_switches: tabSwitchCount });
  }
});

// ── Message router ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "START_SESSION":
        sendResponse(await startSession(msg.taskType));
        break;

      case "END_SESSION":
        sendResponse(await endSession());
        break;

      case "SEND_TELEMETRY":
        sendResponse(await sendTelemetry(msg.features));
        break;

      case "GET_STATUS":
        sendResponse({
          active: !!sessionId,
          sessionId,
          tabSwitchCount,
          elapsed: sessionStartTime ? Date.now() - sessionStartTime : 0
        });
        break;

      default:
        sendResponse({ error: "unknown_message_type" });
    }
  })();
  return true; // keep message channel open for async response
});

// ── Restore session on service worker restart ──────────────
chrome.storage.local.get(
  ["cortexflow_session_id", "cortexflow_session_active", "cortexflow_session_start", "cortexflow_task_type", "cortexflow_tab_switches"],
  (data) => {
    if (data.cortexflow_session_active && data.cortexflow_session_id) {
      sessionId = data.cortexflow_session_id;
      sessionStartTime = data.cortexflow_session_start || Date.now();
      taskType = data.cortexflow_task_type || "general";
      tabSwitchCount = data.cortexflow_tab_switches || 0;
      console.log("[CortexFlow] Restored session:", sessionId);
    }
  }
);
key 