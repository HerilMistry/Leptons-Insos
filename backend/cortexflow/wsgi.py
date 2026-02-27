"""
WSGI config for CortexFlow project.
"""

import os
import sys

# Ensure repo root is on the path so cortex_core is importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cortexflow.settings")

application = get_wsgi_application()
