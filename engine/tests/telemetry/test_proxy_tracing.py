"""The browser telemetry proxy does not trace its own forward to the collector.

Outgoing httpx calls are instrumented on a local ``TracerProvider`` with an
in-memory exporter. A plain call records a client span — so the instrumentation
is live — while the proxy's forward records none. Real ASGI, real httpx; nothing
listens on the collector port, so the proxy drops the batch with a 202.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind

from invana.core.settings import settings
from invana.server.routes.telemetry import telemetry_router

pytestmark = pytest.mark.asyncio

# Nothing listens here: every call fails fast with a connection error.
_CLOSED_PORT_URL = "http://127.0.0.1:9/v1/traces"


@pytest.fixture
def exporter():
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    instrumentor = HTTPXClientInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    try:
        yield exp
    finally:
        instrumentor.uninstrument()


def _client_spans(exp: InMemorySpanExporter) -> list:
    return [s for s in exp.get_finished_spans() if s.kind == SpanKind.CLIENT]


async def test_plain_httpx_call_is_a_client_span(exporter):
    async with httpx.AsyncClient(timeout=2.0) as client:
        with pytest.raises(httpx.HTTPError):
            await client.post(_CLOSED_PORT_URL, content=b"{}")

    assert len(_client_spans(exporter)) == 1


async def test_proxy_forward_is_not_traced(exporter, monkeypatch):
    monkeypatch.setattr(settings, "telemetry_enabled", True)
    monkeypatch.setattr(settings, "telemetry_otlp_http_endpoint", _CLOSED_PORT_URL)
    app = FastAPI()
    app.include_router(telemetry_router)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/telemetry/traces",
            content=b'{"resourceSpans":[]}',
            headers={"content-type": "application/json"},
        )

    assert response.status_code == 202
    assert _client_spans(exporter) == []
