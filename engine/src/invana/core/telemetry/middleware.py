"""
TelemetryMiddleware — records every HTTP request as a span + metrics + structured log.

Design note
-----------
This is a pure ASGI middleware (not BaseHTTPMiddleware). BaseHTTPMiddleware wraps
call_next in a new asyncio.Task, which forks the contextvars context. Any child span
started inside a route would then be orphaned from the HTTP request span. The raw
ASGI __call__ keeps the same task context throughout the request lifecycle, so the
spans a route starts nest correctly as children of the HTTP span.

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

Metrics (OpenTelemetry HTTP semantic conventions, seconds):
  http.server.active_requests     up-down    http.request.method · http.route
  http.server.request.duration    histogram  http.request.method · http.route ·
                                             http.response.status_code

  ``http.route`` is always the matched route **template**
  (``/api/v1/u/{username}/{graph_slug}/runs/{run_id}``), never the raw path, so
  the attribute stays bounded. The template is resolved against the app's routes
  before the request runs, so the +1 and the -1 on the active count carry the
  same attributes; a request no route matches is recorded as ``unmatched``. A
  request that raises is recorded with status 500. The duration histogram keeps
  exemplars from sampled spans, so a slow bucket leads to one of its requests.

Logs
----
Before the request runs, the log fields the span starts with are bound too —
``principal=anonymous`` and ``origin=api`` — so every line the request writes
says who it was for; authentication replaces them once it knows the caller.
They are bound for this request only and restored when it finishes.

The per-request access line (method, route template, status, duration) is
DEBUG: a request that went well is noise at any higher level.

A 5xx is exactly one ERROR line — whether the route returned it or raised it:
method, route template, status and duration, with the traceback when it was
raised, and the same values as ``http.*`` fields. It is written while the
request span is still current, so it carries the trace_id and span_id that
lead to the trace. It never carries the request body or query parameters, and
never a raw path, which would carry ids: a request no route matched is logged
as ``unmatched``.

Having logged it, the middleware marks the request's ASGI scope
(``scope["invana.error_logged"]``). ``CatchAllExceptionMiddleware``
(``invana.server.middleware``), which sits outside this one and is mounted
even when telemetry is off, logs a 5xx only when that mark is absent — so each
one is logged once, with or without telemetry.
"""

from __future__ import annotations

import logging
import time

from opentelemetry import trace
from opentelemetry.propagate import extract
from opentelemetry.trace import SpanKind, Status, StatusCode
from starlette.requests import Request
from starlette.routing import Match
from starlette.types import ASGIApp, Receive, Scope, Send

from invana.core.logging import context as log_context
from invana.core.telemetry.metrics import http_server_active, http_server_duration

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

# The ``http.route`` metric value for a request no route matched (a raw path would carry ids).
_UNMATCHED = "unmatched"

# Scope key set once a 5xx is logged; CatchAllExceptionMiddleware reads the same key.
ERROR_LOGGED = "invana.error_logged"


class TelemetryMiddleware:
    """Pure ASGI middleware that instruments every HTTP request.

    Wraps the app: each request that is not skipped runs inside one SERVER span,
    is counted on the HTTP metrics, and is logged — at DEBUG when it succeeds,
    as one ERROR line when it ends in a 5xx (see the module docstring). Mounted
    only when telemetry is enabled, and inside ``CatchAllExceptionMiddleware``,
    so an exception a route raises passes through here — recorded and logged —
    before it becomes a 500 response.
    """

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
        with (
            tracer.start_as_current_span(span_name, context=parent_ctx, kind=SpanKind.SERVER) as span,
            log_context.fields(principal="anonymous", origin="api"),
        ):
            _attach_request(span, request, raw_path, method, client_ip, user_agent, req_size)
            active_labels = {"http.request.method": method, "http.route": _match_route(scope)}
            http_server_active.add(1, active_labels)
            start = time.perf_counter()

            try:
                await self._app(scope, receive, send_wrapper)
                duration_ms = (time.perf_counter() - start) * 1000
                status = status_holder[0]
                res_size = res_size_holder[0]

                # After routing, the matched route template is available in scope.
                template = _resolve_route_from_scope(scope)
                if template and template != raw_path:
                    span.update_name(f"{method} {template}")
                    span.set_attribute("http.route", template)
                route = template or active_labels["http.route"]

                _attach_response(span, status, duration_ms, res_size)
                _record_duration(scope, active_labels, status, duration_ms)

                if status >= 500:
                    _log_server_error(scope, method, route, status, duration_ms)
                else:
                    logger.debug(
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
                _record_duration(scope, active_labels, 500, duration_ms)
                route = _resolve_route_from_scope(scope) or active_labels["http.route"]
                _log_server_error(scope, method, route, 500, duration_ms, exc_info=True)
                raise

            finally:
                http_server_active.add(-1, active_labels)


# ── helpers ───────────────────────────────────────────────────────────────────


def _log_server_error(
    scope: Scope, method: str, route: str, status: int, duration_ms: float, *, exc_info: bool = False
) -> None:
    """Write the one ERROR line for a 5xx and mark the scope so no outer middleware repeats it.

    Called while the request span is current, so the record carries its trace.
    ``route`` is a template or ``unmatched``; the body and query never reach the line.
    """
    logger.error(
        "%s %s %s  %.2fms",
        method,
        route,
        status,
        duration_ms,
        exc_info=exc_info,
        extra={
            "http.method": method,
            "http.route": route,
            "http.status_code": status,
            "http.duration_ms": round(duration_ms, 3),
        },
    )
    scope[ERROR_LOGGED] = True


def _record_duration(scope: Scope, active_labels: dict[str, str], status: int, duration_ms: float) -> None:
    """One ``http.server.request.duration`` sample, in seconds, on the route that handled it."""
    labels = {
        "http.request.method": active_labels["http.request.method"],
        "http.route": _resolve_route_from_scope(scope) or active_labels["http.route"],
        "http.response.status_code": status,
    }
    http_server_duration.record(duration_ms / 1000, labels)


def _match_route(scope: Scope) -> str:
    """The route template this request will reach, resolved before it runs.

    Starlette sets ``scope["route"]`` only once routing has happened, but the
    active-request count needs its attributes up front. The app's routes are
    matched here the way the router will match them; the first full match wins.
    Nothing matching — or no routed app in scope — is ``unmatched``.
    """
    router = getattr(scope.get("app"), "router", None)
    for route in getattr(router, "routes", ()):
        try:
            match, _ = route.matches(scope)
        except Exception:
            continue
        if match is Match.FULL:
            return getattr(route, "path", None) or _UNMATCHED
    return _UNMATCHED


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
    # Until authentication says otherwise, nobody in particular is calling.
    span.set_attribute("invana.principal", "anonymous")
    span.set_attribute("invana.origin", "api")
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
