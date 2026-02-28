"""
CortexFlow URL configuration.
"""

from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse


def health_check(request):
    """Simple health check endpoint for Render uptime monitoring."""
    return JsonResponse({"status": "ok", "service": "cortexflow-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("health/", health_check, name="health-check"),
]
