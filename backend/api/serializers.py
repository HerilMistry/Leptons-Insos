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
    switch_rate = serializers.FloatField()
    idle_density = serializers.FloatField()
    scroll_reversal_ratio = serializers.FloatField()
    typing_interval_var = serializers.FloatField()
    mouse_velocity_var = serializers.FloatField()
    duration_norm = serializers.FloatField()


class TelemetryRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    features = TelemetryFeaturesSerializer()


class NetworkSerializer(serializers.Serializer):
    ECN = serializers.FloatField()
    DMN = serializers.FloatField()
    Salience = serializers.FloatField()
    Load = serializers.FloatField()


class TelemetryResponseSerializer(serializers.Serializer):
    instability = serializers.FloatField()
    drift = serializers.FloatField()
    fatigue = serializers.FloatField()
    risk = serializers.FloatField()
    accumulated_conflict = serializers.FloatField()
    breakdown_imminent = serializers.BooleanField()
    network = NetworkSerializer()

# ---------------------------------------------------------------------------
# GET /api/brain-map/<session_id>
# ---------------------------------------------------------------------------


class BrainRegionSerializer(serializers.Serializer):
    activation = serializers.FloatField()
    color = serializers.CharField()
    meaning = serializers.CharField(required=False)


class BrainRegionsMapSerializer(serializers.Serializer):
    DLPFC = BrainRegionSerializer()
    ACC = BrainRegionSerializer()
    Insula = BrainRegionSerializer()
    PCC = BrainRegionSerializer()
    mPFC = BrainRegionSerializer()
    BasalGanglia = BrainRegionSerializer()


class BrainMapMetadataSerializer(serializers.Serializer):
    data_points = serializers.IntegerField()
    time_window_minutes = serializers.IntegerField()
    timestamp = serializers.CharField()
    note = serializers.CharField(required=False)
    averages = serializers.DictField(required=False)


class BrainMapResponseSerializer(serializers.Serializer):
    brain_regions = BrainRegionsMapSerializer()
    metadata = BrainMapMetadataSerializer()


# ---------------------------------------------------------------------------
# GET /api/brain-explainer/<session_id>
# ---------------------------------------------------------------------------

class NeuroExplainerMetadataSerializer(serializers.Serializer):
    data_points = serializers.IntegerField()
    timestamp = serializers.CharField()
    error = serializers.BooleanField(required=False)
    metrics_used = serializers.DictField(required=False)


class NeuroExplainerResponseSerializer(serializers.Serializer):
    explanation = serializers.CharField()
    metadata = NeuroExplainerMetadataSerializer()