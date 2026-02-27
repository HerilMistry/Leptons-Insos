"""
Neuro Explainer Integration with Groq API.

Generates natural language explanations of brain network activity
using Groq's LLM, suitable for student-level understanding.
"""

import os
from datetime import datetime, timedelta, timezone

import requests

from mongo.connection import get_model_outputs_collection


def _get_groq_api_key() -> str:
    """Retrieve Groq API key from environment."""
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError(
            "GROQ_API_KEY environment variable not set. "
            "Please provide your Groq API key."
        )
    return key


def _get_session_metrics(session_id: str) -> dict:
    """
    Retrieve aggregated metrics for a session over last 30 minutes.
    
    Returns:
        dict with keys: ecn, drift, instability, fatigue,
        breakdowns, data_points
    """
    collection = get_model_outputs_collection()
    
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    query = {
        "session_id": session_id,
        "timestamp": {"$gte": cutoff_time}
    }
    
    documents = list(collection.find(query))
    
    if not documents:
        return {
            "ecn": 0.0,
            "drift": 0.0,
            "instability": 0.0,
            "fatigue": 0.0,
            "breakdowns": 0,
            "data_points": 0
        }
    
    # Extract metrics
    ecn_values = [doc.get("ECN", 0.0) for doc in documents]
    drift_values = [doc.get("D", 0.0) for doc in documents]
    instability_values = [doc.get("I", 0.0) for doc in documents]
    fatigue_values = [doc.get("F", 0.0) for doc in documents]
    breakdown_flags = [
        doc.get("breakdown_imminent", False) for doc in documents
    ]
    
    avg_ecn = (
        sum(ecn_values) / len(ecn_values) if ecn_values else 0.0
    )
    avg_drift = (
        sum(drift_values) / len(drift_values) if drift_values else 0.0
    )
    avg_instability = (
        sum(instability_values) / len(instability_values)
        if instability_values else 0.0
    )
    avg_fatigue = (
        sum(fatigue_values) / len(fatigue_values)
        if fatigue_values else 0.0
    )
    breakdown_count = sum(1 for flag in breakdown_flags if flag)
    
    return {
        "ecn": round(avg_ecn, 2),
        "drift": round(avg_drift, 2),
        "instability": round(avg_instability, 2),
        "fatigue": round(avg_fatigue, 2),
        "breakdowns": breakdown_count,
        "data_points": len(documents)
    }


def _determine_dominant_region(brain_map: dict) -> str:
    """Determine the brain region with highest activation from brain_map."""
    if not brain_map or "brain_regions" not in brain_map:
        return "DLPFC"
    
    regions = brain_map["brain_regions"]
    max_region = "DLPFC"
    max_activation = 0.0
    
    for region_name, region_data in regions.items():
        activation = region_data.get("activation", 0.0)
        if activation > max_activation:
            max_activation = activation
            max_region = region_name
    
    return max_region


def generate_explanation(
    session_id: str, brain_map=None
) -> dict:
    """
    Generate a natural language explanation of cognitive state using Groq.
    
    Args:
        session_id: UUID of the session
        brain_map: Optional pre-computed brain map (for efficiency)
        
    Returns:
        dict with key "explanation" containing the response text
    """
    # Get metrics
    metrics = _get_session_metrics(session_id)
    
    if metrics["data_points"] == 0:
        return {
            "explanation": (
                "No telemetry data available for this session "
                "in the last 30 minutes. Please check that "
                "the session is active and submitting data."
            ),
            "metadata": {
                "data_points": 0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    
    # Determine dominant region
    if brain_map:
        dominant_region = _determine_dominant_region(brain_map)
        dlpfc_act = brain_map["brain_regions"]["DLPFC"]["activation"]
        acc_act = brain_map["brain_regions"]["ACC"]["activation"]
        pcc_act = brain_map["brain_regions"]["PCC"]["activation"]
    else:
        if metrics["ecn"] > 0.5:
            dominant_region = "DLPFC"
        else:
            dominant_region = "Default Mode Network"
        dlpfc_act = metrics["ecn"]
        acc_act = metrics["instability"]
        pcc_act = metrics["drift"]
    
    # Build user prompt
    user_prompt = (
        f"In the last 30 minutes, the user's brain activity shows:\n"
        f"- DLPFC (Executive Control): {dlpfc_act:.2f} (attention & focus)\n"
        f"- ACC (Conflict Monitoring): {acc_act:.2f}\n"
        f"- PCC (Mind-wandering): {pcc_act:.2f}\n"
        f"- Fatigue level: {metrics['fatigue']:.2f}\n"
        f"- Number of attention shifts: {metrics.get('switches', 'unknown')}\n"
        f"- Breakdowns imminent: {metrics['breakdowns']}\n"
        f"- Dominant region: {dominant_region}\n\n"
        f"Explain what this means about their cognitive state and "
        f"attention in simple language."
    )
    
    # System prompt
    system_prompt = (
        "You are a cognitive neuroscience tutor. "
        "Explain brain network activity in simple language "
        "suitable for a 16-year-old student. "
        "Avoid heavy jargon. Keep responses concise (2-3 sentences). "
        "Focus on what the metrics mean for the user's attention and focus."
    )
    
    # Call Groq API
    try:
        api_key = _get_groq_api_key()
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mixtral-8x7b-32768",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                "max_tokens": 256,
                "temperature": 0.7
            },
            timeout=10
        )
        
        response.raise_for_status()
        result = response.json()
        
        explanation_text = (
            result.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "Unable to generate explanation.")
        )
        
        return {
            "explanation": explanation_text,
            "metadata": {
                "data_points": metrics["data_points"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metrics_used": {
                    "avg_ecn": metrics["ecn"],
                    "avg_drift": metrics["drift"],
                    "avg_instability": metrics["instability"],
                    "avg_fatigue": metrics["fatigue"],
                    "breakdown_count": metrics["breakdowns"]
                }
            }
        }
        
    except requests.RequestException as e:
        return {
            "explanation": f"Error connecting to Groq API: {str(e)}",
            "metadata": {
                "error": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    except ValueError as e:
        return {
            "explanation": str(e),
            "metadata": {
                "error": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
