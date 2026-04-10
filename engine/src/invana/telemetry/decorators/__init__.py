"""
invana.telemetry.decorators
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Decorators for tracing and metrics instrumentation.

  @track()            Wrap a method in an OTel span (traces + duration metric).
  @capture_metrics()  Record domain-specific metrics per method call.

Typical usage
-------------
    from invana.telemetry.decorators import track, capture_metrics

    @track()
    @capture_metrics(domain="ontology", operation="create", resource="domain")
    async def create(self, **data): ...
"""

from invana.telemetry.decorators.capture_metrics import MetricDomain, capture_metrics
from invana.telemetry.decorators.track import track

__all__ = ["track", "capture_metrics", "MetricDomain"]
