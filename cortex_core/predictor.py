import numpy as np
from sklearn.linear_model import LogisticRegression
import joblib
import os

class CortexPredictor:
    def __init__(self, model_path=None):
        self.model = LogisticRegression()
        self.is_trained = False
        self.model_path = model_path
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)

    def construct_feature_vector(self, telemetry: dict,
                                  session_duration_sec: float = 0.0,
                                  expected_duration_sec: float = 3600.0,
                                  previous_state=None):
        """
        Builds the 7-feature raw telemetry vector fed to the ML model.

        Features match exactly what was used during training (preprocess.py):
        [switch_rate_norm, motor_var_norm, distractor_norm, idle_ratio,
         scroll_entropy, passive_playback, duration_norm]

        All values normalised to [0,1]. previous_state kept for API
        compatibility with BayesianAdapter but not used (delta signals
        are captured implicitly by the session_duration progression).
        """
        sw       = float(telemetry.get('switch_rate', 0))
        mv       = float(telemetry.get('motor_var', 0))
        dist     = float(telemetry.get('distractor_attempts', 0))
        ir       = float(telemetry.get('idle_ratio', 0))
        se       = float(telemetry.get('scroll_entropy', 0))
        pp       = float(telemetry.get('passive_playback', 0))
        dur_norm = min(session_duration_sec / max(expected_duration_sec, 1.0), 1.0)

        feat = np.array([
            min(sw   / 3.0, 1.0),   # switch_rate_norm
            min(mv   / 2.0, 1.0),   # motor_var_norm
            min(dist / 5.0, 1.0),   # distractor_norm
            np.clip(ir, 0.0, 1.0),  # idle_ratio
            np.clip(se, 0.0, 1.0),  # scroll_entropy
            np.clip(pp, 0.0, 1.0),  # passive_playback
            dur_norm,               # session_duration_norm
        ])
        return feat.reshape(1, -1)

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
    Maintains its own internal LogisticRegression for online weight updates —
    works regardless of whether the base model is LR or XGBoost.
    """
    def __init__(self, baseline_predictor, prior_variance=0.1, alpha=0.2):
        self.predictor = baseline_predictor
        self.prior_variance = prior_variance
        self.alpha = alpha                   # personalization learning rate
        self.user_history = []              # List of (X, y_actual)
        self._personal_model = None         # Internal LR for user-specific weights
        self._baseline_weights = np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])

    def record_feedback(self, X, actual_breakdown):
        """
        Record whether a breakdown actually occurred for a given state.
        Auto-adapts once 5+ interactions are recorded.
        """
        self.user_history.append((X, actual_breakdown))
        if len(self.user_history) >= 5:
            self.adapt_model()

    def adapt_model(self):
        """
        Bayesian-inspired update using the user's empirical breakdown history.
        Fits a personal LR on user data, then blends its weights with the baseline.
        Works with both LR and XGBoost base models.
        """
        print(f"Adapting model based on {len(self.user_history)} user interactions...")

        X_user = np.array([h[0].flatten() for h in self.user_history])
        y_user = np.array([h[1] for h in self.user_history])

        if len(np.unique(y_user)) > 1:
            # Fit a personal model on user-specific history
            user_model = LogisticRegression(C=1.0, max_iter=500)
            user_model.fit(X_user, y_user)
            user_weights = user_model.coef_[0]

            # Get baseline weights — from coef_ if LR, else use defaults
            if hasattr(self.predictor.model, 'coef_') and self.predictor.is_trained:
                baseline_weights = self.predictor.model.coef_[0]
            else:
                baseline_weights = self._baseline_weights

            # Bayesian blend: (1-alpha) * prior + alpha * user likelihood
            blended = (1 - self.alpha) * baseline_weights + self.alpha * user_weights

            # Store blended model as the personal adaptation layer
            self._personal_model = user_model
            self._personal_model.coef_ = np.array([blended])
            print("Model adapted successfully.")
        else:
            print("Insufficient class diversity in user history to adapt "
                  "(need both breakdown and non-breakdown events).")

    def predict_proba(self, X):
        """
        Blended prediction: base model + personal adaptation.
        Falls back to base model if not enough data to adapt.
        """
        base_prob = self.predictor.predict_breakdown_prob(X)
        if self._personal_model is None:
            return base_prob
        personal_prob = self._personal_model.predict_proba(X)[0][1]
        return (1 - self.alpha) * base_prob + self.alpha * personal_prob

