"""Browser telemetry proxy (docs/for-developers/modules/platform/features/telemetry.md).

The studio exports its OpenTelemetry spans and metrics over OTLP/HTTP (browsers
can't speak OTLP gRPC), and we keep the collector off the public network. This
thin proxy accepts the studio's export and forwards it **verbatim** to the
configured collector — no parsing, so it stays agnostic to the OTLP encoding
(protobuf or JSON). Export failures are swallowed: telemetry must never surface
as a user-visible error.

Routes
------
  POST /api/v1/telemetry/traces    →  <base>/v1/traces
  POST /api/v1/telemetry/metrics   →  <base>/v1/metrics

``<base>`` is ``settings.telemetry_otlp_http_endpoint``, the collector's
OTLP/HTTP base URL. A value that still ends in ``/v1/traces`` is read as its
base, so an environment written for a traces-only proxy keeps working (see
``collector_url``). Both routes share one forward and behave the same way:

- ``settings.telemetry_enabled`` off: there is nothing to forward to, so the
  batch is accepted and dropped (202) — the studio runs on its own gate, and a
  missing route would answer every batch with a 404 the browser console reports
  as an error.
- A body over ``_MAX_BODY_BYTES`` is refused with 413; a browser batch is small,
  and anything larger is misconfigured or abusive.
- The collector unreachable: the batch is dropped with a 202.
- Otherwise the collector's own status and body are passed back.

Always mounted (see server/app.py) and skipped by TelemetryMiddleware (see
core/telemetry/middleware.py) so the proxy never traces itself. Its own forward
to the collector is not traced either: it runs with instrumentation suppressed,
or the httpx instrumentation would turn every browser batch into a root span of
its own — telemetry about shipping telemetry.
"""

from __future__ import annotations

import logging
from contextlib import nullcontext
from http import HTTPStatus

import httpx
from fastapi import APIRouter, Request, Response

from invana.core.settings import settings

try:
    from opentelemetry.instrumentation.utils import suppress_instrumentation
except ImportError:  # telemetry extra not installed — nothing to suppress
    suppress_instrumentation = nullcontext

logger = logging.getLogger("invana.telemetry")

telemetry_router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])

# A browser span batch is small; anything larger is misconfigured or abusive.
_MAX_BODY_BYTES = 1_000_000
_UPSTREAM_TIMEOUT_S = 5.0


def collector_url(signal: str) -> str:
    """The collector URL for one OTLP signal (``traces`` · ``metrics``).

    Joins ``/v1/<signal>`` onto the configured base, after dropping a trailing
    slash and a trailing ``/v1/traces`` so a full traces URL is read as its base.
    """
    base = settings.telemetry_otlp_http_endpoint.rstrip("/").removesuffix("/v1/traces")
    return f"{base}/v1/{signal}"


async def _forward(request: Request, signal: str) -> Response:
    """Forward the request body to the collector's endpoint for *signal*.

    Returns 202 without forwarding when telemetry is off or the collector cannot
    be reached, 413 for an oversized body, and the collector's own response
    otherwise. The forward runs with instrumentation suppressed.
    """
    if not settings.telemetry_enabled:
        # No collector behind this engine — take the batch and drop it, rather
        # than 404 a studio whose own gate is still on.
        return Response(status_code=HTTPStatus.ACCEPTED)

    body = await request.body()
    if len(body) > _MAX_BODY_BYTES:
        return Response(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE)

    content_type = request.headers.get("content-type", "application/x-protobuf")
    try:
        with suppress_instrumentation():
            async with httpx.AsyncClient(timeout=_UPSTREAM_TIMEOUT_S) as client:
                upstream = await client.post(
                    collector_url(signal),
                    content=body,
                    headers={"content-type": content_type},
                )
    except httpx.HTTPError as exc:
        # Collector down / unreachable — drop the batch rather than fail the page.
        logger.warning("Telemetry proxy: collector unreachable — %s", exc)
        return Response(status_code=HTTPStatus.ACCEPTED)

    return Response(
        status_code=upstream.status_code,
        content=upstream.content,
        media_type=upstream.headers.get("content-type"),
    )


@telemetry_router.post("/traces")
async def proxy_traces(request: Request) -> Response:
    """Forward an OTLP/HTTP span export to the collector."""
    return await _forward(request, "traces")


@telemetry_router.post("/metrics")
async def proxy_metrics(request: Request) -> Response:
    """Forward an OTLP/HTTP metric export to the collector."""
    return await _forward(request, "metrics")
