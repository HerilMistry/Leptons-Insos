// ============================================================
// CortexFlow — Background Service Worker
// ============================================================

importScripts("../config.js");

// ── State ──────────────────────────────────────────────────
let sessionId        = null;   // single source of truth
let userId           = null;
let taskType         = "general";
let tabSwitchCount   = 0;
let sessionStartTime = null;
let _activeSessionPollId = null;  // interval id for website-session polling

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
  // Guard: prevent duplicate sessions
  if (sessionId) {
    console.warn("[CortexFlow] Session already active:", sessionId);
    return { error: "session_already_active", session_id: sessionId };
  }

  userId = await loadUserId();
  if (!userId) {
    console.warn("[CortexFlow] No user ID found. Session not started.");
    return { error: "no_user_id" };
  }

  taskType         = task;
  tabSwitchCount   = 0;
  sessionStartTime = Date.now();

  try {
    const res = await fetch(apiUrl("/api/sessions/start/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, task_type: taskType }),
    });
    const data = await res.json();
    sessionId = data.session_id;

    chrome.storage.local.set({
      cortexflow_session_id:     sessionId,
      cortexflow_task_type:      taskType,
      cortexflow_session_active: true,
      cortexflow_session_start:  sessionStartTime,
      active_session: {
        session_id:  sessionId,
        task_type:   taskType,
        start_time:  new Date(sessionStartTime).toISOString(),
        source:      "extension",
      },
    });

    stopActiveSessionPolling();
    console.log("[CortexFlow] Session started:", sessionId);
    return data;
  } catch (err) {
    console.error("[CortexFlow] Failed to start session:", err);
    return { error: err.message };
  }
}

async function endSession() {
  const sid = sessionId;
  sessionId        = null;
  sessionStartTime = null;
  tabSwitchCount   = 0;

  chrome.storage.local.set({
    cortexflow_session_id:     null,
    cortexflow_session_active: false,
    active_session:            null,
  });

  if (sid) {
    try {
      await fetch(apiUrl("/api/sessions/stop/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      });
    } catch (err) {
      console.warn("[CortexFlow] Could not notify backend of session end:", err);
    }
  }

  console.log("[CortexFlow] Session ended.");
  startActiveSessionPolling();
  return { status: "ended" };
}

// ── Telemetry relay ────────────────────────────────────────

// ── Active-session polling (detect sessions started from website) ────

function startActiveSessionPolling() {
  stopActiveSessionPolling();
  _activeSessionPollId = setInterval(async () => {
    // Only poll when no session is locally active
    if (sessionId) return;
    const stored = await chrome.storage.local.get("cortexflow_user_id");
    const uid = stored.cortexflow_user_id;
    if (!uid) return;  // no user logged in
    try {
      const res = await fetch(apiUrl(`/api/sessions/active/?user_id=${uid}`));
      const data = await res.json();
      if (data.status === "active" && data.session_id) {
        // Website started a session — adopt it
        sessionId        = data.session_id;
        userId           = uid;
        taskType         = data.task_type || "general";
        sessionStartTime = data.start_time ? new Date(data.start_time).getTime() : Date.now();
        chrome.storage.local.set({
          cortexflow_session_id:     sessionId,
          cortexflow_task_type:      taskType,
          cortexflow_session_active: true,
          cortexflow_session_start:  sessionStartTime,
          active_session: {
            session_id:  sessionId,
            task_type:   taskType,
            start_time:  data.start_time || new Date(sessionStartTime).toISOString(),
            source:      "website",
          },
        });
        stopActiveSessionPolling();
        console.log("[CortexFlow] Adopted session from website:", sessionId);
      }
    } catch {
      // Backend unreachable — silent retry next tick
    }
  }, 5000);
}

function stopActiveSessionPolling() {
  if (_activeSessionPollId) {
    clearInterval(_activeSessionPollId);
    _activeSessionPollId = null;
  }
}

async function sendTelemetry(features) {
  // Recover session from storage if service worker was restarted or
  // session was started from the website (not the popup)
  if (!sessionId) {
    const stored = await chrome.storage.local.get([
      "cortexflow_session_id",
      "cortexflow_user_id",
      "cortexflow_task_type",
      "cortexflow_session_start",
    ]);
    if (stored.cortexflow_session_id) {
      sessionId        = stored.cortexflow_session_id;
      userId           = stored.cortexflow_user_id   || "unknown";
      taskType         = stored.cortexflow_task_type  || "general";
      sessionStartTime = stored.cortexflow_session_start || Date.now();
      console.log("[CortexFlow] Recovered session from storage:", sessionId);
    } else {
      return { success: false, error: "No active session" };
    }
  }

  const elapsed      = sessionStartTime ? (Date.now() - sessionStartTime) / 1000 : 0;
  const durationNorm = Math.min(elapsed / 3600, CF_CONFIG.MAX_DURATION_NORM);
  const switchRate   = elapsed > 0 ? tabSwitchCount / (elapsed / 60) : 0;

  const enrichedFeatures = {
    ...features,
    switch_rate: parseFloat(switchRate.toFixed(4)),
  };

  try {
    const res = await fetch(apiUrl("/api/telemetry"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id:    sessionId,
        task_type:     taskType,
        features:      enrichedFeatures,
        duration_norm: parseFloat(durationNorm.toFixed(4)),
      }),
    });

    const inferenceResult = await res.json();

    // Save for popup polling
    await chrome.storage.local.set({
      cortexflow_latest_risk:      inferenceResult.risk,
      cortexflow_latest_telemetry: inferenceResult,
      lastInference:               inferenceResult,
    });

    // Forward to active tab overlay (with raw features for signal-specific interventions)
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && !activeTab.url?.startsWith("chrome://")) {
        await chrome.tabs.sendMessage(activeTab.id, {
          type:     "INFERENCE_RESULT",
          payload:  inferenceResult,
          features: enrichedFeatures,
        });
      }
    } catch {
      // Tab may not have content script — normal
    }

    console.log("[CortexFlow] Telemetry sent successfully:", inferenceResult.risk);
    return { success: true, inference: inferenceResult };
  } catch (err) {
    console.error("[CortexFlow] Telemetry send failed:", err);
    return { success: false, error: err.message };
  }
}

