# Brain Map & Neuro Explainer Integration Guide

## Overview

This integration adds two new cognitive neuroscience-powered API endpoints to CortexFlow:

1. **Brain Map Endpoint** - Maps cognitive metrics to brain region activation levels
2. **Neuro Explainer Endpoint** - Generates AI-powered explanations of cognitive state

## Endpoints

### 1. Brain Map Endpoint

**URL:** `GET /api/brain-map/<session_id>`

**Description:** Returns brain region activation levels as percentage-based colors for visualization.

**Response Structure:**
```json
{
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
```

**Brain Regions Explained:**

| Region | Abbreviation | Represents | Metric |
|--------|-------------|-----------|--------|
| Dorsolateral Prefrontal Cortex | DLPFC | Executive Control | avg(ECN) |
| Anterior Cingulate Cortex | ACC | Conflict Monitoring | avg(Salience) |
| Anterior Insula | Insula | Switch Intensity | variance(Instability) |
| Posterior Cingulate Cortex | PCC | Mind-wandering | avg(Drift) |
| Medial Prefrontal Cortex | mPFC | Self-referential processing | geometric_mean(Drift, Fatigue) |
| Basal Ganglia | BasalGanglia | Switching Impulses | trend(accumulated_conflict) |

**Color Mapping:**
- **0.0 (Blue #0000FF):** Low activation - relaxed state
- **0.5 (Yellow #FFFF00):** Medium activation - moderate engagement
- **1.0 (Red #FF0000):** High activation - intensive effort

### 2. Neuro Explainer Endpoint

**URL:** `GET /api/brain-explainer/<session_id>`

**Description:** Generates a natural language explanation of the user's cognitive state using Groq LLM.

**Response Structure:**
```json
{
  "explanation": "Your brain's executive control network (DLPFC) is moderately active, suggesting you're maintaining focus on your current task. However, mind-wandering (PCC) is relatively low, which is good. Your fatigue level is rising at 0.71, so consider taking a break soon to maintain optimal cognitive performance.",
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
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

Key new dependency:
- `requests>=2.31.0` - for Groq API calls

### 2. Configure Environment Variables

Create or update `.env` in the backend directory:

```bash
# Existing
GROQ_API_KEY=your_groq_api_key_here
```

Get your Groq API key from: https://console.groq.com/

### 3. Database Migrations

No new database models for these endpoints - they query existing data.

### 4. Test the Endpoints

Using curl:

```bash
# Test Brain Map
curl http://localhost:8000/api/brain-map/550e8400-e29b-41d4-a716-446655440000

# Test Neuro Explainer (requires GROQ_API_KEY)
curl http://localhost:8000/api/brain-explainer/550e8400-e29b-41d4-a716-446655440000
```

Using Python:

```python
import requests

session_id = "550e8400-e29b-41d4-a716-446655440000"

# Brain Map
response = requests.get(f"http://localhost:8000/api/brain-map/{session_id}")
brain_map = response.json()

# Neuro Explainer
response = requests.get(f"http://localhost:8000/api/brain-explainer/{session_id}")
explanation = response.json()
```

## Data Flow

### Brain Mapper Flow

```
MongoDB telemetry collection (last 30 minutes)
        ↓
Extract ECN, Salience, Instability, Drift, Fatigue
        ↓
Compute averages and variance for each metric
        ↓
Normalize values to [0, 1] range
        ↓
Map to brain regions (biophysiological mapping)
        ↓
Convert activation to color (gradient: blue → yellow → red)
        ↓
Return JSON response
```

### Neuro Explainer Flow

```
Session ID
        ↓
Query MongoDB for metrics (last 30 minutes)
        ↓
Determine dominant brain region
        ↓
Build user prompt with metrics
        ↓
Call Groq API with system + user prompt
        ↓
Parse response and format JSON
        ↓
Return explanation
```

## Error Handling

Both endpoints gracefully handle:

- **Missing session:** Returns HTTP 404
- **No telemetry data:** Returns default low activations with note, or "no data available" message
- **Groq API error:** Returns error message in explanation field
- **Missing GROQ_API_KEY:** Returns helpful error message

## Performance Considerations

- Brain map queries use MongoDB aggregation pipeline for efficiency
- Results cached only for the duration of a single request
- Groq API calls have 10-second timeout
- All timestamps in UTC

## Security Notes

- GROQ_API_KEY never logged or exposed in responses
- Session ownership validated before returning data
- API keys loaded from environment variables only
- No hardcoded credentials

## Implementation Files

### New Files

1. **ml_engine/brain_mapper.py**
   - `get_brain_map(session_id)` - main function
   - `_normalize()` - normalization utility
   - `_activation_to_color()` - color mapping utility

2. **ml_engine/neuro_explainer.py**
   - `generate_explanation(session_id, brain_map)` - main function
   - `_get_groq_api_key()` - environment variable retrieval
   - `_get_session_metrics()` - MongoDB query
   - `_determine_dominant_region()` - region selection

### Modified Files

1. **api/views.py**
   - Added `BrainMapView` class
   - Added `NeuroExplainerView` class
   - Updated imports

2. **api/serializers.py**
   - Added `BrainRegionSerializer`
   - Added `BrainRegionsMapSerializer`
   - Added `BrainMapMetadataSerializer`
   - Added `BrainMapResponseSerializer`
   - Added `NeuroExplainerMetadataSerializer`
   - Added `NeuroExplainerResponseSerializer`

3. **api/urls.py**
   - Added brain-map route
   - Added brain-explainer route

4. **backend/requirements.txt**
   - Added `requests>=2.31.0`

### Test File

**tests/test_brain_endpoints.py**
- Creates test session with mock telemetry data
- Tests brain mapper functionality
- Tests neuro explainer functionality
- Prints example responses

## Running Tests

```bash
# From backend directory
python manage.py shell < ../tests/test_brain_endpoints.py
```

## Neuroscience Background

The brain regions mapped correspond to real neuroscientific networks:

- **Executive Control Network (ECN)** - engaged during goal-directed tasks
- **Default Mode Network (DMN)** - active during rest/mind-wandering
- **Salience Network** - identifies relevant stimuli for attention
- **Switch detection** - conflict monitoring and attention shifting

The implementation uses behavioral proxies (typing patterns, mouse movement, idle time) to infer these network states, validated against cognitive load research.

## API Versioning

For future versions, consider:
- Time-windowing options (5, 15, 60 minutes)
- Custom brain region subsets
- Comparison endpoints (current vs. baseline)
- Trend analysis (activations over multiple sessions)
