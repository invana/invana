"""Each 5xx is one ERROR line on its route template — with the trace when telemetry is on.

A small FastAPI app is wrapped in the real middleware the server mounts —
``CatchAllExceptionMiddleware`` always, ``TelemetryMiddleware`` inside it when
telemetry is on — and driven over ASGI with httpx. Spans go to an in-memory
exporter; ``TraceContextFilter`` on the capture handler stamps the trace ids a
real handler would.
"""

from __future__ import annotations

import logging

import httpx
import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.core.logging.filters import TraceContextFilter
from invana.core.telemetry import middleware as _mw
from invana.core.telemetry.middleware import TelemetryMiddleware
from invana.server.middleware import CatchAllExceptionMiddleware

pytestmark = pytest.mark.asyncio


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(_mw, "tracer", provider.get_tracer("test.invana.api"))
    return exp


@pytest.fixture
def errors(caplog):
    caplog.handler.addFilter(TraceContextFilter())
    caplog.set_level(logging.DEBUG, logger="invana.api")
    return lambda: [r for r in caplog.records if r.levelno >= logging.ERROR]


async def _get(path: str, *, telemetry: bool) -> httpx.Response:
    app = FastAPI()

    @app.get("/runs/{run_id}")
    async def boom(run_id: str):
        raise RuntimeError("the graph went away")

    @app.get("/busy/{run_id}")
    async def busy(run_id: str):
        return JSONResponse({"detail": "busy"}, status_code=503)

    if telemetry:
        app.add_middleware(TelemetryMiddleware)
    app.add_middleware(CatchAllExceptionMiddleware)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        return await client.get(path)


async def test_a_raised_error_is_one_line_on_its_route_and_trace(exporter, errors) -> None:
    res = await _get("/runs/r-123?secret=x", telemetry=True)

    assert res.status_code == 500
    (record,) = errors()
    assert record.__dict__["http.route"] == "/runs/{run_id}"
    assert record.__dict__["http.status_code"] == 500
    assert record.exc_info
    assert "r-123" not in record.getMessage() and "secret" not in record.getMessage()
    (span,) = exporter.get_finished_spans()
    assert record.trace_id == format(span.context.trace_id, "032x")
    assert record.principal == "anonymous" and record.origin == "api"


@pytest.mark.parametrize("path", ["/runs/r-1", "/busy/r-1"])
async def test_a_5xx_is_logged_once_with_telemetry_off(errors, path) -> None:
    res = await _get(path, telemetry=False)

    assert res.status_code >= 500
    (record,) = errors()
    assert record.__dict__["http.route"] == path.replace("r-1", "{run_id}")


async def test_a_returned_5xx_is_logged_once_with_telemetry_on(exporter, errors) -> None:
    res = await _get("/busy/r-1", telemetry=True)

    assert res.status_code == 503
    (record,) = errors()
    assert not record.exc_info
    assert record.trace_id


async def test_a_404_is_not_an_error(exporter, errors) -> None:
    res = await _get("/nowhere/r-1", telemetry=True)

    assert res.status_code == 404
    assert errors() == []
