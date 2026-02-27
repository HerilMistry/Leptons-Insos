import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
import os

class CortexPredictor:
    def __init__(self, model_path=None):
        self.model = LogisticRegression()
        self.is_trained = False
        self.model_path = model_path
        self._history = []  # Buffer for temporal context
        self._cum_sw = 0.0
        self._cum_idle = 0.0
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)

    def reset_history(self):
        """Resets the temporal context buffer and accumulators."""
        self._history = []
        self._cum_sw = 0.0
        self._cum_idle = 0.0

    def construct_feature_vector(self, telemetry: dict,
                                  session_duration_sec: float = 0.0,
                                  expected_duration_sec: float = 3600.0,
                                  previous_state=None):
        """
        Builds a 39-dimensional feature vector [Current, T-1, T-2].
        Each 13-dim block: [sw, mv, dist, idle, scroll, pp, dur, c_sw, c_idle, panic, lethargy, sw_std, idle_std]
        """
        sw   = float(telemetry.get('switch_rate', 0))
        mv   = float(telemetry.get('motor_var', 0))
        dist = float(telemetry.get('distractor_attempts', 0))
        ir   = float(telemetry.get('idle_ratio', 0))
        se   = float(telemetry.get('scroll_entropy', 0))
        pp   = float(telemetry.get('passive_playback', 0))
        dur  = min(session_duration_sec / max(expected_duration_sec, 1.0), 1.0)
        
        # Accumulators
        norm_sw = min(sw / 3.0, 1.0)
        self._cum_sw   += norm_sw
        self._cum_idle += ir

        panic_scroll = norm_sw * np.clip(se, 0, 1)
        lethargy     = np.clip(pp, 0, 1) * (1.0 - norm_sw)

        # Variability features (standard deviation over history)
        if len(self._history) >= 2:
            recent_sw   = [norm_sw, self._history[-1][0], self._history[-2][0]]
            recent_idle = [ir, self._history[-1][3], self._history[-2][3]]
            sw_std      = float(np.std(recent_sw))
            idle_std    = float(np.std(recent_idle))
        else:
            sw_std, idle_std = 0.0, 0.0

        current_feat = [
            norm_sw, min(mv / 2.0, 1.0), min(dist / 5.0, 1.0),
            np.clip(ir, 0, 1), np.clip(se, 0, 1), np.clip(pp, 0, 1), dur,
            min(self._cum_sw / 15.0, 1.0), min(self._cum_idle / 15.0, 1.0),
            panic_scroll, lethargy, sw_std, idle_std
        ]

        # Construct 39-dim vector [Current, T-1, T-2]
        full_feat = list(current_feat)
        for lag in range(1, 3):
            if len(self._history) >= lag:
                full_feat.extend(self._history[-lag])
            else:
                full_feat.extend([0.0] * 13)

        # Update history
        self._history.append(current_feat)
        if len(self._history) > 10:
            self._history = self._history[-5:]

        return np.array(full_feat).reshape(1, -1)

    def predict_breakdown_prob(self, feature_vector):
        if not self.is_trained:
            # Baseline weights from technical report/research
            weights = np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])
            return 1 / (1 + np.exp(-np.dot(weights, feature_vector.flatten())))
        return self.model.predict_proba(feature_vector)[0][1]

    def explain_prediction(self, feature_vector, feature_names=None):
        """
        Implements SHAP-style feature attribution (Section 5.4).
        Works with both Logistic Regression (coef_) and XGBoost (feature_importances_).
        """
        if feature_names is None:
            feature_names = ['Instability', 'Drift', 'Fatigue', 'ECN',
                             'Conflict(A_t)', 'delta_I', 'delta_D']

        if not self.is_trained:
            # Baseline weights from technical report
            weights = np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])
            contributions = feature_vector.flatten() * weights
        else:
            # Support both LR (coef_) and XGBoost (feature_importances_)
            if hasattr(self.model, 'coef_'):
                weights = self.model.coef_[0]
                contributions = feature_vector.flatten() * weights
            elif hasattr(self.model, 'feature_importances_'):
                # XGBoost: use feature importance × feature value as contribution proxy
                contributions = feature_vector.flatten() * self.model.feature_importances_
            else:
                contributions = feature_vector.flatten()

        explanation = sorted(
            zip(feature_names, contributions),
            key=lambda x: abs(x[1]),
            reverse=True
        )

        return {name: float(val) for name, val in explanation}


    def train(self, X_train, y_train):
        self.model.fit(X_train, y_train)
        self.is_trained = True
        if self.model_path:
            self.save_model(self.model_path)

    def save_model(self, path):
        joblib.dump(self.model, path)
        print(f"Model saved to {path}")

    def load_model(self, path):
        self.model = joblib.load(path)
        self.is_trained = True
        print(f"Model loaded from {path}")

class BayesianAdapter:
    """
    Implements personalized adaptation (Section 5.3).
    Adapts the decision logic based on individual user behavior.
    """
    def __init__(self, baseline_predictor, alpha=0.2):
        self.predictor = baseline_predictor
        self.alpha = alpha                   # personalization learning rate
        self.user_history = []              # List of (X, y_actual)
        self._personal_model = LogisticRegression()

    def record_feedback(self, X, actual_breakdown):
        """
        Record whether a breakdown actually occurred for a given state.
        Auto-adapts once 5+ interactions are recorded.
        """
        self.user_history.append((X.flatten(), actual_breakdown))
        if len(self.user_history) >= 5:
            self.adapt_model()

    def adapt_model(self):
        """
        Fits a local LogisticRegression on user-specific interactions to
        individualize the breakdown threshold.
        """
        X = np.array([h[0] for h in self.user_history])
        y = np.array([h[1] for h in self.user_history])

        if len(np.unique(y)) < 2:
            return # Need local samples of both focus and breakdown

        self._personal_model.fit(X, y)
        print(f"Adapting model based on {len(self.user_history)} user interactions...")
        self.is_personalized = True
        print("Model adapted successfully.")

    def predict_personalized(self, X):
        """
        Blended prediction: base XGBoost + local personalized LR model.
        """
        base_prob = float(self.predictor.predict_breakdown_prob(X))
        if not hasattr(self, 'is_personalized'):
            return base_prob
        
        personal_prob = float(self._personal_model.predict_proba(X)[0][1])
        # Blend: trust the personal model 30% after it adapts
        return (1 - self.alpha) * base_prob + self.alpha * personal_prob

