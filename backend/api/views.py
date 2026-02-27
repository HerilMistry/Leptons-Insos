from datetime import datetime, timezone

from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import Session
from api.serializers import (
    SessionStartRequestSerializer,
    SessionStartResponseSerializer,
    TelemetryRequestSerializer,
    TelemetryResponseSerializer,
)
from cortex_core.engine import CortexEngine
from mongo.connection import get_model_outputs_collection

User = get_user_model()

# In-memory store for per-session CortexEngine instances.
# State persists across telemetry calls for the same session.
_session_engines: dict[str, CortexEngine] = {}


def _jwt_response(user):
    """Return {access, refresh, user} dict for a given User instance."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": str(user.pk),
            "email": user.email,
            "name": user.get_full_name() or user.username,
        },
    }


class RegisterView(APIView):
    """POST /api/auth/register/ — create account and return JWT tokens."""

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")
        name = request.data.get("name", "").strip()

        if not email or not password:
            return Response(
                {"detail": "email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "A user with that email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Split name into first/last for Django's User model
        parts = name.split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        return Response(_jwt_response(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/ — authenticate and return JWT tokens."""

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"detail": "email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Django's authenticate uses username field; email is stored as username
        user = authenticate(request, username=email, password=password)
        if user is None:
            # Try looking up by email in case username differs
            try:
                db_user = User.objects.get(email=email)
                user = authenticate(request, username=db_user.username, password=password)
            except User.DoesNotExist:
                user = None

        if user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(_jwt_response(user), status=status.HTTP_200_OK)


