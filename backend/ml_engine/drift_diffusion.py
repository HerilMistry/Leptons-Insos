"""
Drift-diffusion model — tracks accumulated conflict and detects breakdown.
"""


def update_conflict(
    prev_A: float,
    I: float,
    ECN: float,
) -> tuple[float, bool]:
    """
    A_next = prev_A + I - ECN
    breakdown = A_next > 1.0

    Returns:
        (A_next, breakdown_imminent)
    """
    A_next = prev_A + I - ECN
    breakdown = A_next > 1.0
    return A_next, breakdown
