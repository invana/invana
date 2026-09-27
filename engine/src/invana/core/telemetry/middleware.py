"""
TelemetryMiddleware — records every HTTP request as a span + metrics + structured log.

Design note
-----------
This is a pure ASGI middleware (not BaseHTTPMiddleware). BaseHTTPMiddleware wraps
call_next in a new asyncio.Task, which forks the contextvars context. Any child span
created by @track() inside a route would then be orphaned from the HTTP request span.
The raw ASGI __call__ keeps the same task context throughout the request lifecycle,
so @track() spans nest correctly as children of the HTTP span.

Signals emitted per request
---------------------------
Traces:
  span name  = "METHOD /route/template"
  attributes = method, route, url, status, duration, client_ip, user-agent,
               request/response sizes, query params, error info on failure.
               The url and query params are recorded with credentials removed:
               a ``token`` query param (the auth token that WebSocket and
               EventSource clients must pass in the URL) never reaches a span.

Trace context
-------------
The caller's W3C trace context is taken from the ``traceparent`` (and
``tracestate``) header. When that header is absent, the ``traceparent`` and
``tracestate`` query parameters are used instead — EventSource cannot send
headers, so streams carry their trace context in the URL. The header always wins.

Skipped requests
----------------
Health, metrics, docs and favicon paths are not traced, nor is anything under
``/api/v1/telemetry/`` — that is the browser-span proxy, and tracing it would
make every shipped batch of spans produce another span.

Metrics:
  invana.api.request.duration     histogram  latency (ms)
  invana.api.request.size         histogram  request body bytes
  invana.api.response.size        histogram  response body bytes
  invana.api.request.count        counter    total requests
  invana.api.error.count          counter    4xx + 5xx errors
  invana.api.requests_in_flight   gauge      live concurrency
  invana.api.throughput.requests  counter    completed requests
  invana.api.throughput.bytes     counter    bytes sent
  invana.api.status.2xx/4xx/5xx  counters   status-code buckets

Logs:
  one structured INFO log per completed request, emitted inside the request
  span so the record carries its trace_id and links to the trace in the OTel
  backend.
"""

from __future__ import annotations

import logging
import time

from opentelemetry import trace
from opentelemetry.propagate import extract
from opentelemetry.trace import SpanKind, Status, StatusCode
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from invana.core.telemetry.metrics import (
    api_error_count,
    api_request_count,
    api_request_duration,
    api_request_size,
    api_requests_in_flight,
    api_response_size,
    api_status_2xx,
    api_status_4xx,
    api_status_5xx,
    api_throughput_bytes,
    api_throughput_requests,
)

logger = logging.getLogger("invana.api")
tracer = trace.get_tracer("invana.api")

_SKIP_PATHS = frozenset(
    {
        "/health",
        "/metrics",
        "/ping",
        "/favicon.ico",
        "/docs",
        "/redoc",
        "/openapi.json",
    }
)

# Path prefixes that are never traced (the browser-span proxy lives here).
_SKIP_PREFIXES = ("/api/v1/telemetry/",)

# Query params that carry credentials; stripped from every recorded URL.
_CREDENTIAL_PARAMS = frozenset({"token"})


