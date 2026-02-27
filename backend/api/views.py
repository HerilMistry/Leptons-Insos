from datetime import datetime, timezone

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import Session
from api.serializers import (
    SessionStartRequestSerializer,
    SessionStartResponseSerializer,
    TelemetryRequestSerializer,
    TelemetryResponseSerializer,
    BrainMapResponseSerializer,
    NeuroExplainerResponseSerializer,
)
from ml_engine.state_model import compute_instability, compute_drift, compute_fatigue
from ml_engine.temporal_dynamics import TemporalState
from ml_engine.drift_diffusion import update_conflict
from ml_engine.risk_model import compute_risk
from ml_engine.brain_mapper import get_brain_map
from ml_engine.neuro_explainer import generate_explanation
from mongo.connection import get_model_outputs_collection

User = get_user_model()

# In-memory store for per-session temporal state.
# In production this would be backed by a cache / DB.
_temporal_states: dict[str, TemporalState] = {}


class SessionStartView(APIView):
    """POST /api/session/start — create a new tracking session."""

    def post(self, request):
        ser = SessionStartRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user_id = ser.validated_data["user_id"]
        task_type = ser.validated_data["task_type"]

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": f"User {user_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        session = Session.objects.create(user=user, task_type=task_type)

        # Initialise temporal state for this session
        _temporal_states[str(session.id)] = TemporalState()

        out = SessionStartResponseSerializer(
            {"session_id": session.id, "message": "Session started"}
        )
        return Response(out.data, status=status.HTTP_201_CREATED)


class TelemetryView(APIView):
    """POST /api/telemetry — accept feature vector, run inference, persist."""

    def post(self, request):
        ser = TelemetryRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        session_id = str(ser.validated_data["session_id"])
        features = ser.validated_data["features"]

        # --- Validate session exists ---
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {"error": f"Session {session_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # --- Compute cognitive state metrics ---
        I = compute_instability(
            features["switch_rate"],
            features["typing_interval_var"],
            features["mouse_velocity_var"],
        )
        D = compute_drift(
            features["idle_density"],
            features["scroll_reversal_ratio"],
        )
        F = compute_fatigue(features["duration_norm"])

        # --- Temporal dynamics ---
        ts = _temporal_states.setdefault(session_id, TemporalState())
        network = ts.update(I, D, F)

        # --- Drift-diffusion (accumulated conflict) ---
        A_next, breakdown = update_conflict(ts.A, I, network["ECN"])
        ts.A = A_next

        # --- Risk ---
        risk = compute_risk(I, D, F)

        # --- Update session aggregate metrics ---
        n = session.switch_count + 1
        session.avg_instability = (
            (session.avg_instability * session.switch_count + I) / n
        )
        session.avg_drift = (
            (session.avg_drift * session.switch_count + D) / n
        )
        session.avg_fatigue = (
            (session.avg_fatigue * session.switch_count + F) / n
        )
        session.switch_count = n
        session.save(
            update_fields=[
                "avg_instability",
                "avg_drift",
                "avg_fatigue",
                "switch_count",
            ]
        )

        # --- Persist to MongoDB ---
        doc = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc),
            "I": I,
            "D": D,
            "F": F,
            "ECN": network["ECN"],
            "DMN": network["DMN"],
            "Salience": network["Salience"],
            "Load": network["Load"],
            "risk": risk,
            "accumulated_conflict": A_next,
        }
        get_model_outputs_collection().insert_one(doc)

        # --- Response ---
        payload = {
            "instability": I,
            "drift": D,
            "fatigue": F,
            "risk": risk,
            "accumulated_conflict": A_next,
            "breakdown_imminent": breakdown,
            "network": network,
        }
        out = TelemetryResponseSerializer(payload)
        return Response(out.data, status=status.HTTP_200_OK)

class BrainMapView(APIView):
    """GET /api/brain-map/<session_id> — get brain region activation map."""

    def get(self, request, session_id):
        # Validate session exists
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {"error": f"Session {session_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Generate brain map
        brain_map = get_brain_map(session_id)

        out = BrainMapResponseSerializer(brain_map)
        return Response(out.data, status=status.HTTP_200_OK)


class NeuroExplainerView(APIView):
    """GET /api/brain-explainer/<session_id> — get cognitive state explanation."""

    def get(self, request, session_id):
        # Validate session exists
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(
                {"error": f"Session {session_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get brain map for context (optional optimization)
        brain_map = get_brain_map(session_id)

        # Generate explanation
        explanation = generate_explanation(session_id, brain_map=brain_map)

        out = NeuroExplainerResponseSerializer(explanation)
        return Response(out.data, status=status.HTTP_200_OK)