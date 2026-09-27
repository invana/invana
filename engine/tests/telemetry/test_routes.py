"""Browser-span proxy tests (docs/for-developers/modules/platform/features/telemetry.md TE6).

The studio exports its spans, metrics and error logs on its own gate, so the proxy is
always mounted: with the engine's telemetry off it takes the batch and drops it
(202) rather than 404-ing a browser that is still exporting. Each signal is
forwarded to ``/v1/<signal>`` under the collector's base URL, and a setting
that still names the traces URL is read as its base. Real ASGI, real httpx —
the only thing absent is a collector, which is the point of the posting cases.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from invana.core.settings import settings
from invana.server.app import create_app
from invana.server.routes.telemetry import collector_url, telemetry_router

TRACES_URL = "/api/v1/telemetry/traces"
METRICS_URL = "/api/v1/telemetry/metrics"
LOGS_URL = "/api/v1/telemetry/logs"


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(telemetry_router)
    return app


async def _post(app: FastAPI, url: str = TRACES_URL, content: bytes = b'{"resourceSpans":[]}') -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(url, content=content, headers={"content-type": "application/json"})


@pytest.mark.asyncio
async def test_traces_accepted_and_dropped_when_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    response = await _post(_app())

    assert response.status_code == 202
    assert response.content == b""


@pytest.mark.asyncio
async def test_metrics_accepted_and_dropped_when_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    response = await _post(_app(), METRICS_URL)

    assert response.status_code == 202
    assert response.content == b""


@pytest.mark.asyncio
async def test_logs_accepted_and_dropped_when_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    response = await _post(_app(), LOGS_URL)

    assert response.status_code == 202


@pytest.mark.asyncio
async def test_an_oversized_log_batch_is_refused(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", True)

    response = await _post(_app(), LOGS_URL, content=b"x" * 1_000_001)

    assert response.status_code == 413


@pytest.mark.parametrize("base", ["http://collector:4318", "http://collector:4318/", "http://collector:4318/v1/traces"])
def test_each_signal_joins_onto_the_base_even_from_a_traces_url(monkeypatch, base):
    monkeypatch.setattr(settings, "telemetry_otlp_http_endpoint", base)

    assert collector_url("traces") == "http://collector:4318/v1/traces"
    assert collector_url("metrics") == "http://collector:4318/v1/metrics"
    assert collector_url("logs") == "http://collector:4318/v1/logs"


@pytest.mark.asyncio
async def test_traces_accepted_when_collector_unreachable(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", True)
    # Nothing listens on port 1 — the batch is dropped, never surfaced as an error.
    monkeypatch.setattr(settings, "telemetry_otlp_http_endpoint", "http://127.0.0.1:1")

    response = await _post(_app())

    assert response.status_code == 202


def test_proxy_is_mounted_with_telemetry_off(monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", False)

    app = create_app()

    assert {TRACES_URL, METRICS_URL, LOGS_URL} <= {getattr(route, "path", None) for route in app.routes}
