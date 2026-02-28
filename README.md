# CortexFlow — Cognitive Attention Breakdown Prediction Engine

<div align="center">

**Real-time cognitive load monitoring · ML-based breakdown prediction · Neuroscience-grounded architecture**

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange)
![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)

</div>

---

CortexFlow is a neuroscience-grounded ML system that predicts **cognitive attention breakdowns** in real time during computer-based work sessions. It models latent cognitive states — Instability, Drift, Fatigue — and simulates three neural networks (ECN, DMN, Salience) from behavioral telemetry. A trained classifier with SHAP-style attribution and Bayesian personalization forecasts breakdown probability and triggers timely interventions.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Quickstart](#quickstart)
- [ML Pipeline](#ml-pipeline)
- [Backend API Reference](#backend-api-reference)
- [Dashboard Features](#dashboard-features)
- [Chrome Extension](#chrome-extension)
- [Core Library API](#core-library-api)
- [Data Sources](#data-sources)
- [Environment Variables](#environment-variables)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

CortexFlow operates as a three-tier system:

```
┌──────────────────────────────────┐
│     Chrome Extension (MV3)       │
│  Telemetry capture every 5s      │
│  Risk orb · Intervention banners │
│  NLP task classifier (popup)     │
└──────────────┬───────────────────┘
               │ POST /api/telemetry
               ▼
┌──────────────────────────────────┐
│     Django REST Backend          │
│  JWT auth · Session lifecycle    │
│  CortexEngine (real-time ML)     │
│  SQLite/PostgreSQL + MongoDB     │
└──────────────┬───────────────────┘
               │ GET /api/dashboard/analytics
               ▼
┌──────────────────────────────────┐
│     React + Vite Dashboard       │
│  Brain network visualization     │
│  Cognitive timeline charts       │
│  Breakdown forecasting           │
│  AI explanations (Groq/LLaMA)   │
│  PDF report export               │
└──────────────────────────────────┘
```

**ML Data Flow:**

```
Behavioral Telemetry → State Model (I, D, F) → Temporal Dynamics (ECN, DMN, Salience)
  → Drift-Diffusion (conflict accumulation) → Risk Model → XGBoost Classifier
  → Breakdown Probability → Bayesian Personalization
```

---

## Project Structure

```
Leptons-Insos/
├── cortex_core/                  # ML core library
│   ├── __init__.py
│   ├── engine.py                 # CortexEngine — unified stateful inference
│   ├── logic.py                  # StateEngine — latent state updates
│   └── predictor.py              # CortexPredictor + BayesianAdapter
│
├── backend/                      # Django REST API
│   ├── manage.py
│   ├── cortexflow/               # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── api/                      # Main API app
│   │   ├── models.py             # Session model
│   │   ├── views.py              # All endpoints
│   │   ├── serializers.py
│   │   ├── urls.py               # URL routing
│   │   └── migrations/
│   ├── ml_engine/                # Backend ML modules
│   │   ├── state_model.py        # I, D, F computation
│   │   ├── temporal_dynamics.py  # ECN, DMN, Salience, Load tracking
│   │   ├── drift_diffusion.py    # Conflict accumulation & breakdown
│   │   └── risk_model.py         # Composite risk score
│   └── mongo/                    # Optional MongoDB persistence
│       └── connection.py
│
├── website/cortexmind-dashboard/ # React + Vite frontend
│   ├── src/
│   │   ├── pages/                # Route pages
│   │   ├── components/
│   │   │   ├── dashboard/        # Dashboard widgets
│   │   │   ├── layout/           # App shell
│   │   │   ├── session/          # Session management
│   │   │   └── ui/               # shadcn/ui primitives
│   │   ├── hooks/                # React Query hooks
│   │   ├── api/                  # API client layer
│   │   ├── context/              # Auth + Session providers
│   │   ├── lib/                  # Groq explainer, PDF export, utils
│   │   ├── types/                # TypeScript type definitions
│   │   └── mocks/                # Dev mock data
│   └── package.json
│
├── extensions/                   # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── config.js                 # Thresholds & config
│   ├── background/               # Service worker
│   │   └── background.js
│   ├── content/                  # Content scripts
│   │   ├── telemetry.js          # Behavioral data collection
│   │   ├── overlay.js            # Risk orb + intervention UI
│   │   └── overlay.css
│   └── popup/                    # Toolbar popup
│       ├── popup.html
│       ├── popup.js              # NLP task classifier
│       └── popup.css
│
├── scripts/
│   ├── preprocess.py             # Data pipeline (NASA-TLX + MOOC + Mouse)
│   └── train.py                  # Train XGBoost classifier
│
├── models/
│   └── baseline_model.joblib     # Pre-trained model (ready to use)
│
├── data/processed/               # Generated training features
│   ├── training_data.csv         # 60K rows, 7 features + label
│   ├── nasa_features.csv
│   ├── mooc_features.csv
│   └── mouse_features.csv
│
├── tests/
│   ├── verify_session.py         # End-to-end session simulation
│   ├── test_integration.py
│   ├── test_video_drift.py
│   └── test_zoning_out.py
│
└── requirements.txt              # Python dependencies
```

---

## Quickstart

### Prerequisites

- Python 3.10+
- Node.js 18+
- Chrome browser (for extension)

### 1. Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r backend/requirements.txt

# Run migrations
cd backend
USE_SQLITE=1 python manage.py migrate

# Start Django server
USE_SQLITE=1 python manage.py runserver 8000
```

### 2. Frontend Setup

```bash
cd website/cortexmind-dashboard

# Install dependencies
npm install

# Create .env
echo "VITE_API_URL=http://localhost:8000" > .env
echo "VITE_GROQ_API_KEY=your_groq_api_key_here" >> .env

# Start dev server
npm run dev
# → http://localhost:5173
```

### 3. Chrome Extension

1. **Unzip the Extension**: Locate `extensions.zip` in the root directory and unzip it (the folder `extensions/` should appear).
2. **Open Extensions**: In Chrome, go to `chrome://extensions/`.
3. **Enable Developer Mode**: Toggle the **Developer mode** switch in the top-right corner.
4. **Load Extension**: Click **Load unpacked** and select the `extensions/` folder.
5. **Pin & Use**: The CortexFlow icon appears in the toolbar. Pin it for quick access! ✅

### 4. Run Verification (optional)

```bash
python tests/verify_session.py
```

### 5. Retrain Model (optional)

```bash
python scripts/preprocess.py   # Generate training_data.csv (60K rows)
python scripts/train.py        # Train XGBoost → models/baseline_model.joblib
```

---

## ML Pipeline

### Feature Vector

7-dimensional input: `[I_t, D_t, F_t, ECN_t, A_t, ΔI, ΔD]`

| Feature | Description | Source |
|---------|-------------|--------|
| `I_t` | Cognitive Instability | `0.4·switch_rate + 0.3·typing_var + 0.3·mouse_var` |
| `D_t` | Attention Drift | Passive media consumption + idle ratio |
| `F_t` | Mental Fatigue | Time-decayed accumulation over session |
| `ECN_t` | Executive Control Network | Inversely related to instability |
| `A_t` | Accumulated Conflict | Drift-diffusion accumulator (breakdown when > 1.0) |
| `ΔI` | Instability change rate | `I_t - I_{t-1}` |
| `ΔD` | Drift change rate | `D_t - D_{t-1}` |

### Model

| Property | Value |
|----------|-------|
| Algorithm | XGBoost (`XGBClassifier`) |
| Estimators | 200 |
| Max depth | 4 |
| Learning rate | 0.05 |
| Training data | 60,000 synthetic samples from 3 real datasets |
| CV F1 Score | 0.9990 |
| Test F1 Score | 0.9987 |
| Fallback | Logistic Regression with research-based weights |

### Neural Network Simulation

CortexFlow models three brain networks from behavioral signals:

| Network | Role | Behavioral Proxy |
|---------|------|-----------------|
| **ECN** (Executive Control) | Focused attention & task execution | Low switch rate, high typing consistency |
| **DMN** (Default Mode) | Mind-wandering & internal thought | High idle ratio, passive media consumption |
| **Salience** | Conflict detection & network switching | Transition signals between ECN ↔ DMN |
| **Load** | Overall cognitive load | Composite of all signals |

### Bayesian Personalization

`BayesianAdapter` performs online Bayesian updates from user feedback:
- Records predicted vs. actual breakdown events
- Adapts model weights after 5+ interactions
- Per-user personalization without retraining

---

## Backend API Reference

Base URL: `http://localhost:8000/api/`

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register/` | POST | Create account → JWT tokens |
| `/auth/login/` | POST | Authenticate → JWT tokens |
| `/auth/logout/` | POST | Stateless logout (acknowledge) |

### Session Lifecycle

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/session/start/` | POST | Start a new tracking session; initializes in-memory `CortexEngine` |
| `/sessions/stop/` | POST | End session; return deep-work ratio & aggregated metrics |
| `/sessions/active/?user_id=` | GET | Find currently running session for a user |
| `/sessions/history/` | GET | Last 50 sessions for authenticated user |
| `/sessions/<id>/detail/` | GET | Detailed metrics for a single session |
| `/sessions/<id>/live/` | GET | Live metrics from in-memory engine (active sessions) |

### Telemetry & Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/telemetry/` | POST | Accept feature vector → run inference → update session metrics |
| `/dashboard/analytics/?session_id=` | GET | Aggregated analytics (timeline, network state, interventions) |

### Telemetry POST Body

```json
{
  "session_id": "uuid",
  "features": {
    "switch_rate": 0.3,
    "idle_ratio": 0.1,
    "typing_speed": 55,
    "mouse_variability": 0.4,
    "task_type": "Coding",
    "active_app": "VS Code"
  }
}
```

### Analytics Response

```json
{
  "timeline": [
    { "timestamp": "...", "instability": 0.35, "drift": 0.22, "fatigue": 0.18 }
  ],
  "network_state": { "ECN": 0.72, "DMN": 0.28, "Salience": 0.45, "Load": 0.55 },
  "deep_work_ratio": 0.68,
  "switch_count": 12,
  "avg_instability": 0.31,
  "interventions": [
    { "timestamp": "...", "type": "instability", "severity": 0.8 }
  ]
}
```

### Database Model: Session

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user` | FK → User | Session owner |
| `task_type` | CharField | "Writing", "Coding", "Reading", etc. |
| `start_time` | DateTime | Session start |
| `end_time` | DateTime | Session end (null if active) |
| `avg_instability` | Float | Session average instability |
| `avg_drift` | Float | Session average drift |
| `avg_fatigue` | Float | Session average fatigue |
| `switch_count` | Integer | Total context switches |
| `total_windows` | Integer | Total telemetry windows |
| `deep_work_windows` | Integer | Windows in deep work state |

---

## Dashboard Features

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Main analytics view with all widgets |
| `/session/start` | Start Session | Task type selection, session initialization |
| `/session/history` | Session History | Historical session list with metrics |
| `/detailed-report` | Detailed Report | Groq-powered cognitive report + PDF export |
| `/login` | Login | JWT authentication |
| `/register` | Register | Account creation |

### Dashboard Widgets

| Component | Description |
|-----------|-------------|
| **Brain Network Viz** | Concentric ring visualization of ECN (inner), DMN (middle), Salience (outer) with pulsing animations and proportional value arcs. Dominant network indicator below. |
| **Attention Summary** | Top-level stats cards — deep work ratio, switch count, instability, network state |
| **Cognitive Timeline** | Time-series chart of instability, drift, fatigue over the session |
| **Network Radar Chart** | Radar plot of ECN, DMN, Salience, Load values |
| **Intervention Markers** | Timeline markers showing when interventions were triggered |
| **Session Summary Table** | Tabular view of all sessions with sortable columns |
| **Predictive Breakdown Forecast** | Amber alert card when risk trajectory predicts breakdown within 2 minutes. Uses linear regression on a sliding window of 5 risk values. Shows countdown timer. |
| **Explain My Brain State** | AI-powered slide-in drawer using Groq (LLaMA 3.1) to explain current cognitive state in plain language. Aggregates last 10 sessions for historical comparison. |
| **Focus Exercise** | Guided breathing exercise for intervention |

### AI Explainability

- **Model:** LLaMA 3.1 8B Instant via Groq API
- **System prompt:** Warm, specific, 3-paragraph cognitive analysis referencing ECN/DMN/Salience
- **Input:** Current session metrics + last 10 sessions aggregate (drift, fatigue, instability, deep work ratio, switches, task distribution)
- **PDF Export:** `generateSessionReport()` → styled HTML → print dialog

---

## Chrome Extension

### Manifest V3

- **Permissions:** `tabs`, `activeTab`, `storage`, `alarms`
- **Content scripts:** Run on all URLs — `telemetry.js`, `overlay.js`
- **Service worker:** `background.js` — session and tab tracking

### Configuration (`config.js`)

| Setting | Value | Description |
|---------|-------|-------------|
| `TELEMETRY_INTERVAL_MS` | 5000 | Telemetry collection every 5 seconds |
| `RISK_WARN_THRESHOLD` | 0.35 | Yellow orb warning |
| `RISK_DANGER_THRESHOLD` | 0.60 | Red orb + intervention banner |
| `BANNER_COOLDOWN_MS` | 30000 | 30s cooldown between intervention banners |
| `DISTRACTOR_DOMAINS` | youtube, reddit, twitter, facebook, instagram, tiktok, netflix, twitch, pinterest | Sites that increase drift score |

### Telemetry Signals Collected

- Tab/window switch rate
- Active vs. idle time ratio
- Mouse movement variability
- Scroll behavior entropy
- Typing speed variance
- Active application identity
- Distractor domain detection
- Passive media playback time

### Overlay UI

- **Risk orb:** Floating colored circle (green → yellow → red) indicating real-time risk
- **Intervention banner:** Slide-in notification with actionable suggestion when risk exceeds danger threshold
- **Per-task thresholds:** Different risk thresholds for different task types (Coding vs. Reading vs. Watching)

### Popup

- NLP-based task classification
- Session start/stop controls
- Quick stats display

---

## Core Library API

### `CortexEngine` (`cortex_core.engine`)

Unified stateful inference engine — one instance per active session.

```python
from cortex_core.engine import CortexEngine

engine = CortexEngine(model_path='models/baseline_model.joblib')

# Run inference on telemetry
result = engine.infer(telemetry_dict, session_duration_sec, task_type="Coding")
# Returns: risk, instability, drift, fatigue, ECN, DMN, Salience, Load, ...
```

### `StateEngine` (`cortex_core.logic`)

Converts raw behavioral telemetry into latent cognitive state variables.

```python
from cortex_core import StateEngine

engine = StateEngine(expected_duration_min=60)
I_t, D_t, F_t = engine.update_latent_states(telemetry_dict, session_duration_sec)
ECN_t, DMN_t, SN_t = engine.update_temporal_dynamics(E_t, Idle_t, Task_t, SwitchPressure_t)
is_breakdown, A_t = engine.detect_breakdown()
risk = engine.get_attention_risk()
```

### `CortexPredictor` (`cortex_core.predictor`)

Predicts breakdown probability with SHAP-style attribution.

```python
from cortex_core import CortexPredictor

predictor = CortexPredictor(model_path='models/baseline_model.joblib')
x_vec = predictor.construct_feature_vector(state, previous_state)
prob = predictor.predict_breakdown_prob(x_vec)         # [0, 1]
explanation = predictor.explain_prediction(x_vec)       # {'Conflict(A_t)': 0.38, ...}
```

### `BayesianAdapter` (`cortex_core.predictor`)

Online personalization from user feedback.

```python
from cortex_core import BayesianAdapter

adapter = BayesianAdapter(predictor, prior_variance=0.1)
adapter.record_feedback(x_vec, actual_breakdown=1)
# Model auto-adapts after 5+ interactions
```

---

## Data Sources

Training data is synthesized from three real-world datasets (60,000 samples total):

| Dataset | Description | Features Derived |
|---------|-------------|-----------------|
| **NASA-TLX** | Subjective cognitive load ratings | Fatigue (F_t), Instability (I_t) |
| **NTHU MOOC** | Online learning engagement traces | Drift (D_t) |
| **Mouse Tracking** | Stroop task `.mt` files | Motor variability, reaction time proxy |

Preprocessing: `python scripts/preprocess.py` → `data/processed/training_data.csv`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `insecure-dev-key` | Django secret key |
| `DEBUG` | `True` | Debug mode |
| `USE_SQLITE` | `1` | Use SQLite (set `0` for PostgreSQL) |
| `DB_NAME` | `cortexflow` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |

### Frontend (`website/cortexmind-dashboard/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g. `http://localhost:8000`) |
| `VITE_GROQ_API_KEY` | Groq API key for AI explanations |

---

## Tech Stack

### Backend
- **Python 3.10+** — Core language
- **Django 4.2** — Web framework
- **Django REST Framework** — API layer
- **SimpleJWT** — Authentication
- **NumPy / Pandas / scikit-learn** — ML pipeline
- **XGBoost** — Breakdown classifier
- **PyMongo** — Optional MongoDB persistence

### Frontend
- **React 18** — UI framework
- **TypeScript 5** — Type safety
- **Vite 7** — Build tool
- **Tailwind CSS** — Styling
- **shadcn/ui** — Component library (Radix UI primitives)
- **TanStack React Query** — Data fetching & caching
- **Recharts** — Charts and visualizations
- **Groq SDK** — AI-powered explanations (LLaMA 3.1)

### Extension
- **Chrome Manifest V3** — Extension framework
- **Vanilla JS** — Content scripts & service worker
- **Groq API** — NLP task classification in popup

### Infrastructure
- **SQLite** (dev) / **PostgreSQL** (prod) — Relational database
- **MongoDB** — Optional telemetry persistence
- **JWT** — Stateless authentication

---

## Development

### Running Both Servers

```bash
# Terminal 1: Backend
cd backend && USE_SQLITE=1 python manage.py runserver 8000

# Terminal 2: Frontend
cd website/cortexmind-dashboard && npm run dev
```

### Running Tests

```bash
# Backend verification
python tests/verify_session.py

# Frontend tests
cd website/cortexmind-dashboard && npm test
```

### Building for Production

```bash
cd website/cortexmind-dashboard
npm run build    # → dist/
```

---

## Team

**Leptons** — Built for INSOS

---

## License

All rights reserved. This project is proprietary to Team Leptons.
