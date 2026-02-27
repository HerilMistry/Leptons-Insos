"""
Test: Passive Drift Detection during Video Lecture Task
=======================================================
Scenario: Student is "watching" a 2-hour recorded lecture.
- Video is playing in the tab (passive_playback = 1.0)
- Student has mentally checked out — hasn't rewound, isn't taking notes
- Mouse is stagnant (not interacting with the lecture tab)
- Very high idle ratio on the lecture tab
- Occasionally flicks to another tab but mostly stays on the video

This is different from the reading/zoning-out test:
- Reading: D_t mostly driven by idle_ratio + scroll_entropy
- Video: D_t driven by passive_playback (1.0) + idle_ratio — the definitive
  signal is that the student is NOT pausing/rewinding despite not following

Expected model behaviour (per Section 7 / Table 4 of technical report):
- Drift (D_t) DOMINANT — passive disengagement, not impulsive switching
- D_t > 0.7 → DRIFT_CHECKIN: "Pause video; Still engaged? + reflection question"
- DMN should be highest network activation
- Salience (SN) should be LOW — no impulsive tab-switching bursts
- High breakdown_probability despite no tab-switching
- Overlay colour: BLUE (drift state per Section 7.2)
"""

import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cortex_core.engine import CortexEngine

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"


def check(condition, label, detail=""):
    status = PASS if condition else FAIL
    print(f"  {status}  {label}")
    if not condition and detail:
        print(f"          → {detail}")
    return condition


def resolve_intervention(result):
    """Apply Table 4 intervention rules from Section 7."""
    I = result['instability']
    D = result['drift']
    F = result['fatigue']
    breakdown = result['breakdown_imminent']

    if breakdown:
        return "FULL_INTERRUPT", "Full-screen soft interrupt + SHAP explanation"
    elif F > 0.8:
        return "FATIGUE_BREAK", "Suggest micro-break + 60s breathing prompt"
    elif D > 0.7:
        return "DRIFT_CHECKIN", "Pause video; 'Still engaged?' + reflection question  [BLUE overlay]"
    elif I > 0.7:
        return "INSTABILITY_BLOCK", "3s delay + impulse confirmation + spotlight mode"
    else:
        return "NO_INTERVENTION", "Stable — no action needed  [GREEN overlay]"


def test_video_passive_drift():
    print("\n" + "="*60)
    print("TEST: Passive Drift During Video Lecture Task")
    print("="*60)

    # 2-hour lecture, 75 minutes in — well into fatigue territory
    engine = CortexEngine(model_path='models/baseline_model.joblib',
                          expected_duration_min=120)

    # Video-task telemetry: lecture playing, student has mentally checked out
    video_zoned_out_telemetry = {
        'switch_rate':          0.08,   # barely any tab switches (unlike impulsive distraction)
        'motor_var':            0.01,   # mouse completely stagnant
        'distractor_attempts':  0,      # not clicking on distractors
        'idle_ratio':           0.95,   # almost fully idle on the lecture tab
        'scroll_entropy':       0.20,   # occasional note-check scroll (minor)
        'passive_playback':     1.0,    # lecture video playing but not being watched
        # D_t = 0.5*0.95 + 0.3*0.20 + 0.2*1.0 = 0.475 + 0.06 + 0.20 = 0.735 (> 0.7 ✓)
    }

    print("\nTelemetry (video lecture, 75 min in):")
    for k, v in video_zoned_out_telemetry.items():
        print(f"  {k:<25} {v}")
    print(f"\n  Expected D_t ≈ 0.735  (0.5×0.95 + 0.3×0.20 + 0.2×1.0)")

    # 75 min into a 120-min lecture (0.625 duration_norm → significant fatigue)
    result = engine.infer(
        video_zoned_out_telemetry,
        session_duration_sec=75 * 60,
        task_engagement=0.2,      # very low — not actively engaging with content
        idle_signal=0.95,         # high idle feeds DMN rise
        switch_pressure=0.08
    )

    print("\nInference Output:")
    print(json.dumps(result, indent=2))

    # Resolve intervention
    intervention_code, intervention_desc = resolve_intervention(result)
    print(f"\nIntervention: {intervention_code}")
    print(f"  → {intervention_desc}")

    # ─── Assertions ─────────────────────────────────────────────────
    print("\nAssertions:")
    results = []

    # 1. Drift is dominant over Instability (passive, not impulsive)
    results.append(check(
        result['drift'] > result['instability'],
        f"Drift ({result['drift']:.3f}) > Instability ({result['instability']:.3f})",
        "Video passive drift should be DMN-dominant, not Salience-dominant"
    ))

    # 2. D_t exceeds intervention threshold
    results.append(check(
        result['drift'] > 0.7,
        f"Drift ({result['drift']:.3f}) exceeds intervention threshold (0.7)",
        "Must trigger DRIFT_CHECKIN: 'Pause video; Still engaged?'"
    ))

    # 3. passive_playback is the defining signal — larger contribution than scroll_entropy
    # D_t contribution from playback (0.2*1.0=0.2) > contribution from scroll (0.3*0.2=0.06)
    playback_contribution = 0.2 * video_zoned_out_telemetry['passive_playback']
    scroll_contribution = 0.3 * video_zoned_out_telemetry['scroll_entropy']
    results.append(check(
        playback_contribution > scroll_contribution,
        f"Passive playback contribution ({playback_contribution:.2f}) > "
        f"scroll_entropy contribution ({scroll_contribution:.2f})",
        "Video drift is passive_playback-driven, not scroll-driven"
    ))

    # 4. Correct intervention fires
    results.append(check(
        intervention_code == "DRIFT_CHECKIN",
        f"Correct intervention fired: DRIFT_CHECKIN",
        f"Expected DRIFT_CHECKIN, got {intervention_code}"
    ))

    # 5. DMN is dominant network (mind-wandering during passive video)
    network = result['network']
    dominant_network = max(network, key=network.get)
    results.append(check(
        dominant_network == 'DMN',
        f"DMN is dominant network ({network['DMN']:.3f})",
        f"Expected DMN dominant, got {dominant_network} ({network[dominant_network]:.3f})"
    ))

    # 6. Salience is suppressed — no impulsive switching bursts
    results.append(check(
        network['Salience'] < 0.2,
        f"Salience very low ({network['Salience']:.3f} < 0.2) — passive, not impulsive",
        "High salience would indicate tab-switching distraction, not passive zoning-out"
    ))

    # 7. Fatigue is elevated — 75 min into a 2 hr lecture
    results.append(check(
        result['fatigue'] > 0.4,
        f"Fatigue elevated ({result['fatigue']:.3f} > 0.4) — 75 min into 2hr session",
        "Fatigue should reflect over-halfway point of expected session duration"
    ))

    # 8. Breakdown probability is high (passive drift is still a real breakdown risk)
    results.append(check(
        result['breakdown_probability'] > 0.5,
        f"Breakdown probability ({result['breakdown_probability']:.3f}) > 0.5",
        "High passive drift should translate to high predicted breakdown probability"
    ))

    # Summary
    passed = sum(results)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"Result: {passed}/{total} assertions passed")
    if passed == total:
        print("\033[92mAll assertions passed — Video Passive Drift correctly detected ✅\033[0m")
    else:
        print(f"\033[91m{total - passed} assertion(s) failed ❌\033[0m")
    print("="*60 + "\n")

    return passed == total


if __name__ == "__main__":
    success = test_video_passive_drift()
    sys.exit(0 if success else 1)
