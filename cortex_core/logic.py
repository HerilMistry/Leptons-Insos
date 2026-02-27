import numpy as np

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

class StateEngine:
    def __init__(self, expected_duration_min=60, theta=1.0):
        self.expected_duration = expected_duration_min * 60
        self.theta = theta
        self.I_t = 0.0
        self.D_t = 0.0
        self.F_t = 0.0
        self.ECN_t = 1.0
        self.DMN_t = 0.0
        self.SN_t = 0.0
        self.A_t = 0.0
        self.a = np.array([0.4, 0.4, 0.2])
        self.b = np.array([0.5, 0.3, 0.2])
        self.w = np.array([0.4, 0.4, 0.2])
        self.alpha = 0.05
        self.beta = 0.02
        self.gamma = 0.01
        self.delta = 0.05
        self.epsilon = 0.1
        
    def update_latent_states(self, telemetry, session_duration_sec):
        instability_feats = np.array([
            telemetry.get('switch_rate', 0),
            telemetry.get('motor_var', 0),
            telemetry.get('distractor_attempts', 0)
        ])
        self.I_t = np.dot(self.a, instability_feats)
        drift_feats = np.array([
            telemetry.get('idle_ratio', 0),
            telemetry.get('scroll_entropy', 0),
            telemetry.get('passive_playback', 0)
        ])
        self.D_t = np.dot(self.b, drift_feats)
        self.F_t = sigmoid(session_duration_sec / self.expected_duration)
        return self.I_t, self.D_t, self.F_t

    def update_temporal_dynamics(self, E_t, Idle_t, Task_t, SwitchPressure_t):
        self.ECN_t = self.ECN_t + self.alpha * E_t - self.beta * self.I_t - self.gamma * self.F_t
        self.ECN_t = np.clip(self.ECN_t, 0, 1)
        self.DMN_t = self.DMN_t + self.delta * Idle_t - self.epsilon * Task_t
        self.DMN_t = np.clip(self.DMN_t, 0, 1)
        self.SN_t = sigmoid(SwitchPressure_t - self.ECN_t)
        return self.ECN_t, self.DMN_t, self.SN_t

    def get_attention_risk(self):
        risk_input = np.dot(self.w, np.array([self.I_t, self.D_t, self.F_t]))
        return sigmoid(risk_input)

    def detect_breakdown(self):
        self.A_t = max(0, self.A_t + self.I_t - self.ECN_t)
        is_breakdown = 1 if self.A_t > self.theta else 0
        return is_breakdown, self.A_t

    def get_network_activations(self):
        return {
            "ECN": max(0, 1 - self.I_t - self.F_t),
            "DMN": self.D_t,
            "Salience": self.I_t,
            "Load": self.F_t
        }
