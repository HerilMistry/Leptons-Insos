// ============================================================
// CortexFlow — Popup Script
// ============================================================
// Controls session start/end and shows live stats.
// Uses Groq LLM to classify the user's task description.
// ============================================================

(() => {
  "use strict";

  // ── Groq API config ──────────────────────────────────────
  // Key is loaded from chrome.storage.local ("groq_api_key").
  // Set it once via the setup-env.js script or browser console:
  //   chrome.storage.local.set({ groq_api_key: "gsk_..." });
  let GROQ_API_KEY = "";
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "llama-3.1-8b-instant";
  const GROQ_TIMEOUT_MS = 3000;

  const TASK_EMOJI = {
    writing: "✍️ Writing",
    reading: "📖 Reading",
    coding:  "💻 Coding",
    video:   "🎬 Video / Lecture",
    general: "🧠 General"
  };

  const TASK_COLOURS = {
    writing: "rgba(234,179,8,0.18)",
    reading: "rgba(34,197,94,0.18)",
    coding:  "rgba(99,102,241,0.18)",
    video:   "rgba(239,68,68,0.18)",
    general: "rgba(148,163,184,0.15)"
  };

  // ── DOM refs ─────────────────────────────────────────────
  const startBtn   = document.getElementById("cf-start-btn");
  const endBtn     = document.getElementById("cf-end-btn");
  const statusEl   = document.getElementById("cf-status");
  const statusDot  = document.getElementById("cf-status-dot");
  const statusTxt  = document.getElementById("cf-status-text");
  const liveStats  = document.getElementById("cf-live-stats");
  const elapsedEl  = document.getElementById("cf-elapsed");
  const switchEl   = document.getElementById("cf-switches");
  const riskEl     = document.getElementById("cf-risk-level");
  const dashLink   = document.getElementById("cf-dashboard-link");
  const taskInput  = document.getElementById("cf-task-input");
  const charCount  = document.getElementById("cf-char-count");
  const taskTag    = document.getElementById("cf-task-tag");
  const usernameEl = document.getElementById("cf-username");
  const syncBtn    = document.getElementById("cf-sync-btn");

  // ── NLP state ────────────────────────────────────────────
  let detectedTaskType    = "general";
  let domainDetectedType  = "general"; // set by auto-detect on popup open
  let debounceTimer = null;

  // ── Dashboard link ───────────────────────────────────────
  dashLink.href = `${CF_CONFIG.API_BASE_URL}/dashboard`;

  // ── Load Groq API key from storage ───────────────────────
  chrome.storage.local.get("groq_api_key", (data) => {
    if (data.groq_api_key) GROQ_API_KEY = data.groq_api_key;
  });

  // ── Helpers ──────────────────────────────────────────────

  function formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function setActive(active) {
    if (active) {
      statusEl.classList.remove("cf-status-inactive");
      statusEl.classList.add("cf-status-active");
      statusTxt.textContent = "Session active";
      startBtn.disabled = true;
      endBtn.disabled = false;
      taskInput.disabled = true;
      liveStats.classList.remove("cf-hidden");
    } else {
      statusEl.classList.remove("cf-status-active");
      statusEl.classList.add("cf-status-inactive");
      statusTxt.textContent = "Inactive";
      startBtn.disabled = false;
      endBtn.disabled = true;
      taskInput.disabled = false;
      liveStats.classList.add("cf-hidden");
    }
  }

  // ── Domain-based task auto-detection ────────────────────

  const DOMAIN_MAP = [
    { domains: ["leetcode.com","github.com","stackoverflow.com","replit.com",
                "codepen.io","hackerrank.com","codeforces.com","codesandbox.io",
                "jsfiddle.net","gitpod.io"],                 task: "coding"  },
    { domains: ["youtube.com","coursera.org","udemy.com","vimeo.com",
                "edx.org","pluralsight.com","linkedin.com/learning"],        task: "video"   },
    { domains: ["medium.com","arxiv.org","wikipedia.org","substack.com",
                "notion.so","docs.google.com","confluence","readthedocs"],   task: "reading" },
    { domains: ["docs.google.com/document","overleaf.com","notion.so",
                "hackmd.io"],                                task: "writing" },
  ];

  async function detectTaskFromCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url  = tabs[0]?.url || "";
        const host = url.replace(/https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase();
        for (const entry of DOMAIN_MAP) {
          if (entry.domains.some((d) => host.includes(d))) return resolve(entry.task);
        }
        resolve("general");
      });
    });
  }

  // ── Get user ID, show warning if missing; update username display ─────────────────

  function applyUserUI(data) {
    const { cortexflow_user_id, cortexflow_user_name } = data;
    if (!cortexflow_user_id) {
      if (usernameEl) {
        usernameEl.textContent = "";
        usernameEl.classList.add("cf-hidden");
      }
      if (syncBtn) syncBtn.classList.remove("cf-hidden");
      statusTxt.textContent = "⚠️ Log in on CortexFlow website first";
      statusEl.classList.remove("cf-status-active");
      statusEl.classList.add("cf-status-inactive");
      startBtn.disabled = true;
      return null;
    }
    if (usernameEl) {
      usernameEl.textContent = cortexflow_user_name || "Logged in";
      usernameEl.classList.remove("cf-hidden");
    }
    if (syncBtn) syncBtn.classList.add("cf-hidden");
    return cortexflow_user_id;
  }

  async function getUserId() {
    const data = await chrome.storage.local.get(["cortexflow_user_id", "cortexflow_user_name"]);
    applyUserUI(data);
    return data.cortexflow_user_id || null;
  }

  // ── Groq classification ──────────────────────────────────

  async function classifyTask(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a task classifier. Given a description of what someone is working on, classify it into exactly one of these task types: writing, reading, coding, video, general. Respond with ONLY a JSON object like: {\"task_type\": \"coding\", \"confidence\": 0.9} No explanation, no markdown, just the JSON."
            },
            { role: "user", content: text }
          ],
          temperature: 0,
          max_tokens: 40
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      const parsed = JSON.parse(raw);

      if (parsed.task_type && TASK_EMOJI[parsed.task_type]) {
        return parsed.task_type;
      }
      return "general";
    } catch {
      clearTimeout(timeout);
      return "general";
    }
  }

  function showTaskTag(type) {
    detectedTaskType = type;
    taskTag.textContent = TASK_EMOJI[type] || TASK_EMOJI.general;
    taskTag.style.background = TASK_COLOURS[type] || TASK_COLOURS.general;
    taskTag.classList.remove("cf-hidden");
  }

  // ── Input handler with 600ms debounce ────────────────────

  taskInput.addEventListener("input", () => {
    const val = taskInput.value;
    charCount.textContent = `${val.length}/120`;

    clearTimeout(debounceTimer);

    if (val.trim().length < 3) {
      taskTag.classList.add("cf-hidden");
      // Fall back to domain auto-detection, not hardcoded "general"
      detectedTaskType = domainDetectedType;
      if (domainDetectedType !== "general") showTaskTag(domainDetectedType);
      return;
    }

    debounceTimer = setTimeout(async () => {
      taskTag.textContent = "⏳ Detecting…";
      taskTag.style.background = TASK_COLOURS.general;
      taskTag.classList.remove("cf-hidden");

      const type = await classifyTask(val.trim());
      showTaskTag(type);
    }, 600);
  });

  // ── Check current status on popup open ───────────────────

  (async () => {
    // 1. Validate user ID — disable start if not logged in
    const uid = await getUserId();

    // 2. Auto-detect task type from current tab URL
    const autoType = await detectTaskFromCurrentTab();
    domainDetectedType = autoType; // save as fallback
    // Only apply auto-detect if no NLP result is already in storage
    if (!taskInput.value.trim()) {
      showTaskTag(autoType);
    }

    // 3. Check if a session is already running
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res && res.active) {
        setActive(true);
        elapsedEl.textContent = formatElapsed(res.elapsed);
        switchEl.textContent  = res.tabSwitchCount;
      } else if (uid) {
        setActive(false); // logged in, no session — show Inactive, enable start
        startBtn.disabled = false;
      }
    });
  })();

  // Load latest risk level from storage on popup open
  chrome.storage.local.get("cortexflow_latest_risk", (data) => {
    if (data.cortexflow_latest_risk != null) {
      riskEl.textContent = (data.cortexflow_latest_risk * 100).toFixed(1) + "%";
    }
  });

  // ── Sync from dashboard (when no user id) ──────────────────
  const DASHBOARD_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ];

  async function requestSyncFromDashboard() {
    if (!syncBtn) return;
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing…";
    const tabs = await chrome.tabs.query({});
    const dashboardTab = tabs.find((t) =>
      t.url && DASHBOARD_ORIGINS.some((o) => t.url.startsWith(o))
    );
    if (dashboardTab?.id) {
      try {
        await chrome.tabs.sendMessage(dashboardTab.id, { type: "REQUEST_SYNC" });
        await chrome.tabs.update(dashboardTab.id, { active: true });
      } catch (e) {
        // Content script may not be ready or tab not allowed
      }
    } else {
      const url = DASHBOARD_ORIGINS[0] + "/";
      await chrome.tabs.create({ url });
    }
    // Poll storage for a few seconds and refresh UI when user id appears
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const data = await chrome.storage.local.get(["cortexflow_user_id", "cortexflow_user_name"]);
      if (data.cortexflow_user_id) {
        applyUserUI(data);
        startBtn.disabled = false;
        statusTxt.textContent = "Inactive";
        break;
      }
    }
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync from dashboard";
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", requestSyncFromDashboard);
  }

  // ── Start session ────────────────────────────────────────

  startBtn.addEventListener("click", async () => {
    const uid = await getUserId();
    if (!uid) return; // abort — getUserId() already shows warning and disables button

    startBtn.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: "START_SESSION",
        payload: { userId: uid, taskType: detectedTaskType },
      },
      (res) => {
        if (res && !res.error) {
          setActive(true);
        } else {
          startBtn.disabled = false;
          const errMsg = res?.error === "no_user_id"
            ? "⚠️ Log in on CortexFlow website first"
            : `Error: ${res?.error || "unknown"}`;
          statusTxt.textContent = errMsg;
        }
      }
    );
  });

  // ── End session ──────────────────────────────────────────

  endBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "END_SESSION" }, () => {
      setActive(false);
      elapsedEl.textContent = "0:00";
      switchEl.textContent = "0";
      riskEl.textContent = "—";
    });
  });

  // ── Live refresh (poll every 2s while popup is open) ─────

  const poll = setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res && res.active) {
        elapsedEl.textContent = formatElapsed(res.elapsed);
        switchEl.textContent = res.tabSwitchCount;
      }
    });
    chrome.storage.local.get("cortexflow_latest_risk", (data) => {
      if (data.cortexflow_latest_risk != null) {
        riskEl.textContent = (data.cortexflow_latest_risk * 100).toFixed(1) + "%";
      }
    });
  }, 2000);

  // Clean up on popup close
  window.addEventListener("unload", () => clearInterval(poll));
})();
