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

    def construct_feature_vector(self, current_state, previous_state=None):
        I_t = current_state.get('I_t', 0)
        D_t = current_state.get('D_t', 0)
        F_t = current_state.get('F_t', 0)
        ECN_t = current_state.get('ECN_t', 0)
        A_t = current_state.get('A_t', 0)
        delta_I = I_t - previous_state.get('I_t', 0) if previous_state else 0
        delta_D = D_t - previous_state.get('D_t', 0) if previous_state else 0
        return np.array([I_t, D_t, F_t, ECN_t, A_t, delta_I, delta_D]).reshape(1, -1)

    def predict_breakdown_prob(self, feature_vector):
        if not self.is_trained:
            # Baseline weights from technical report/research
            weights = np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])
            return 1 / (1 + np.exp(-np.dot(weights, feature_vector.flatten())))
        return self.model.predict_proba(feature_vector)[0][1]

    def explain_prediction(self, feature_vector, feature_names=None):
        """
        Implements SHAP-style feature attribution (Section 5.4).
        Identifies which features contributed most to the current risk.
        """
        if feature_names is None:
            feature_names = ['Instability', 'Drift', 'Fatigue', 'ECN', 'Conflict(A_t)', 'delta_I', 'delta_D']
            
        if not self.is_trained:
            weights = np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])
        else:
            weights = self.model.coef_[0]
            
        contributions = feature_vector.flatten() * weights
        
        # Sort by absolute contribution
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
    Adjusts weights/thresholds based on empirical breakdown history.
    """
    def __init__(self, baseline_predictor, prior_variance=0.1):
        self.predictor = baseline_predictor
        self.prior_variance = prior_variance
        self.user_history = [] # List of (X, y_actual)
        
    def record_feedback(self, X, actual_breakdown):
        """
        Record whether a breakdown actually occurred for a given state.
        This provides the grounding for Bayesian updates.
        """
        self.user_history.append((X, actual_breakdown))
        
        # If we have enough data, perform a simple Bayesian nudge
        if len(self.user_history) >= 5:
            self.adapt_model()

    def adapt_model(self):
        """
        Performs a Bayesian-inspired update on the predictor weights.
        Adjusts the baseline weights by incorporating user-specific history.
        """
        print(f"Adapting model based on {len(self.user_history)} user interactions...")
        
        X_user = np.array([h[0].flatten() for h in self.user_history])
        y_user = np.array([h[1] for h in self.user_history])
        
        if len(np.unique(y_user)) > 1:
            # Simple online adaptation: 
            # 1. Fit a small model on user data
            user_specific_model = LogisticRegression(C=1.0) # High C = trust user data more
            user_specific_model.fit(X_user, y_user)
            
            # 2. Blend weights: Baseline + User Gradient
            # If predictor is not trained, use baseline weights
            baseline_weights = self.predictor.model.coef_[0] if self.predictor.is_trained else np.array([0.5, 0.4, 0.2, -0.3, 0.6, 0.2, 0.1])
            user_weights = user_specific_model.coef_[0]
            
            # Alpha controls the learning rate for personalization
            alpha = 0.2 
            new_weights = (1 - alpha) * baseline_weights + alpha * user_weights
            
            # Update the predictor
            if not self.predictor.is_trained:
                # Force training if not already trained
                dummy_X = np.random.randn(10, 7)
                dummy_y = np.random.randint(0, 2, 10)
                self.predictor.train(dummy_X, dummy_y)
            
            self.predictor.model.coef_ = np.array([new_weights])
            print("Model adapted successfully.")
        else:
            print("Insufficient class diversity in user history to adapt (need both breakdown and non-breakdown events).")
