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

  // ── NLP state ────────────────────────────────────────────
  let detectedTaskType = "general";
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
      detectedTaskType = "general";
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

  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
    if (res && res.active) {
      setActive(true);
      elapsedEl.textContent = formatElapsed(res.elapsed);
      switchEl.textContent = res.tabSwitchCount;
    }
  });

  // Load latest risk from storage
  chrome.storage.local.get(["cortexflow_latest_risk", "cortexflow_task_type"], (data) => {
    if (data.cortexflow_latest_risk != null) {
      riskEl.textContent = (data.cortexflow_latest_risk * 100).toFixed(1) + "%";
    }
    if (data.cortexflow_task_type) {
      detectedTaskType = data.cortexflow_task_type;
      showTaskTag(detectedTaskType);
    }
  });

  // ── Start session ────────────────────────────────────────

  startBtn.addEventListener("click", () => {
    startBtn.disabled = true;
    chrome.runtime.sendMessage(
      { type: "START_SESSION", taskType: detectedTaskType },
      (res) => {
        if (res && !res.error) {
          setActive(true);
        } else {
          startBtn.disabled = false;
          const errMsg = res?.error === "no_user_id"
            ? "No user ID found. Log in on the CortexFlow website first."
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
