import uuid

from django.conf import settings
from django.db import models


class Session(models.Model):
    """Represents a user work session tracked by CortexFlow."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    task_type = models.CharField(max_length=64)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)

    # Aggregated metrics (updated over the life of the session)
    avg_instability = models.FloatField(default=0.0)
    avg_drift = models.FloatField(default=0.0)
    avg_fatigue = models.FloatField(default=0.0)
    switch_count = models.IntegerField(default=0)

    # Deep work tracking — a "window" is a single telemetry tick (~5 s)
    total_windows = models.IntegerField(default=0)
    deep_work_windows = models.IntegerField(default=0)

    @property
    def deep_work_ratio(self):
        """Fraction of telemetry windows where user was in deep work (instability < 0.5)."""
        if self.total_windows == 0:
            return 0.0
        return self.deep_work_windows / self.total_windows

    class Meta:
        ordering = ["-start_time"]

    def __str__(self):
        return f"Session {self.id} — {self.task_type}"
