"""Browser telemetry proxy (docs/for-developers/modules/platform/features/telemetry.md).

The studio exports its OpenTelemetry spans over OTLP/HTTP (browsers can't speak
OTLP gRPC), and we keep the collector off the public network. This thin proxy
accepts the studio's span export and forwards it **verbatim** to the configured
collector — no parsing, so it stays agnostic to the OTLP encoding (protobuf or
JSON). Export failures are swallowed: telemetry must never surface as a
user-visible error.

Always mounted (see server/app.py) and excluded from FastAPI
auto-instrumentation (see core/telemetry/setup.py) so the proxy never traces itself.
With ``settings.telemetry_enabled`` off there is nothing to forward to, so the
batch is accepted and dropped — the studio runs on its own gate, and a missing
route would answer every batch with a 404 the browser console reports as an
error (TE6).
"""

from __future__ import annotations

import logging
from http import HTTPStatus

import httpx
from fastapi import APIRouter, Request, Response

from invana.core.settings import settings

logger = logging.getLogger("invana.telemetry")

telemetry_router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])

# A browser span batch is small; anything larger is misconfigured or abusive.
_MAX_BODY_BYTES = 1_000_000
_UPSTREAM_TIMEOUT_S = 5.0


@telemetry_router.post("/traces")
async def proxy_traces(request: Request) -> Response:
    """Forward an OTLP/HTTP span export to the collector."""
    if not settings.telemetry_enabled:
        # No collector behind this engine — take the batch and drop it, rather
        # than 404 a studio whose own gate is still on (TE6).
        return Response(status_code=HTTPStatus.ACCEPTED)

    body = await request.body()
    if len(body) > _MAX_BODY_BYTES:
        return Response(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE)

    content_type = request.headers.get("content-type", "application/x-protobuf")
    try:
        async with httpx.AsyncClient(timeout=_UPSTREAM_TIMEOUT_S) as client:
            upstream = await client.post(
                settings.telemetry_otlp_http_endpoint,
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