class TelemetryMiddleware:
    """Pure ASGI middleware that instruments every HTTP request."""

    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        request = Request(scope, receive)

        path = request.url.path
        if path in _SKIP_PATHS or path.startswith(_SKIP_PREFIXES):
            await self._app(scope, receive, send)
            return

        method = scope["method"]
        client_ip = _get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        req_size = int(request.headers.get("content-length", 0))

        # Capture response status/size via a send wrapper.
        status_holder: list[int] = [200]
        res_size_holder: list[int] = [0]

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                status_holder[0] = message.get("status", 200)
                for k, v in message.get("headers", []):
                    if k.lower() == b"content-length":
                        res_size_holder[0] = int(v)
            await send(message)

        raw_path = scope.get("path", "/")
        span_name = f"{method} {raw_path}"

        # Adopt the caller's W3C `traceparent` so this request nests under the browser's
        # span; without one the SERVER span is a root. This middleware is the only request-span source.
        parent_ctx = extract(_trace_carrier(request))
        with tracer.start_as_current_span(span_name, context=parent_ctx, kind=SpanKind.SERVER) as span:
            _attach_request(span, request, raw_path, method, client_ip, user_agent, req_size)
            api_requests_in_flight.add(1, {"route": raw_path, "method": method})
            api_request_size.record(req_size, {"route": raw_path})
            start = time.perf_counter()

            try:
                await self._app(scope, receive, send_wrapper)
                duration_ms = (time.perf_counter() - start) * 1000
                status = status_holder[0]
                res_size = res_size_holder[0]

                # After routing, the matched route template is available in scope.
                route = _resolve_route_from_scope(scope) or raw_path
                if route != raw_path:
                    span.update_name(f"{method} {route}")
                    span.set_attribute("http.route", route)

                _attach_response(span, status, duration_ms, res_size)
                _record_metrics(route, method, status, duration_ms, res_size)

                logger.info(
                    "%s %s %s  %.2fms",
                    method,
                    route,
                    status,
                    duration_ms,
                    extra={
                        "http.method": method,
                        "http.route": route,
                        "http.status_code": status,
                        "http.duration_ms": round(duration_ms, 3),
                        "http.res_bytes": res_size,
                        "http.req_bytes": req_size,
                        "http.client_ip": client_ip,
                    },
                )

            except Exception as exc:
                duration_ms = (time.perf_counter() - start) * 1000
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
                span.set_attribute("invana.duration_ms", round(duration_ms, 3))
                span.set_attribute("invana.error.type", type(exc).__name__)
                span.set_attribute("invana.error.message", str(exc))
                api_error_count.add(1, {"route": raw_path, "method": method, "error": type(exc).__name__})
                api_status_5xx.add(1, {"route": raw_path, "method": method})
                logger.exception("%s %s 500  %.2fms  %s", method, raw_path, duration_ms, exc)
                raise

            finally:
                api_requests_in_flight.add(-1, {"route": raw_path, "method": method})


# ── helpers ───────────────────────────────────────────────────────────────────


def _record_metrics(route: str, method: str, status: int, duration_ms: float, res_size: int) -> None:
    labels = {"route": route, "method": method, "status_code": str(status)}
    api_request_duration.record(round(duration_ms, 3), labels)
    api_request_count.add(1, labels)
    api_response_size.record(res_size, {"route": route})
    api_throughput_requests.add(1, {"route": route, "method": method})
    api_throughput_bytes.add(res_size, {"route": route, "method": method})
    if status >= 500:
        api_status_5xx.add(1, {"route": route, "method": method})
        api_error_count.add(1, labels)
    elif status >= 400:
        api_status_4xx.add(1, {"route": route, "method": method})
        api_error_count.add(1, labels)
    else:
        api_status_2xx.add(1, {"route": route, "method": method})


def _attach_request(
    span: trace.Span,
    request: Request,
    route: str,
    method: str,
    client_ip: str,
    user_agent: str,
    req_size: int,
) -> None:
    span.set_attribute("http.method", method)
    span.set_attribute("http.route", route)
    span.set_attribute("http.url", str(request.url.remove_query_params(tuple(_CREDENTIAL_PARAMS))))
    span.set_attribute("http.client_ip", client_ip)
    span.set_attribute("http.user_agent", user_agent)
    span.set_attribute("http.request_size", req_size)
    span.set_attribute("invana.component", "api")
    params = {k: v for k, v in request.query_params.items() if k not in _CREDENTIAL_PARAMS}
    if params:
        span.set_attribute("http.query_params", str(params))


def _attach_response(span: trace.Span, status: int, duration_ms: float, res_size: int) -> None:
    span.set_attribute("http.status_code", status)
    span.set_attribute("http.response_size", res_size)
    span.set_attribute("invana.duration_ms", round(duration_ms, 3))
    if status >= 400:
        span.set_status(Status(StatusCode.ERROR, f"HTTP {status}"))
    else:
        span.set_status(Status(StatusCode.OK))


def _resolve_route_from_scope(scope: dict) -> str | None:
    """Return the matched route template from scope (set by Starlette after routing)."""
    route = scope.get("route")
    if route and hasattr(route, "path"):
        return route.path
    return None


def _trace_carrier(request: Request) -> dict[str, str]:
    """Headers as a propagation carrier; the trace context falls back to query params when the header is absent."""
    carrier = dict(request.headers)
    if "traceparent" not in carrier:
        for key in ("traceparent", "tracestate"):
            value = request.query_params.get(key)
            if value:
                carrier[key] = value
    return carrier


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
