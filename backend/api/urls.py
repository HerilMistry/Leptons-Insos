from django.urls import path

from api.views import (
    ActiveSessionView,
    DashboardAnalyticsView,
    LoginView,
    LogoutView,
    RegisterView,
    SessionDetailView,
    SessionHistoryView,
    SessionLiveView,
    SessionStartView,
    SessionStopView,
    TelemetryView,
)

urlpatterns = [
    # Auth
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/",    LoginView.as_view(),    name="auth-login"),
    path("auth/logout/",   LogoutView.as_view(),   name="auth-logout"),

    # Session lifecycle
    path("session/start/",            SessionStartView.as_view(),   name="session-start"),
    path("sessions/start/",           SessionStartView.as_view(),   name="sessions-start"),
    path("sessions/stop/",            SessionStopView.as_view(),    name="sessions-stop"),
    path("session/end/",              SessionStopView.as_view(),    name="session-end"),
    path("sessions/history/",         SessionHistoryView.as_view(), name="sessions-history"),
    path("sessions/<str:session_id>/detail/", SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<str:session_id>/live/",   SessionLiveView.as_view(),   name="session-live"),

    # Active session lookup
    path("sessions/active/", ActiveSessionView.as_view(), name="sessions-active"),

    # Dashboard analytics
    path("dashboard/analytics/", DashboardAnalyticsView.as_view(), name="dashboard-analytics"),

    # Telemetry
    path("telemetry/", TelemetryView.as_view(), name="telemetry"),
    path("telemetry",  TelemetryView.as_view(), name="telemetry-noslash"),
]