class LogoutView(APIView):
    """POST /api/auth/logout/ — stateless JWT; just acknowledge."""

    def post(self, request):
        # Optionally blacklist refresh token if simplejwt blacklist app is enabled
        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class SessionStartView(APIView):
    """POST /api/session/start/ or /api/sessions/start/ — create a new tracking session.

    Accepts user_id in the body (extension/integration-test) OR extracts the
    authenticated user from the JWT Bearer token (website).
    """

    def post(self, request):
        # --- Resolve user ---
        user = None

        # 1. JWT authenticated user (website flow)
        if request.user and request.user.is_authenticated:
            user = request.user

        # 2. Explicit user_id in body (extension / integration test flow)
        if user is None:
            user_id = request.data.get("user_id")
            if user_id:
                try:
                    user = User.objects.get(pk=user_id)
                except User.DoesNotExist:
                    return Response(
                        {"error": f"User {user_id} not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

        if user is None:
            return Response(
                {"error": "Authentication required. Send a Bearer token or user_id."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        task_type = request.data.get("task_type", "general")

        session = Session.objects.create(user=user, task_type=task_type)

        # Initialise CortexEngine for this session
        _session_engines[str(session.id)] = CortexEngine(
            model_path='models/baseline_model.joblib'
        )

        return Response(
            {
                "session_id": str(session.id),
                "message": "Session started",
                "baseline_profile": {"ECN": 0.72, "DMN": 0.28, "Salience": 0.5, "Load": 0.6},
            },
            status=status.HTTP_201_CREATED,
        )


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

        # --- Compute session duration ---
        session_duration_sec = (
            datetime.now(timezone.utc) - session.start_time
        ).total_seconds()

        # --- Derive engine input signals from telemetry ---
        idle_ratio = features.get("idle_ratio", 0)
        task_engagement = max(0.0, 1.0 - idle_ratio)
        switch_pressure = features.get("switch_rate", 0)

        # --- Get or create CortexEngine for this session ---
        engine = _session_engines.get(session_id)
        if engine is None:
            engine = CortexEngine(model_path='models/baseline_model.joblib')
            _session_engines[session_id] = engine

        # --- Run unified inference ---
        result = engine.infer(
            telemetry=features,
            session_duration_sec=session_duration_sec,
            task_engagement=task_engagement,
            idle_signal=idle_ratio,
            switch_pressure=switch_pressure,
        )

        # --- Update session aggregate metrics ---
        I = result["instability"]
        D = result["drift"]
        F = result["fatigue"]
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

        # --- Persist to MongoDB (non-fatal — requires MongoDB running) ---
        try:
            doc = {
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc),
                **result,
            }
            get_model_outputs_collection().insert_one(doc)
        except Exception as mongo_err:
            # MongoDB may not be running in dev/test environments; log and continue.
            import logging
            logging.getLogger(__name__).warning("MongoDB write skipped: %s", mongo_err)

        # --- Response ---
        out = TelemetryResponseSerializer(result)
        return Response(out.data, status=status.HTTP_200_OK)


class SessionStopView(APIView):
    """POST /api/sessions/stop/ — mark a session as ended."""

    def post(self, request):
        session_id = request.data.get("session_id")
        if not session_id:
            return Response(
                {"error": "session_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session = Session.objects.get(pk=session_id)
            session.end_time = datetime.now(timezone.utc)
            session.save(update_fields=["end_time"])
            _session_engines.pop(str(session_id), None)
        except Session.DoesNotExist:
            pass  # Idempotent — already gone is fine
        except Exception:
            # Catches invalid UUID format or any other lookup error — treat as
            # already-stopped (idempotent) so the website can clean up locally.
            pass
        return Response({"detail": "Session stopped."}, status=status.HTTP_200_OK)


class SessionHistoryView(APIView):
    """GET /api/sessions/history/ — return all sessions for the authenticated user."""

    def get(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response([], status=status.HTTP_200_OK)

        sessions = Session.objects.filter(user=user).order_by("-start_time")[:50]
        data = [
            {
                "id": str(s.id),
                "task_type": s.task_type,
                "task_label": s.task_type,  # use task_type as label fallback
                "started_at": s.start_time.isoformat(),
                "ended_at": s.end_time.isoformat() if s.end_time else None,
                "duration_minutes": (
                    int((s.end_time - s.start_time).total_seconds() / 60)
                    if s.end_time else None
                ),
                "avg_instability": round(s.avg_instability, 4),
                "switch_count": s.switch_count,
                "deep_work_ratio": round(max(0.0, 1.0 - s.avg_instability), 4),
            }
            for s in sessions
        ]
        return Response(data, status=status.HTTP_200_OK)


class SessionDetailView(APIView):
    """GET /api/sessions/<session_id>/detail/ — detailed session data."""

    def get(self, request, session_id):
        try:
            session = Session.objects.get(pk=session_id)
        except Exception:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        data = {
            "id": str(session.id),
            "task_type": session.task_type,
            "task_label": session.task_type,
            "started_at": session.start_time.isoformat(),
            "ended_at": session.end_time.isoformat() if session.end_time else None,
            "duration_minutes": (
                int((session.end_time - session.start_time).total_seconds() / 60)
                if session.end_time else None
            ),
            "avg_instability": round(session.avg_instability, 4),
            "avg_drift": round(session.avg_drift, 4),
            "avg_fatigue": round(session.avg_fatigue, 4),
            "switch_count": session.switch_count,
            "deep_work_ratio": round(max(0.0, 1.0 - session.avg_instability), 4),
        }
        return Response(data, status=status.HTTP_200_OK)


class DashboardAnalyticsView(APIView):
    """GET /api/dashboard/analytics/?session_id=<id> — aggregate analytics for a session."""

    def get(self, request):
        session_id = request.query_params.get("session_id")
        if not session_id:
            # No session — return empty analytics
            return Response(_empty_analytics(), status=status.HTTP_200_OK)

        try:
            session = Session.objects.get(pk=session_id)
        except Exception:
            return Response(_empty_analytics(), status=status.HTTP_200_OK)

        # Build a simple synthetic timeline from aggregate values
        # (Real per-tick data lives in MongoDB; this gives the dashboard something to show)
        import math
        n_points = max(1, session.switch_count)
        timeline = []
        for i in range(n_points):
            t = i / max(1, n_points - 1)  # 0..1
            timeline.append({
                "timestamp": session.start_time.isoformat(),
                "instability": round(session.avg_instability * (0.8 + 0.4 * math.sin(i)), 4),
                "drift": round(session.avg_drift * (0.9 + 0.2 * math.cos(i)), 4),
                "fatigue": round(session.avg_fatigue * (1.0 + 0.1 * t), 4),
            })

        analytics = {
            "timeline": timeline,
            "network_state": {"ECN": 0.72, "DMN": 0.28, "Salience": 0.5, "Load": 0.6},
            "deep_work_ratio": round(max(0.0, 1.0 - session.avg_instability), 4),
            "switch_count": session.switch_count,
            "avg_instability": round(session.avg_instability, 4),
            "interventions": [],
        }
        return Response(analytics, status=status.HTTP_200_OK)


def _empty_analytics():
    return {
        "timeline": [],
        "network_state": {"ECN": 0.72, "DMN": 0.28, "Salience": 0.5, "Load": 0.6},
        "deep_work_ratio": 0.0,
        "switch_count": 0,
        "avg_instability": 0.0,
        "interventions": [],
    }
