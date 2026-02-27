import numpy as np
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cortex_core.logic import StateEngine
from cortex_core.predictor import CortexPredictor, BayesianAdapter

def simulate_session():
    print("--- Starting Advanced CortexFlow Verification ---")
    engine = StateEngine()
    predictor = CortexPredictor(model_path='models/baseline_model.joblib')
    adapter = BayesianAdapter(predictor)

    prev_state = None  # Track previous state for delta_I, delta_D computation

    # 1. Simulate Focus Block
    print("\nPhase 1: Focused Work")
    for i in range(3):
        telemetry = {'switch_rate': 0.1, 'motor_var': 0.05, 'distractor_attempts': 0,
                     'idle_ratio': 0.05, 'task_eng': 1.0, 'is_idle': 0}
        engine.update_latent_states(telemetry, i * 5)
        engine.update_temporal_dynamics(1.0, 0, 1, 0.1)
        is_breakdown, A_t = engine.detect_breakdown()

        state = {'I_t': engine.I_t, 'D_t': engine.D_t, 'F_t': engine.F_t,
                 'ECN_t': engine.ECN_t, 'A_t': engine.A_t}
        x_vec = predictor.construct_feature_vector(state, previous_state=prev_state)
        prob = predictor.predict_breakdown_prob(x_vec)

        print(f"t={i*5}s | Risk: {engine.get_attention_risk():.2f} | B-Prob: {prob:.2f} | Breakdown: {is_breakdown}")

        # User feedback: No breakdown occurred (correct)
        adapter.record_feedback(x_vec, 0)
        prev_state = state  # advance temporal window

    # 2. Simulate Distraction / High Conflict
    print("\nPhase 2: High Conflict (Tab Switching)")
    for i in range(3, 8):
        telemetry = {'switch_rate': 1.5, 'motor_var': 1.2, 'distractor_attempts': 3,
                     'idle_ratio': 0.1, 'task_eng': 0.5, 'is_idle': 0}
        engine.update_latent_states(telemetry, i * 5)
        engine.update_temporal_dynamics(0.5, 0, 1, 1.5)
        is_breakdown, A_t = engine.detect_breakdown()

        state = {'I_t': engine.I_t, 'D_t': engine.D_t, 'F_t': engine.F_t,
                 'ECN_t': engine.ECN_t, 'A_t': engine.A_t}
        x_vec = predictor.construct_feature_vector(state, previous_state=prev_state)
        prob = predictor.predict_breakdown_prob(x_vec)

        print(f"t={i*5}s | Risk: {engine.get_attention_risk():.2f} | B-Prob: {prob:.2f} | Breakdown: {is_breakdown}")

        if prob > 0.3:  # Lowered threshold so SHAP attribution is shown in verification
            explanation = predictor.explain_prediction(x_vec)
            top_feature = list(explanation.keys())[0]
            top_val = explanation[top_feature]
            print(f"  [EXPLAIN]: Primary risk factor → {top_feature} (contribution: {top_val:+.3f})")

        # User feedback: distracted if breakdown detected
        adapter.record_feedback(x_vec, 1 if is_breakdown else 0)
        prev_state = state  # advance temporal window

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    simulate_session()
