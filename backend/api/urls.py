from django.urls import path

from api.views import (
    SessionStartView,
    TelemetryView,
    BrainMapView,
    NeuroExplainerView,
)

urlpatterns = [
    path("session/start", SessionStartView.as_view(), name="session-start"),
    path("telemetry", TelemetryView.as_view(), name="telemetry"),
    path("brain-map/<str:session_id>", BrainMapView.as_view(), name="brain-map"),
    path("brain-explainer/<str:session_id>", NeuroExplainerView.as_view(), name="brain-explainer"),
]