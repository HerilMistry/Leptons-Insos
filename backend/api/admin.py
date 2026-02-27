from django.contrib import admin

from api.models import Session

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "task_type", "start_time", "switch_count")
    list_filter = ("task_type",)
    readonly_fields = ("id", "start_time")
