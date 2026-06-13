"""Browser telemetry proxy (RFC-025).

The studio exports its OpenTelemetry spans over OTLP/HTTP (browsers can't speak
OTLP gRPC), and we keep the collector off the public network. This thin proxy
accepts the studio's span export and forwards it **verbatim** to the configured
collector — no parsing, so it stays agnostic to the OTLP encoding (protobuf or
JSON). Export failures are swallowed: telemetry must never surface as a
user-visible error.

Mounted only when ``settings.telemetry_enabled`` (see server/app.py) and
excluded from FastAPI auto-instrumentation (see telemetry/setup.py) so the proxy
never traces itself.
"""

from __future__ import annotations

import logging
from http import HTTPStatus

import httpx
from fastapi import APIRouter, Request, Response

from invana.settings import settings

logger = logging.getLogger("invana.telemetry")

telemetry_router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])

# A browser span batch is small; anything larger is misconfigured or abusive.
_MAX_BODY_BYTES = 1_000_000
_UPSTREAM_TIMEOUT_S = 5.0


@telemetry_router.post("/traces")
async def proxy_traces(request: Request) -> Response:
    """Forward an OTLP/HTTP span export to the collector."""
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
