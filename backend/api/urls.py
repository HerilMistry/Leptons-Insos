from django.urls import path

from api.views import SessionStartView, TelemetryView

urlpatterns = [
    path("session/start", SessionStartView.as_view(), name="session-start"),
    path("telemetry", TelemetryView.as_view(), name="telemetry"),
]
