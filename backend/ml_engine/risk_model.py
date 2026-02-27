"""
Risk model — simple mean of the three cognitive state metrics.
"""


def compute_risk(I: float, D: float, F: float) -> float:
    """
    risk = (I + D + F) / 3
    """
    return (I + D + F) / 3.0
