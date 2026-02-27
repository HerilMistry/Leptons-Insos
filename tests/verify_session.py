import numpy as np
import sys
import os
import json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cortex_core.engine import CortexEngine

def simulate_session():
    print("--- Starting Advanced CortexFlow Verification ---")
    
    # Use the unified engine
    engine = CortexEngine(model_path='models/baseline_model.joblib')

    # 1. Simulate Focus Block
    print("\nPhase 1: Focused Work")
    for i in range(3):
        telemetry = {
            'switch_rate': 0.1, 
            'motor_var': 0.05, 
            'distractor_attempts': 0,
            'idle_ratio': 0.05, 
            'scroll_entropy': 0.1,
            'passive_playback': 0.0
        }
        
        result = engine.infer(telemetry, session_duration_sec=i * 5)
        print(f"t={i*5}s | Risk: {result['risk']:.2f} | B-Prob: {result['breakdown_probability']:.2f} | Imminent: {result['breakdown_imminent']}")

        # User feedback: everything is stable
        engine.adapter.record_feedback(engine.predictor.construct_feature_vector(telemetry, i*5), 0)

    # 2. Simulate Distraction / High Conflict
    print("\nPhase 2: High Conflict (Tab Switching)")
    for i in range(3, 8):
        telemetry = {
            'switch_rate': 1.5, 
            'motor_var': 1.2, 
            'distractor_attempts': 3,
            'idle_ratio': 0.1,
            'scroll_entropy': 0.1,
            'passive_playback': 0.0
        }
        
        result = engine.infer(telemetry, session_duration_sec=i * 5, switch_pressure=1.5)
        print(f"t={i*5}s | Risk: {result['risk']:.2f} | B-Prob: {result['breakdown_probability']:.2f} | Imminent: {result['breakdown_imminent']}")

        # User feedback: breakdown occurred if imminent
        engine.adapter.record_feedback(engine.predictor.construct_feature_vector(telemetry, i*5), 1 if result['breakdown_imminent'] else 0)

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    simulate_session()
