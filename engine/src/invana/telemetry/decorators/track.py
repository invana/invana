"""
@track — wraps any async or sync method in an OTel span.

Features
--------
- Records class / module / method as span attributes.
- Binds method arguments to span attributes (capture_args=True by default).
- On failure: records exception type, message, full stacktrace.
- On failure with capture_locals=True: walks the traceback and records local
  variable values at every user-code frame.
- Emits method_duration and method_error_count metrics.

Usage
-----
    from invana.telemetry.decorators.track import track

    class DomainManager:

        @track()
        async def create(self, name: str, **data): ...

        @track(capture_locals=True)
        async def complex_query(self, gremlin: str, bindings: dict): ...

        @track(capture_result=True, span_name="ontology.domain.get")
        async def get_by_name(self, name: str): ...
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import inspect
import time
import traceback
from collections.abc import Callable
from typing import Any

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from invana.telemetry.metrics import method_duration, method_error_count

tracer = trace.get_tracer("invana.core")


def track(
    capture_locals: bool = False,
    capture_args: bool = True,
    capture_result: bool = False,
    span_name: str | None = None,
) -> Callable:
    """
    Decorator factory. Always called with parentheses: ``@track()``

    Parameters
    ----------
    capture_locals:
        Walk the traceback on failure and record local variables at each
        user-code frame. Useful for debugging; keep False in hot paths.
    capture_args:
        Bind method parameter values to span attributes on every call.
    capture_result:
        Record the return value as a span attribute. Large results are
        truncated to 500 characters.
    span_name:
        Override the default ``ClassName.method_name`` span name.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(self, *args, **kwargs):
            name = span_name or f"{type(self).__name__}.{func.__name__}"
            with tracer.start_as_current_span(name) as span:
                _attach_call_metadata(span, self, func, args, kwargs, capture_args)
                start = time.perf_counter()
                try:
                    result = await func(self, *args, **kwargs)
                    _on_success(span, result, start, capture_result)
                    return result
                except Exception as exc:
                    _on_failure(span, exc, start, capture_locals)
                    raise

        @functools.wraps(func)
        def sync_wrapper(self, *args, **kwargs):
            name = span_name or f"{type(self).__name__}.{func.__name__}"
            with tracer.start_as_current_span(name) as span:
                _attach_call_metadata(span, self, func, args, kwargs, capture_args)
                start = time.perf_counter()
                try:
                    result = func(self, *args, **kwargs)
                    _on_success(span, result, start, capture_result)
                    return result
                except Exception as exc:
                    _on_failure(span, exc, start, capture_locals)
                    raise

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


# ── internals ─────────────────────────────────────────────────────────────────


def _attach_call_metadata(
    span: trace.Span,
    self: Any,
    func: Callable,
    args: tuple,
    kwargs: dict,
    capture_args: bool,
) -> None:
    cls = type(self)
    span.set_attribute("invana.module", cls.__module__)
    span.set_attribute("invana.class", cls.__name__)
    span.set_attribute("invana.method", func.__name__)
    span.set_attribute("invana.qualified", f"{cls.__module__}.{cls.__name__}.{func.__name__}")
    span.set_attribute("invana.component", "engine")

    if not capture_args:
        return

    try:
        sig = inspect.signature(func)
        bound = sig.bind(self, *args, **kwargs)
        bound.apply_defaults()
        for param, value in bound.arguments.items():
            if param == "self":
                continue
            span.set_attribute(f"invana.args.{param}", _safe_str(value))
    except Exception:
        pass  # telemetry must never crash the application


def _on_success(span: trace.Span, result: Any, start: float, capture_result: bool) -> None:
    duration_ms = (time.perf_counter() - start) * 1000
    span.set_attribute("invana.duration_ms", round(duration_ms, 3))
    span.set_attribute("invana.status", "success")
    span.set_status(Status(StatusCode.OK))
    _emit_duration_metric(span, duration_ms, "success")
    if capture_result:
        span.set_attribute("invana.result", _safe_str(result))


def _on_failure(span: trace.Span, exc: Exception, start: float, capture_locals: bool) -> None:
    duration_ms = (time.perf_counter() - start) * 1000
    span.set_attribute("invana.duration_ms", round(duration_ms, 3))
    span.set_attribute("invana.status", "failed")
    span.set_attribute("invana.error.type", type(exc).__name__)
    span.set_attribute("invana.error.message", str(exc))
    span.set_attribute("invana.error.stack", traceback.format_exc())
    span.set_status(Status(StatusCode.ERROR, str(exc)))
    span.record_exception(exc)
    _emit_duration_metric(span, duration_ms, "failed")

    attrs = getattr(span, "attributes", None) or {}
    method_error_count.add(
        1,
        {
            "class": attrs.get("invana.class", "unknown"),
            "method": attrs.get("invana.method", "unknown"),
            "error_type": type(exc).__name__,
        },
    )

    if capture_locals:
        _capture_locals(span, exc)


def _capture_locals(span: trace.Span, exc: Exception) -> None:
    """Walk the exception traceback and record local variables at user-code frames."""
    tb = exc.__traceback__
    frame_index = 0

    while tb is not None:
        frame = tb.tb_frame
        lineno = tb.tb_lineno
        filename = frame.f_code.co_filename
        is_user_code = "site-packages" not in filename and "lib/python" not in filename

        if is_user_code:
            prefix = f"invana.locals.frame{frame_index}"
            span.set_attribute(f"{prefix}.file", filename)
            span.set_attribute(f"{prefix}.line", lineno)
            span.set_attribute(f"{prefix}.fn", frame.f_code.co_name)
            for var_name, var_value in frame.f_locals.items():
                if var_name.startswith("__"):
                    continue
                with contextlib.suppress(Exception):
                    span.set_attribute(f"{prefix}.locals.{var_name}", _safe_str(var_value))
            frame_index += 1

        tb = tb.tb_next


def _emit_duration_metric(span: trace.Span, duration_ms: float, status: str) -> None:
    attrs = getattr(span, "attributes", None) or {}
    method_duration.record(
        round(duration_ms, 3),
        {
            "class": attrs.get("invana.class", "unknown"),
            "method": attrs.get("invana.method", "unknown"),
            "status": status,
        },
    )


def _safe_str(value: Any, max_len: int = 500) -> str:
    """Convert any value to a string safely, truncating at max_len chars."""
    try:
        result = str(value)
        return result[:max_len] + "…" if len(result) > max_len else result
    except Exception:
        return "<unserializable>"
