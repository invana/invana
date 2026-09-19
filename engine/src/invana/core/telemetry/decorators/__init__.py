"""
invana.telemetry.decorators
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Decorators for tracing and metrics instrumentation.

  @track()            Wrap a method in an OTel span (traces + duration metric).
  @capture_metrics()  Record domain-specific metrics per method call.

Typical usage
-------------
    from invana.core.telemetry.decorators import capture_metrics, track

    @track()
    @capture_metrics(domain="ontology", operation="create", resource="domain")
    async def create(self, **data): ...
"""

from invana.core.telemetry.decorators.capture_metrics import MetricDomain, capture_metrics
from invana.core.telemetry.decorators.track import track

__all__ = ["MetricDomain", "capture_metrics", "track"]
