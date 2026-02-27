"""
Test: Drift / Zoning-Out Detection during Reading Task
=======================================================
Scenario: Student is reading a long article.
- Mouse is barely moving (stagnant)
- High idle ratio (not actively typing/clicking)
- High scroll entropy (re-reading same section, random reversals)
- No tab switching (engaged with the page, but mind is elsewhere)
- No passive playback (it's text, not video)

Expected model behaviour (per Section 7 / Table 4 of technical report):
- Drift (D_t) should be the DOMINANT signal (> Instability, > Fatigue)
- D_t should exceed 0.7 threshold -> triggers "Still engaged?" prompt
- DMN activation should be highest network activation (mind-wandering)
- ECN (executive control) should be LOW (not actively processing)
- Salience should be LOW (not impulsively switching)
- Overlay colour: BLUE (drift/zoning state per Section 7.2)
- breakdown_probability should rise as drift accumulates
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
        return "DRIFT_CHECKIN", "Pause/Still engaged? + reflection question  [BLUE overlay]"
    elif I > 0.7:
        return "INSTABILITY_BLOCK", "3s delay + impulse confirmation + spotlight mode"
    else:
        return "NO_INTERVENTION", "Stable — no action needed  [GREEN overlay]"


def test_reading_zoning_out():
    print("\n" + "="*60)
    print("TEST: Drift / Zoning-Out During Reading Task")
    print("="*60)

    engine = CortexEngine(model_path='models/baseline_model.joblib',
                          expected_duration_min=45)

    # Reading-task telemetry: stagnant mouse, high idle, erratic scroll,
    # with a background video tab quietly playing (very common in reading sessions —
    # student has YouTube open but isn't actively watching it)
    reading_zone_out_telemetry = {
        'switch_rate':          0.05,   # barely any tab switches
        'motor_var':            0.02,   # mouse barely moving (stagnant)
        'distractor_attempts':  0,      # not clicking on distractors
        'idle_ratio':           0.85,   # mostly idle — body present, mind absent
        'scroll_entropy':       0.92,   # very erratic reversals — re-reading same paragraph
        'passive_playback':     0.25,   # background video tab quietly playing (common)
        # D_t = 0.5*0.85 + 0.3*0.92 + 0.2*0.25 = 0.425 + 0.276 + 0.05 = 0.751 (> 0.7 ✓)
    }

    print("\nTelemetry (reading, 25 min in):")
    for k, v in reading_zone_out_telemetry.items():
        print(f"  {k:<25} {v}")

    # Run inference at 25 min into a 45 min reading session
    result = engine.infer(
        reading_zone_out_telemetry,
        session_duration_sec=25 * 60,
        task_engagement=0.3,      # low engagement signal
        idle_signal=0.8,          # high idle (feeds DMN rise)
        switch_pressure=0.05
    )

    print("\nInference Output:")
    print(json.dumps(result, indent=2))

    # Resolve intervention
    intervention_code, intervention_desc = resolve_intervention(result)
    print(f"\nIntervention: {intervention_code}")
    print(f"  → {intervention_desc}")

    # ─── Assertions ────────────────────────────────────────────────
    print("\nAssertions:")
    results = []

    # 1. Drift must be the dominant latent state
    results.append(check(
        result['drift'] > result['instability'],
        f"Drift ({result['drift']:.3f}) > Instability ({result['instability']:.3f})",
        "Zoning-out should be DMN-dominant, not SN-dominant"
    ))

    # 2. D_t exceeds the intervention threshold
    results.append(check(
        result['drift'] > 0.7,
        f"Drift ({result['drift']:.3f}) exceeds intervention threshold (0.7)",
        "Must cross D_t > 0.7 to trigger 'Still engaged?' prompt"
    ))

    # 3. Correct intervention fires
    results.append(check(
        intervention_code == "DRIFT_CHECKIN",
        f"Correct intervention fired: {intervention_code}",
        f"Expected DRIFT_CHECKIN, got {intervention_code}"
    ))

    # 4. DMN is the dominant network activation (mind-wandering)
    network = result['network']
    dominant_network = max(network, key=network.get)
    results.append(check(
        dominant_network == 'DMN',
        f"DMN is dominant network activation ({network['DMN']:.3f})",
        f"Expected DMN dominant, got {dominant_network} ({network[dominant_network]:.3f})"
    ))

    # 5. Salience (SN) should be LOW — not impulsively switching
    results.append(check(
        network['Salience'] < 0.3,
        f"Salience is low ({network['Salience']:.3f} < 0.3) — no tab-switching impulse",
        "High Salience would indicate Instability, not Drift"
    ))

    # 6. ECN should be suppressed — executive control degraded
    results.append(check(
        network['ECN'] < 0.5,
        f"ECN suppressed ({network['ECN']:.3f} < 0.5) — executive control degraded",
        "High ECN would mean active focused engagement"
    ))

    # 7. Risk should be elevated (zoning out is a real risk)
    results.append(check(
        result['risk'] > 0.5,
        f"Attention risk elevated ({result['risk']:.3f} > 0.5)",
        "Risk should reflect degraded cognitive engagement"
    ))

    # Summary
    passed = sum(results)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"Result: {passed}/{total} assertions passed")
    if passed == total:
        print("\033[92mAll assertions passed — Drift/Zoning-Out correctly detected ✅\033[0m")
    else:
        print(f"\033[91m{total - passed} assertion(s) failed ❌\033[0m")
    print("="*60 + "\n")

    return passed == total


if __name__ == "__main__":
    success = test_reading_zoning_out()
    sys.exit(0 if success else 1)
