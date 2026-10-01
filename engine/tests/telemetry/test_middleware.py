"""TelemetryMiddleware tests: credentials never reach a span, the proxy is not traced,
the caller's trace context is adopted from the header or, failing that, the URL,
and every request is one HTTP semantic-convention sample on its route template.

A tiny Starlette app is wrapped in the real middleware and driven over ASGI with
httpx. The middleware's tracer is pointed at a local provider that keeps spans in
memory, so the test reads exactly what would have been exported; the metric test
points the middleware's HTTP instruments at a local provider the same way.
"""

from __future__ import annotations

import httpx
import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from invana.core.telemetry import middleware as _mw
from invana.core.telemetry.middleware import TelemetryMiddleware


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(_mw, "tracer", provider.get_tracer("test.invana.api"))
    return exp


def _app() -> TelemetryMiddleware:
    async def ok(request):
        return PlainTextResponse("ok")

    routes = [
        Route("/x", ok),
        Route("/api/v1/telemetry/traces", ok, methods=["POST"]),
    ]
    return TelemetryMiddleware(Starlette(routes=routes))


async def _request(method: str, url: str, headers: dict[str, str] | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, url, headers=headers)


async def test_token_query_param_is_not_recorded(exporter: InMemorySpanExporter) -> None:
    """The auth token in the URL is stripped; other query params are kept."""
    res = await _request("GET", "/x?token=secret&after=3")
    assert res.status_code == 200

    (span,) = exporter.get_finished_spans()
    values = [str(v) for v in span.attributes.values()]
    assert not any("secret" in v for v in values)
    assert "after=3" in span.attributes["http.url"]
    assert "after" in span.attributes["http.query_params"]


async def test_telemetry_proxy_is_not_traced(exporter: InMemorySpanExporter) -> None:
    """Shipping browser spans through the proxy produces no span of its own."""
    res = await _request("POST", "/api/v1/telemetry/traces")
    assert res.status_code == 200
    assert exporter.get_finished_spans() == ()


_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
_SPAN_ID = "00f067aa0ba902b7"


async def test_traceparent_query_param_parents_the_span(exporter: InMemorySpanExporter) -> None:
    """With no header, the traceparent query parameter a stream carries becomes the parent."""
    res = await _request("GET", f"/x?traceparent=00-{_TRACE_ID}-{_SPAN_ID}-01")
    assert res.status_code == 200

    (span,) = exporter.get_finished_spans()
    assert span.context.trace_id == int(_TRACE_ID, 16)
    assert span.parent is not None
    assert span.parent.span_id == int(_SPAN_ID, 16)


async def test_traceparent_header_wins_over_query_param(exporter: InMemorySpanExporter) -> None:
    """When both are sent, the header's trace context is the one adopted."""
    header_trace = "0af7651916cd43dd8448eb211c80319c"
    res = await _request(
        "GET",
        f"/x?traceparent=00-{_TRACE_ID}-{_SPAN_ID}-01",
        headers={"traceparent": f"00-{header_trace}-b7ad6b7169203331-01"},
    )
    assert res.status_code == 200

    (span,) = exporter.get_finished_spans()
    assert span.context.trace_id == int(header_trace, 16)


async def test_request_records_duration_on_the_route_template(exporter, monkeypatch) -> None:
    """The duration and active-request samples carry the route template, never the raw path."""
    reader = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[reader]).get_meter("test.invana.api")
    monkeypatch.setattr(_mw, "http_server_duration", meter.create_histogram("http.server.request.duration"))
    monkeypatch.setattr(_mw, "http_server_active", meter.create_up_down_counter("http.server.active_requests"))

    async def ok(request):
        return PlainTextResponse("ok")

    app = Starlette(routes=[Route("/runs/{run_id}", ok)], middleware=[Middleware(TelemetryMiddleware)])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/runs/r-123")).status_code == 200

    points = {
        m.name: list(m.data.data_points)
        for rm in reader.get_metrics_data().resource_metrics
        for sm in rm.scope_metrics
        for m in sm.metrics
    }
    (duration,) = points["http.server.request.duration"]
    assert dict(duration.attributes) == {
        "http.request.method": "GET",
        "http.route": "/runs/{run_id}",
        "http.response.status_code": 200,
    }
    assert duration.count == 1
    (active,) = points["http.server.active_requests"]
    assert active.attributes["http.route"] == "/runs/{run_id}"
    assert active.value == 0
