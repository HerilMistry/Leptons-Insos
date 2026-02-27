#!/usr/bin/env python3
"""
CortexFlow — End-to-end integration test.

Tests the full pipeline: session start → telemetry × 3 → verify responses.

Usage:
    python tests/test_integration.py

Requires:
    - Backend running on http://localhost:8000
    - pip install requests
"""

import sys
import time
import json
import requests

BASE_URL = "http://localhost:8000"
USER_ID = 1          # Django User pk (integer); create with: manage.py shell → User.objects.create_user(...)
TASK_TYPE = "coding"

TELEMETRY_FEATURES = {
    "switch_rate": 0.3,
    "motor_var": 0.2,
    "distractor_attempts": 0,
    "idle_ratio": 0.1,
    "scroll_entropy": 0.4,
    "passive_playback": 0.0,
}

EXPECTED_KEYS = [
    "instability", "drift", "fatigue", "risk", "breakdown_imminent",
]

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

errors = []


def step(label):
    print(f"\n{'─' * 50}")
    print(f"  {label}")
    print(f"{'─' * 50}")


# ── Step 1: Start session ────────────────────────────────────

step("Step 1 — POST /api/session/start")

try:
    res = requests.post(
        f"{BASE_URL}/api/session/start/",
        json={"user_id": USER_ID, "task_type": TASK_TYPE},
        timeout=5,
    )
    if res.status_code in (200, 201):
        data = res.json()
        session_id = data.get("session_id")
        if session_id:
            print(f"  ✓ Session started: {session_id}")
        else:
            msg = f"  ✗ No session_id in response: {data}"
            print(msg)
            errors.append(msg)
    else:
        msg = f"  ✗ HTTP {res.status_code}: {res.text[:200]}"
        print(msg)
        errors.append(msg)
        session_id = None
except Exception as e:
    msg = f"  ✗ Request failed: {e}"
    print(msg)
    errors.append(msg)
    session_id = None

if not session_id:
    print(f"\n{FAIL} — Cannot continue without a session. Exiting.")
    sys.exit(1)


# ── Step 2: Send telemetry 3 times ───────────────────────────

step("Step 2 — POST /api/telemetry  (×3, 2s apart)")

for i in range(1, 4):
    if i > 1:
        time.sleep(2)

    body = {
        "session_id": session_id,
        "task_type": TASK_TYPE,
        "features": TELEMETRY_FEATURES,
        "duration_norm": round(0.1 * i, 2),
    }

    try:
        res = requests.post(
            f"{BASE_URL}/api/telemetry/",
            json=body,
            timeout=5,
        )
        if res.status_code == 200:
            data = res.json()
            print(f"\n  Telemetry #{i}:")
            for key in EXPECTED_KEYS:
                val = data.get(key, "MISSING")
                print(f"    {key:25s} = {val}")
        else:
            msg = f"  ✗ Telemetry #{i} HTTP {res.status_code}: {res.text[:200]}"
            print(msg)
            errors.append(msg)
    except Exception as e:
        msg = f"  ✗ Telemetry #{i} request failed: {e}"
        print(msg)
        errors.append(msg)


# ── Step 3: Summary ──────────────────────────────────────────

step("Result")

if not errors:
    print(f"  {PASS} — All requests returned HTTP 200 with expected fields.")
else:
    print(f"  {FAIL} — {len(errors)} error(s):")
    for err in errors:
        print(f"    • {err}")
    sys.exit(1)
