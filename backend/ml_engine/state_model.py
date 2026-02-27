"""
State model — computes Instability (I), Drift (D), and Fatigue (F)
from aggregated behavioural features.
"""

import math


def compute_instability(
    switch_rate: float,
    typing_interval_var: float,
    mouse_velocity_var: float,
) -> float:
    """
    I = 0.4 * switch_rate + 0.3 * typing_interval_var + 0.3 * mouse_velocity_var
    """
    return (
        0.4 * switch_rate
        + 0.3 * typing_interval_var
        + 0.3 * mouse_velocity_var
    )


def compute_drift(
    idle_density: float,
    scroll_reversal_ratio: float,
) -> float:
    """
    D = 0.5 * idle_density + 0.5 * scroll_reversal_ratio
    """
    return 0.5 * idle_density + 0.5 * scroll_reversal_ratio


def _sigmoid(x: float) -> float:
    """Standard sigmoid function."""
    return 1.0 / (1.0 + math.exp(-x))


def compute_fatigue(duration_norm: float) -> float:
    """
    F = sigmoid(duration_norm)
    """
    return _sigmoid(duration_norm)
