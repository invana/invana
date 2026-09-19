"""Browser-span proxy tests (docs/for-developers/modules/platform/features/telemetry.md TE6).

The studio exports its spans on its own gate, so the proxy is always mounted:
with the engine's telemetry off it takes the batch and drops it (202) rather
than 404-ing a browser that is still exporting. Real ASGI, real httpx — the
only thing absent is a collector, which is the point of both cases.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from invana.core.settings import settings
from invana.server.app import create_app
from invana.server.routes.telemetry import telemetry_router

TRACES_URL = "/api/v1/telemetry/traces"


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(telemetry_router)
    return app


async def _post(app: FastAPI) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(
            TRACES_URL,
            content=b'{"resourceSpans":[]}',
            headers={"content-type": "application/json"},
        )


@pytest.mark.asyncio
async def test_traces_accepted_and_dropped_when_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    response = await _post(_app())

    assert response.status_code == 202
    assert response.content == b""


@pytest.mark.asyncio
async def test_traces_accepted_when_collector_unreachable(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", True)
    # Nothing listens on port 1 — the batch is dropped, never surfaced as an error.
    monkeypatch.setattr(settings, "telemetry_otlp_http_endpoint", "http://127.0.0.1:1/v1/traces")

    response = await _post(_app())

    assert response.status_code == 202


def test_proxy_is_mounted_with_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    app = create_app()

    assert TRACES_URL in {getattr(route, "path", None) for route in app.routes}