// ── Tab / window switch tracking ───────────────────────────

chrome.tabs.onActivated.addListener(() => {
  if (sessionId) {
    tabSwitchCount++;
    chrome.storage.local.set({ cortexflow_tab_switches: tabSwitchCount });
  }
});

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
      case "START_SESSION": {
        const taskType = msg.payload?.taskType ?? msg.taskType ?? "general";
        sendResponse(await startSession(taskType));
        break;
      }
      case "END_SESSION":
        sendResponse(await endSession());
        break;
      case "SEND_TELEMETRY":
        sendResponse(await sendTelemetry(msg.features));
        break;
      case "GET_STATUS":
        sendResponse({
          active:         !!sessionId,
          sessionId,
          tabSwitchCount,
          elapsed: sessionStartTime ? Date.now() - sessionStartTime : 0,
        });
        break;
      default:
        sendResponse({ error: "unknown_message_type" });
    }
  })();
  return true;
});

// ── Sync session started/ended from website ────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  // User ID synced from website (login)
  if (changes.cortexflow_user_id) {
    const uid = changes.cortexflow_user_id.newValue;
    if (uid) {
      console.log("[CortexFlow] Session synced from website: cortexflow_user_id =", uid);
    }
  }

  // Website set a new session
  if (changes.cortexflow_session_id?.newValue) {
    chrome.storage.local.get(
      ["cortexflow_session_id", "cortexflow_user_id", "cortexflow_task_type", "cortexflow_session_start"],
      (data) => {
        sessionId        = data.cortexflow_session_id;
        userId           = data.cortexflow_user_id    || null;
        taskType         = data.cortexflow_task_type   || "general";
        sessionStartTime = data.cortexflow_session_start || Date.now();
        stopActiveSessionPolling();
        console.log("[CortexFlow] Session synced from website:", sessionId);
      }
    );
  }

  // Website or extension cleared the session — also watch the active_session key
  if (
    ("cortexflow_session_id" in changes &&
      (changes.cortexflow_session_id.newValue === null ||
        changes.cortexflow_session_id.newValue === undefined)) ||
    ("active_session" in changes &&
      (changes.active_session.newValue === null ||
        changes.active_session.newValue === undefined))
  ) {
    sessionId        = null;
    sessionStartTime = null;
    tabSwitchCount   = 0;
    startActiveSessionPolling();
    // Tell content scripts to reset overlay to green
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id && !tab.url?.startsWith("chrome://")) {
        chrome.tabs.sendMessage(tab.id, { type: "SESSION_ENDED" }).catch(() => {});
      }
    });
    console.log("[CortexFlow] Session ended — synced from storage");
  }
});

// ── Restore state on service worker restart ────────────────

chrome.storage.local.get(
  [
    "cortexflow_session_id",
    "cortexflow_session_active",
    "cortexflow_session_start",
    "cortexflow_task_type",
    "cortexflow_user_id",
    "cortexflow_tab_switches",
  ],
  (data) => {
    if (data.cortexflow_session_active && data.cortexflow_session_id) {
      sessionId        = data.cortexflow_session_id;
      userId           = data.cortexflow_user_id      || null;
      sessionStartTime = data.cortexflow_session_start || Date.now();
      taskType         = data.cortexflow_task_type    || "general";
      tabSwitchCount   = data.cortexflow_tab_switches  || 0;
      console.log("[CortexFlow] Restored session:", sessionId);
    } else {
      // No active session — start polling for one from the website
      startActiveSessionPolling();
    }
    chrome.storage.local.remove("__cf_boot_reload");
    console.log("[CortexFlow] Background service worker started (files reloaded from disk).");
  }
);

// ── Startup / install ───────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(["cortexflow_session_active", "cortexflow_session_id"]);
  if (data.cortexflow_session_active && data.cortexflow_session_id) {
    // Resume telemetry already restored in the startup block above
    console.log("[CortexFlow] onStartup: active session found, telemetry resumed.");
  } else {
    startActiveSessionPolling();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["cortexflow_session_active", "cortexflow_session_id"]);
  if (!data.cortexflow_session_active) {
    startActiveSessionPolling();
  }
});
