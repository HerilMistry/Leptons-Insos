// ============================================================
// CortexFlow — Popup Script (v2)
// Controls session start/end, live stats, risk bar, timer.
// ============================================================

(() => {
  "use strict";

  // ── DOM refs ─────────────────────────────────────────────
  const primaryBtn  = document.getElementById("primary-btn");
  const dangerBtn   = document.getElementById("danger-btn");
  const statusDot   = document.getElementById("status-dot");
  const statsRow    = document.getElementById("stats-row");
  const riskBarWrap = document.getElementById("risk-bar-wrapper");
  const riskBarFill = document.getElementById("risk-bar-fill");
  const timerEl     = document.getElementById("session-timer");
  const timerDisp   = document.getElementById("timer-display");
  const dashLink    = document.getElementById("cf-dashboard-link");
  const statRisk    = document.getElementById("stat-risk");
  const statDrift   = document.getElementById("stat-drift");
  const statInstab  = document.getElementById("stat-instability");

  // ── State ────────────────────────────────────────────────
  let selectedTaskType = "general";
  let timerInterval    = null;
  let sessionStartTime = null;

  // ── Dashboard link ───────────────────────────────────────
  const dashboardUrl = (typeof CF_CONFIG !== "undefined" && CF_CONFIG.DASHBOARD_URL) || "http://localhost:5173";
  dashLink.href = dashboardUrl;
  dashLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: dashboardUrl });
  });

  // ── Task type buttons ────────────────────────────────────

  function selectTask(task) {
    selectedTaskType = task;
    document.querySelectorAll(".task-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.task === task);
    });
  }

  document.querySelectorAll(".task-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectTask(btn.dataset.task));
  });
  selectTask("general");

  // ── Timer helpers ────────────────────────────────────────

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (sessionStartTime) {
        timerDisp.textContent = formatTime(Date.now() - sessionStartTime);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerDisp.textContent = "00:00";
    sessionStartTime = null;
  }

  // ── UI state toggle ──────────────────────────────────────

  function setSessionActive(active) {
    if (active) {
      statusDot.classList.add("active");
      primaryBtn.style.display = "none";
      dangerBtn.classList.remove("hidden");
      statsRow.classList.remove("hidden");
      riskBarWrap.classList.remove("hidden");
      timerEl.classList.remove("hidden");
      document.querySelectorAll(".task-btn").forEach((b) => (b.disabled = true));
    } else {
      statusDot.classList.remove("active");
      primaryBtn.style.display = "";
      primaryBtn.disabled = false;
      dangerBtn.classList.add("hidden");
      statsRow.classList.add("hidden");
      riskBarWrap.classList.add("hidden");
      timerEl.classList.add("hidden");
      document.querySelectorAll(".task-btn").forEach((b) => (b.disabled = false));
      stopTimer();
    }
  }

  // ── Update stats from inference data ─────────────────────

  function updateStats(data) {
    if (!data) return;
    var risk   = data.risk || 0;
    var drift  = data.drift || 0;
    var instab = data.instability || 0;

    statRisk.textContent   = (risk * 100).toFixed(0) + "%";
    statDrift.textContent  = (drift * 100).toFixed(0) + "%";
    statInstab.textContent = (instab * 100).toFixed(0) + "%";

    // Risk bar
    var pct = Math.min(100, Math.round(risk * 100));
    riskBarFill.style.width = pct + "%";
    if (risk >= 0.70) {
      riskBarFill.style.background = "#ef4444";
    } else if (risk >= 0.45) {
      riskBarFill.style.background = "#f59e0b";
    } else {
      riskBarFill.style.background = "#22c55e";
    }
  }

  // ── User ID ──────────────────────────────────────────────

  async function getUserId() {
    const data = await chrome.storage.local.get(["cortexflow_user_id"]);
    return data.cortexflow_user_id || null;
  }

  // ── Check status on popup open ───────────────────────────

  (async () => {
    const uid = await getUserId();
    if (!uid) {
      primaryBtn.disabled = true;
      primaryBtn.textContent = "Log in on website first";
    }

    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res && res.active) {
        setSessionActive(true);
        sessionStartTime = Date.now() - (res.elapsed || 0);
        startTimer();
      }
    });
  })();

  // ── Start session ────────────────────────────────────────

  primaryBtn.addEventListener("click", async () => {
    const uid = await getUserId();
    if (!uid) return;

    primaryBtn.disabled = true;
    chrome.runtime.sendMessage(
      { type: "START_SESSION", payload: { userId: uid, taskType: selectedTaskType } },
      (res) => {
        if (res && !res.error) {
          setSessionActive(true);
          sessionStartTime = Date.now();
          startTimer();
        } else {
          primaryBtn.disabled = false;
        }
      }
    );
  });

  // ── End session ──────────────────────────────────────────

  dangerBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "END_SESSION" }, () => {
      setSessionActive(false);
      statRisk.textContent   = "--";
      statDrift.textContent  = "--";
      statInstab.textContent = "--";
      riskBarFill.style.width = "0%";
    });
  });

  // ── Listen for live inference results ────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "INFERENCE_RESULT" && msg.payload) {
      updateStats(msg.payload);
    }
  });

  // ── Poll for status while popup is open ──────────────────

  const poll = setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res && res.active && sessionStartTime) {
        timerDisp.textContent = formatTime(Date.now() - sessionStartTime);
      }
    });
    // Also poll latest risk from storage
    chrome.storage.local.get("cortexflow_latest_risk", (data) => {
      if (data.cortexflow_latest_risk != null && statsRow && !statsRow.classList.contains("hidden")) {
        var risk = data.cortexflow_latest_risk;
        statRisk.textContent = (risk * 100).toFixed(0) + "%";
        var pct = Math.min(100, Math.round(risk * 100));
        riskBarFill.style.width = pct + "%";
        if (risk >= 0.70)      riskBarFill.style.background = "#ef4444";
        else if (risk >= 0.45) riskBarFill.style.background = "#f59e0b";
        else                   riskBarFill.style.background = "#22c55e";
      }
    });
  }, 2000);

  // Clean up on popup close
  window.addEventListener("unload", () => clearInterval(poll));
})();
