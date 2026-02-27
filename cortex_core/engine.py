"""
CortexFlow Inference Engine
===========================
Single entry point for backend integration.

Usage (Django view example):
    from cortex_core.engine import CortexEngine

    engine = CortexEngine(model_path='models/baseline_model.joblib')

    # On each telemetry POST (every 5s):
    result = engine.infer(telemetry, session_duration_sec, previous_state)

    # result matches Section 6.5 API response spec exactly.
"""

from cortex_core.logic import StateEngine
from cortex_core.predictor import CortexPredictor, BayesianAdapter


class CortexEngine:
    """
    Unified stateful inference engine.

    Wraps StateEngine + CortexPredictor + BayesianAdapter into a single
    object the backend can keep alive per user session.

    Parameters
    ----------
    model_path : str
        Path to the trained .joblib model file.
    expected_duration_min : int
        Expected session length in minutes (used for fatigue normalisation).
    breakdown_threshold : float
        θ in the drift-diffusion model (default 1.0, tunable per user).
    """

    def __init__(self, model_path='models/baseline_model.joblib',
                 expected_duration_min=60, breakdown_threshold=1.0):
        self.state_engine = StateEngine(
            expected_duration_min=expected_duration_min,
            theta=breakdown_threshold
        )
        self.predictor = CortexPredictor(model_path=model_path)
        self.adapter = BayesianAdapter(self.predictor)
        self._previous_state = None

    def _validate_telemetry(self, telemetry: dict) -> dict:
        """
        Validates and clamps telemetry values to safe ranges.
        Missing keys default to 0. Prevents out-of-range inputs from
        producing garbage feature vectors.
        """
        defaults = {
            'switch_rate': 0.0, 'motor_var': 0.0,
            'distractor_attempts': 0, 'idle_ratio': 0.0,
            'scroll_entropy': 0.0, 'passive_playback': 0.0,
        }
        validated = {k: telemetry.get(k, v) for k, v in defaults.items()}

        # Clamp to physically meaningful ranges
        validated['switch_rate']          = max(0.0, min(float(validated['switch_rate']), 10.0))
        validated['motor_var']            = max(0.0, min(float(validated['motor_var']), 5.0))
        validated['distractor_attempts']  = max(0,   min(int(validated['distractor_attempts']), 20))
        validated['idle_ratio']           = max(0.0, min(float(validated['idle_ratio']), 1.0))
        validated['scroll_entropy']       = max(0.0, min(float(validated['scroll_entropy']), 1.0))
        validated['passive_playback']     = max(0.0, min(float(validated['passive_playback']), 1.0))
        return validated

    def infer(self, telemetry: dict, session_duration_sec: float,
              task_engagement: float = 1.0, idle_signal: float = 0.0,
              switch_pressure: float = 0.0) -> dict:
        """
        Run a full inference cycle and return the Section 6.5 API response.

        Parameters
        ----------
        telemetry : dict
            Raw behavioural telemetry from the Chrome extension. Keys:
                switch_rate          – app/tab switches per minute
                motor_var            – mouse motor variability (maxdev proxy)
                distractor_attempts  – distractor site click attempts
                idle_ratio           – fraction of window spent idle
                scroll_entropy       – randomness of scroll behaviour
                passive_playback     – fraction of time in passive media
        session_duration_sec : float
            Elapsed session time in seconds.
        task_engagement : float
            Task engagement signal E_t [0–1]. Default 1.0.
        idle_signal : float
            Idle signal for DMN update [0–1]. Default 0.0.
        switch_pressure : float
            Switch pressure signal for SN computation. Default 0.0.

        Returns
        -------
        dict
            Inference response matching Section 6.5 of technical report:
            {
                "instability": float,       # I_t — SN dominance proxy
                "drift": float,             # D_t — DMN dominance proxy
                "fatigue": float,           # F_t — executive depletion
                "risk": float,              # Global attention risk [0-1]
                "accumulated_conflict": float, # A_t — drift-diffusion accumulator
                "breakdown_imminent": bool,  # True if A_t > theta
                "attribution": dict,         # SHAP-style feature contributions
                "network": {                 # Relative network activations
                    "ECN": float,
                    "DMN": float,
                    "Salience": float,
                    "Load": float
                }
            }
        """
        # Validate and clamp telemetry before processing
        telemetry = self._validate_telemetry(telemetry)

        # 1. Update latent state variables from telemetry
        self.state_engine.update_latent_states(telemetry, session_duration_sec)

        # 2. Update temporal network dynamics
        self.state_engine.update_temporal_dynamics(
            E_t=task_engagement,
            Idle_t=idle_signal,
            Task_t=task_engagement,
            SwitchPressure_t=switch_pressure
        )

        # 3. Run drift-diffusion breakdown detector
        is_breakdown, accumulated_conflict = self.state_engine.detect_breakdown()

        # 4. Build current state snapshot
        current_state = {
            'I_t': float(self.state_engine.I_t),
            'D_t': float(self.state_engine.D_t),
            'F_t': float(self.state_engine.F_t),
            'ECN_t': float(self.state_engine.ECN_t),
            'A_t': float(self.state_engine.A_t),
        }

        # 5. Construct feature vector from raw telemetry (matches training features)
        x_vec = self.predictor.construct_feature_vector(
            telemetry,
            session_duration_sec=session_duration_sec,
            expected_duration_sec=float(self.state_engine.expected_duration),
        )

        # 6. Predict breakdown probability (Personalised)
        breakdown_prob = float(self.adapter.predict_personalized(x_vec))

        # 7. SHAP-style feature attribution — raw signal names
        feature_names = ['sw', 'mv', 'dist', 'idle', 'scroll', 'pp', 'dur', 'sw_strain', 'idle_strain', 'panic', 'lethargy', 'sw_std', 'idle_std',
                         'sw_lag1', 'mv_lag1', 'dist_lag1', 'idle_lag1', 'scroll_lag1', 'pp_lag1', 'dur_lag1', 'sw_strain_lag1', 'idle_strain_lag1', 'panic_lag1', 'lethargy_lag1', 'sw_std_lag1', 'idle_std_lag1',
                         'sw_lag2', 'mv_lag2', 'dist_lag2', 'idle_lag2', 'scroll_lag2', 'pp_lag2', 'dur_lag2', 'sw_strain_lag2', 'idle_strain_lag2', 'panic_lag2', 'lethargy_lag2', 'sw_std_lag2', 'idle_std_lag2']
        raw_attribution = self.predictor.explain_prediction(x_vec, feature_names)

        # Return top 3 contributors (matching API spec style)
        top_attribution = dict(list(raw_attribution.items())[:3])

        # 8. Network activation mapping
        network = self.state_engine.get_network_activations()

        # 9. Global attention risk
        risk = float(self.state_engine.get_attention_risk())

        # Advance temporal window
        self._previous_state = current_state

        return {
            'instability': round(current_state['I_t'], 4),
            'drift':       round(current_state['D_t'], 4),
            'fatigue':     round(current_state['F_t'], 4),
            'risk':        round(risk, 4),
            'accumulated_conflict': round(float(accumulated_conflict), 4),
            'breakdown_imminent': bool(is_breakdown),
            'breakdown_probability': round(breakdown_prob, 4),
            'attribution': {k: round(v, 4) for k, v in top_attribution.items()},
            'network': {
                'ECN':      round(float(network['ECN']), 4),
                'DMN':      round(float(network['DMN']), 4),
                'Salience': round(float(network['Salience']), 4),
                'Load':     round(float(network['Load']), 4),
            }
        }

    def record_feedback(self, actual_breakdown: int):
        """
        Feed ground-truth outcome back into the Bayesian adapter.
        Call this after confirming whether a breakdown actually occurred.

        Parameters
        ----------
        actual_breakdown : int
            1 if breakdown was confirmed, 0 if not.
        """
        if self._previous_state is not None:
            x_vec = self.predictor.construct_feature_vector(self._previous_state)
            self.adapter.record_feedback(x_vec, actual_breakdown)

    def reset_session(self):
        """Resets the state engine and temporal context for a new session."""
        self.state_engine.reset()
        self.predictor.reset_history()
        self._previous_state = None
