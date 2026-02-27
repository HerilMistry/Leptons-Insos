from rest_framework import serializers


# ---------------------------------------------------------------------------
# POST /api/session/start
# ---------------------------------------------------------------------------

class SessionStartRequestSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    task_type = serializers.CharField(max_length=64)


class SessionStartResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    message = serializers.CharField()


# ---------------------------------------------------------------------------
# POST /api/telemetry
# ---------------------------------------------------------------------------

class TelemetryFeaturesSerializer(serializers.Serializer):
    """
    Fields match the Chrome extension (content/telemetry.js) and
    the CortexEngine.infer() telemetry parameter (cortex_core/engine.py).
    """
    switch_rate          = serializers.FloatField(default=0.0)
    motor_var            = serializers.FloatField(default=0.0)
    distractor_attempts  = serializers.IntegerField(default=0)
    idle_ratio           = serializers.FloatField(default=0.0)
    scroll_entropy       = serializers.FloatField(default=0.0)
    passive_playback     = serializers.FloatField(default=0.0)
    # Legacy / optional fields kept for backward compatibility
    idle_density         = serializers.FloatField(required=False, default=0.0)
    scroll_reversal_ratio = serializers.FloatField(required=False, default=0.0)
    typing_interval_var  = serializers.FloatField(required=False, default=0.0)
    mouse_velocity_var   = serializers.FloatField(required=False, default=0.0)
    duration_norm        = serializers.FloatField(required=False, default=0.0)


class TelemetryRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    features   = TelemetryFeaturesSerializer()
    # Optional metadata fields from extension / test clients
    task_type    = serializers.CharField(max_length=64, required=False)
    duration_norm = serializers.FloatField(required=False)


class NetworkSerializer(serializers.Serializer):
    ECN = serializers.FloatField()
    DMN = serializers.FloatField()
    Salience = serializers.FloatField()
    Load = serializers.FloatField()


class TelemetryResponseSerializer(serializers.Serializer):
    instability           = serializers.FloatField()
    drift                 = serializers.FloatField()
    fatigue               = serializers.FloatField()
    risk                  = serializers.FloatField()
    accumulated_conflict  = serializers.FloatField()
    breakdown_imminent    = serializers.BooleanField()
    breakdown_probability = serializers.FloatField()
    attribution           = serializers.DictField(child=serializers.FloatField())
    network               = NetworkSerializer()
