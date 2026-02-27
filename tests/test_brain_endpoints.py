"""
Test module for Brain Map and Neuro Explainer endpoints.

Example usage:
    python manage.py shell < tests/test_brain_endpoints.py
"""

from datetime import datetime, timedelta, timezone
from api.models import Session
from django.contrib.auth import get_user_model
from ml_engine.brain_mapper import get_brain_map
from ml_engine.neuro_explainer import generate_explanation
from mongo.connection import get_model_outputs_collection
import json

User = get_user_model()


def create_test_session_with_data():
    """Create a test session and populate it with mock telemetry data."""
    # Create or get test user
    user, _ = User.objects.get_or_create(
        username="test_user",
        defaults={"email": "test@example.com"}
    )
    
    # Create session
    session = Session.objects.create(
        user=user,
        task_type="reading"
    )
    
    # Populate MongoDB with mock data (last 30 minutes)
    collection = get_model_outputs_collection()
    now = datetime.now(timezone.utc)
    
    mock_documents = []
    for i in range(20):  # Create 20 sample data points
        timestamp = now - timedelta(minutes=30-i*2)
        doc = {
            "session_id": str(session.id),
            "timestamp": timestamp,
            "ECN": 0.3 + (i * 0.02),  # Gradually increasing
            "Salience": 0.4 + (i * 0.015),
            "DMN": 0.2 + (i * 0.01),
            "Load": 0.5,
            "I": 0.35 + (i * 0.01),  # Instability
            "D": 0.25 + (i * 0.015),  # Drift
            "F": 0.6 + (i * 0.005),   # Fatigue
            "risk": 0.4 + (i * 0.02),
            "accumulated_conflict": i * 0.05,
            "breakdown_imminent": i > 15  # Last few entries indicate breakdown
        }
        mock_documents.append(doc)
    
    collection.insert_many(mock_documents)
    
    return session


def test_brain_map():
    """Test brain_mapper.get_brain_map()."""
    print("\n" + "="*70)
    print("TESTING BRAIN MAP ENDPOINT")
    print("="*70)
    
    session = create_test_session_with_data()
    
    brain_map = get_brain_map(str(session.id))
    
    print(f"\nSession ID: {session.id}")
    print(f"\nBrain Map Response:")
    print(json.dumps(brain_map, indent=2))
    
    # Validate structure
    assert "brain_regions" in brain_map
    assert "metadata" in brain_map
    
    regions = brain_map["brain_regions"]
    assert "DLPFC" in regions
    assert "ACC" in regions
    assert "Insula" in regions
    assert "PCC" in regions
    assert "mPFC" in regions
    assert "BasalGanglia" in regions
    
    # Validate region structure
    for region_name, region_data in regions.items():
        assert "activation" in region_data
        assert "color" in region_data
        assert 0.0 <= region_data["activation"] <= 1.0
        assert region_data["color"].startswith("#")
        print(f"  ✓ {region_name}: activation={region_data['activation']}, color={region_data['color']}")
    
    print("\n✓ Brain map test passed!")
    
    return session


def test_neuro_explainer(session_id):
    """Test neuro_explainer.generate_explanation()."""
    print("\n" + "="*70)
    print("TESTING NEURO EXPLAINER ENDPOINT")
    print("="*70)
    
    print(f"\nSession ID: {session_id}")
    print("\nGenerating explanation (requires GROQ_API_KEY)...")
    
    explanation = generate_explanation(str(session_id))
    
    print(f"\nExplanation Response:")
    print(json.dumps(explanation, indent=2))
    
    # Validate structure
    assert "explanation" in explanation
    assert "metadata" in explanation
    
    print("\n✓ Neuro explainer test passed!")


def example_responses():
    """Print example response structures."""
    print("\n" + "="*70)
    print("EXAMPLE JSON RESPONSES")
    print("="*70)
    
    example_brain_map = {
        "brain_regions": {
            "DLPFC": {
                "activation": 0.72,
                "color": "#FF8A00",
                "meaning": "Executive Control Network (attention, working memory)"
            },
            "ACC": {
                "activation": 0.58,
                "color": "#FFAA00",
                "meaning": "Anterior Cingulate Cortex (conflict monitoring)"
            },
            "Insula": {
                "activation": 0.41,
                "color": "#FF6B00",
                "meaning": "Anterior Insula (switch intensity)"
            },
            "PCC": {
                "activation": 0.35,
                "color": "#4169E1",
                "meaning": "Posterior Cingulate Cortex (mind-wandering)"
            },
            "mPFC": {
                "activation": 0.48,
                "color": "#FFD700",
                "meaning": "Medial Prefrontal Cortex (self-referential processing)"
            },
            "BasalGanglia": {
                "activation": 0.62,
                "color": "#FF7F00",
                "meaning": "Basal Ganglia (switching impulses)"
            }
        },
        "metadata": {
            "data_points": 20,
            "time_window_minutes": 30,
            "timestamp": "2026-02-28T15:30:00.000000+00:00",
            "averages": {
                "ECN": 0.62,
                "Salience": 0.68,
                "Instability": 0.55,
                "Drift": 0.52,
                "Fatigue": 0.71
            }
        }
    }
    
    example_explanation = {
        "explanation": (
            "Your brain's executive control network (DLPFC) is moderately active, "
            "suggesting you're maintaining focus on your current task. However, "
            "mind-wandering (PCC) is relatively low, which is good. Your fatigue "
            "level is rising at 0.71, so consider taking a break soon to maintain "
            "optimal cognitive performance."
        ),
        "metadata": {
            "data_points": 20,
            "timestamp": "2026-02-28T15:30:00.000000+00:00",
            "metrics_used": {
                "avg_ecn": 0.62,
                "avg_drift": 0.52,
                "avg_instability": 0.55,
                "avg_fatigue": 0.71,
                "breakdown_count": 4
            }
        }
    }
    
    print("\n--- Brain Map Response ---")
    print(json.dumps(example_brain_map, indent=2))
    
    print("\n--- Neuro Explainer Response ---")
    print(json.dumps(example_explanation, indent=2))


def run_all_tests():
    """Run all tests."""
    print("\n" + "="*70)
    print("BRAIN MAPPER & NEURO EXPLAINER TEST SUITE")
    print("="*70)
    
    session = test_brain_map()
    test_neuro_explainer(session.id)
    example_responses()
    
    print("\n" + "="*70)
    print("ALL TESTS COMPLETED")
    print("="*70)


if __name__ == "__main__":
    run_all_tests()
