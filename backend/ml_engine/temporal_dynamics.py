"""
Temporal dynamics — maintains per-session memory of network states
(ECN, DMN, Salience, Load) and the accumulated-conflict variable A.
"""


class TemporalState:
    """Mutable container for a session's temporal variables."""

    def __init__(self):
        self.ECN: float = 1.0
        self.DMN: float = 0.0
        self.A: float = 0.0  # accumulated conflict (drift-diffusion)

    def update(self, I: float, D: float, F: float) -> dict:
        """
        Advance the network one time-step and return the new state.

        ECN_next = max(0, prev_ECN + 0.2 - 0.3*I - 0.2*F)
        DMN_next = prev_DMN + 0.3*D
        Salience = I
        Load     = F

        Returns dict with keys: ECN, DMN, Salience, Load
        """
        ecn_next = max(0.0, self.ECN + 0.2 - 0.3 * I - 0.2 * F)
        dmn_next = self.DMN + 0.3 * D

        self.ECN = ecn_next
        self.DMN = dmn_next

        return {
            "ECN": ecn_next,
            "DMN": dmn_next,
            "Salience": I,
            "Load": F,
        }
