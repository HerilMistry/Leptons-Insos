"""
CortexFlow ML Core
==================
Cognitive attention breakdown prediction engine.

Modules:
    logic      — StateEngine: real-time latent state updates (I_t, D_t, F_t, ECN, DMN, SN)
    predictor  — CortexPredictor: breakdown probability + SHAP attribution
                 BayesianAdapter: personalized online weight adaptation
"""

from cortex_core.logic import StateEngine
from cortex_core.predictor import CortexPredictor, BayesianAdapter

__all__ = ["StateEngine", "CortexPredictor", "BayesianAdapter"]
