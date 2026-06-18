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
"""

from __future__ import annotations

import logging

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("invana.api")


class CatchAllExceptionMiddleware:
    """Convert unhandled exceptions into a JSON 500 response (CORS-friendly)."""

    def __init__(self, app: ASGIApp, *, debug: bool = False) -> None:
        self._app = app
        self._debug = debug

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self._app(scope, receive, send_wrapper)
        except Exception as exc:
            # The exception was already recorded on the request span by
            # TelemetryMiddleware (inner to this one). Re-log at server level
            # so it's captured even when telemetry is disabled.
            logger.exception("Unhandled exception while handling request")

            if response_started:
                # Headers are already on the wire (e.g. mid-stream SSE). We can
                # no longer replace the response — let it propagate so the
                # connection tears down rather than corrupting the stream.
                raise

            detail = repr(exc) if self._debug else "Internal Server Error"
            response = JSONResponse(status_code=500, content={"detail": detail})
            await response(scope, receive, send)
