"""Server-level ASGI middleware.

CatchAllExceptionMiddleware
---------------------------
Turns an unhandled exception into a JSON ``500`` *response* so the outer
CORSMiddleware can attach ``Access-Control-Allow-Origin`` to it.

Why this is needed
~~~~~~~~~~~~~~~~~~~
Starlette builds its stack as::

    ServerErrorMiddleware            (outermost — always)
      └─ user middleware             (CORS, Session, Telemetry, …)
           └─ ExceptionMiddleware    (innermost — handles HTTPException)
                └─ router

When a route raises something that is *not* an ``HTTPException`` (an unhandled
500), ``ExceptionMiddleware`` re-raises it. The exception then propagates up
through every user middleware — including ``CORSMiddleware`` — without any of
them ever calling ``send``. Only ``ServerErrorMiddleware``, which sits *outside*
CORS, finally turns it into a bare ``500`` response. Because that response is
produced above CORS, it never gets CORS headers, so the browser drops it and
reports a misleading "blocked by CORS" error instead of the real 500.

The fix: catch the exception *inside* CORS (this middleware is mounted directly
beneath it) and emit a normal response. CORS's ``send`` wrapper then runs on the
way out and adds the headers, so the browser sees the true status and body.

Logging a 5xx
~~~~~~~~~~~~~
Every 5xx is logged exactly once, as one ERROR line on the ``invana.api``
logger: method, route template, status and duration (the traceback too when
the route raised), with the same values as ``http.*`` fields. Never the body,
the query parameters or the raw path — a path carries ids; a request no route
matched is logged as ``unmatched``.

When telemetry is on, ``TelemetryMiddleware`` (inner to this one) has already
written that line inside the request span, so it carries the trace, and it
marks the scope with ``scope["invana.error_logged"]``. This middleware logs a
raised exception or a returned 5xx only when that mark is absent — which is
when telemetry is off — so the line is written whether or not telemetry is on,
and never twice. The 500 this middleware produces from an exception is not
logged again: the exception already was.
"""

from __future__ import annotations

import logging
import time

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from invana.core.logging.context import ERROR_LOGGED

logger = logging.getLogger("invana.api")


class CatchAllExceptionMiddleware:
    """Convert unhandled exceptions into a JSON 500 response (CORS-friendly), and log each 5xx once.

    Mount it directly beneath ``CORSMiddleware``. An exception raised before the
    response started becomes ``{"detail": "Internal Server Error"}`` with status
    500 (``repr(exc)`` as the detail when ``debug`` is on); one raised after the
    headers were sent is re-raised, since the response can no longer be replaced.
    Either way it is logged with its traceback, and a 5xx the app returned is
    logged too — each only when ``TelemetryMiddleware`` has not already logged it.
    """

    def __init__(self, app: ASGIApp, *, debug: bool = False) -> None:
        self._app = app
        self._debug = debug

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        response_started = False
        status = 0
        start = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started, status
            if message["type"] == "http.response.start":
                response_started = True
                status = message.get("status", 200)
            await send(message)

        try:
            await self._app(scope, receive, send_wrapper)
        except Exception as exc:
            self._log_unlogged(scope, 500, start, exc_info=True)

            if response_started:
                # Headers are already on the wire (e.g. mid-stream SSE). We can
                # no longer replace the response — let it propagate so the
                # connection tears down rather than corrupting the stream.
                raise

            detail = repr(exc) if self._debug else "Internal Server Error"
            response = JSONResponse(status_code=500, content={"detail": detail})
            await response(scope, receive, send)
            return

        if status >= 500:
            self._log_unlogged(scope, status, start)

    @staticmethod
    def _log_unlogged(scope: Scope, status: int, start: float, *, exc_info: bool = False) -> None:
        """Write the ERROR line for a 5xx unless TelemetryMiddleware already wrote it."""
        if scope.get(ERROR_LOGGED):
            return
        method = scope.get("method", "")
        route = getattr(scope.get("route"), "path", None) or "unmatched"
        duration_ms = (time.perf_counter() - start) * 1000
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
