"""
Brain Map Coloring Engine.

Maps cognitive metrics to brain region activation levels and returns
a structured JSON with color-coded activations.
"""

from datetime import datetime, timedelta, timezone

from mongo.connection import get_model_outputs_collection


def _normalize(
    value: float, min_val: float = 0.0, max_val: float = 1.0
) -> float:
    """Normalize a value to [0, 1] range with clipping."""
    normalized = (value - min_val) / (max_val - min_val)
    return max(0.0, min(1.0, normalized))


def _activation_to_color(activation: float) -> str:
    """
    Map activation level (0-1) to hex color.
    
    0.0 → blue (#0000FF)
    0.5 → yellow (#FFFF00)
    1.0 → red (#FF0000)
    """
    # Ensure activation is in [0, 1]
    a = max(0.0, min(1.0, activation))
    
    if a <= 0.5:
        # Blue to Yellow: interpolate from (0, 0, 255) to (255, 255, 0)
        t = a * 2  # 0 to 1
        r = int(255 * t)
        g = int(255 * t)
        b = int(255 * (1 - t))
    else:
        # Yellow to Red: interpolate from (255, 255, 0) to (255, 0, 0)
        t = (a - 0.5) * 2  # 0 to 1
        r = 255
        g = int(255 * (1 - t))
        b = 0
    
    return f"#{r:02X}{g:02X}{b:02X}"


def get_brain_map(session_id: str) -> dict:
    """
    Calculate brain region activations for a session based on last 30 minutes.
    
    Args:
        session_id: UUID of the session
        
    Returns:
        dict with structure:
        {
            "brain_regions": {
                "DLPFC": {"activation": float, "color": str},
                "ACC": {"activation": float, "color": str},
                ...
            },
            "metadata": {
                "data_points": int,
                "time_window_minutes": int,
                "timestamp": str
            }
        }
    """
    collection = get_model_outputs_collection()
    
    # Query last 30 minutes of data
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    query = {
        "session_id": session_id,
        "timestamp": {"$gte": cutoff_time}
    }
    
    documents = list(collection.find(query).sort("timestamp", 1))
    
    if not documents:
        # Return default low activations if no data
        default_color = _activation_to_color(0.0)
        return {
            "brain_regions": {
                "DLPFC": {"activation": 0.0, "color": default_color},
                "ACC": {"activation": 0.0, "color": default_color},
                "Insula": {"activation": 0.0, "color": default_color},
                "PCC": {"activation": 0.0, "color": default_color},
                "mPFC": {"activation": 0.0, "color": default_color},
            },
            "metadata": {
                "data_points": 0,
                "time_window_minutes": 30,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": (
                    "No data available for this session in the "
                    "last 30 minutes"
                )
            }
        }
    
    # Extract metrics
    ecn_values = [doc.get("ECN", 0.0) for doc in documents]
    salience_values = [doc.get("Salience", 0.0) for doc in documents]
    instability_values = [doc.get("I", 0.0) for doc in documents]
    drift_values = [doc.get("D", 0.0) for doc in documents]
    fatigue_values = [doc.get("F", 0.0) for doc in documents]
    conflict_values = [
        doc.get("accumulated_conflict", 0.0) for doc in documents
    ]
    
    # Compute averages
    avg_ecn = (
        sum(ecn_values) / len(ecn_values) if ecn_values else 0.0
    )
    avg_salience = (
        sum(salience_values) / len(salience_values)
        if salience_values else 0.0
    )
    avg_instability = (
        sum(instability_values) / len(instability_values)
        if instability_values else 0.0
    )
    avg_drift = (
        sum(drift_values) / len(drift_values) if drift_values else 0.0
    )
    avg_fatigue = (
        sum(fatigue_values) / len(fatigue_values)
        if fatigue_values else 0.0
    )
    
    # Compute variance of instability (switch volatility)
    if len(instability_values) > 1:
        mean_inst = avg_instability
        variance_inst = (
            sum((x - mean_inst) ** 2 for x in instability_values)
            / len(instability_values)
        )
    else:
        variance_inst = 0.0
    
    # Compute accumulated conflict trend (last - first)
    conflict_trend = 0.0
    if conflict_values:
        if len(conflict_values) > 1:
            conflict_trend = abs(conflict_values[-1] - conflict_values[0])
        else:
            conflict_trend = conflict_values[0]
    
    # --- Activation Mapping ---
    
    # 1. DLPFC = ECN (normalize assuming ECN is typically in 0-1 range)
    dlpfc_activation = _normalize(avg_ecn, 0.0, 1.0)
    
    # 2. ACC = Salience
    acc_activation = _normalize(avg_salience, 0.0, 1.0)
    
    # 3. Insula = Instability variance (switch volatility)
    # Normalize assuming variance can be up to ~0.25 in typical scenarios
    insula_activation = _normalize(variance_inst, 0.0, 0.25)
    
    # 4. PCC = Drift
    pcc_activation = _normalize(avg_drift, 0.0, 1.0)
    
    # 5. mPFC = interaction of Drift and Fatigue
    # Use geometric mean to represent interaction
    drift_norm = _normalize(avg_drift, 0.0, 1.0)
    fatigue_norm = _normalize(avg_fatigue, 0.0, 1.0)
    mpfc_activation = (drift_norm * fatigue_norm) ** 0.5  # geometric mean
    
    # 6. Basal Ganglia = accumulated conflict trend
    bg_activation = _normalize(conflict_trend, 0.0, 2.0)
    
    return {
        "brain_regions": {
            "DLPFC": {
                "activation": round(dlpfc_activation, 4),
                "color": _activation_to_color(dlpfc_activation),
                "meaning": (
                    "Executive Control Network "
                    "(attention, working memory)"
                )
            },
            "ACC": {
                "activation": round(acc_activation, 4),
                "color": _activation_to_color(acc_activation),
                "meaning": "Anterior Cingulate Cortex (conflict monitoring)"
            },
            "Insula": {
                "activation": round(insula_activation, 4),
                "color": _activation_to_color(insula_activation),
                "meaning": "Anterior Insula (switch intensity)"
            },
            "PCC": {
                "activation": round(pcc_activation, 4),
                "color": _activation_to_color(pcc_activation),
                "meaning": "Posterior Cingulate Cortex (mind-wandering)"
            },
            "mPFC": {
                "activation": round(mpfc_activation, 4),
                "color": _activation_to_color(mpfc_activation),
                "meaning": (
                    "Medial Prefrontal Cortex "
                    "(self-referential processing)"
                )
            },
            "BasalGanglia": {
                "activation": round(bg_activation, 4),
                "color": _activation_to_color(bg_activation),
                "meaning": "Basal Ganglia (switching impulses)"
            }
        },
        "metadata": {
            "data_points": len(documents),
            "time_window_minutes": 30,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "averages": {
                "ECN": round(avg_ecn, 4),
                "Salience": round(avg_salience, 4),
                "Instability": round(avg_instability, 4),
                "Drift": round(avg_drift, 4),
                "Fatigue": round(avg_fatigue, 4)
            }
        }
    }
