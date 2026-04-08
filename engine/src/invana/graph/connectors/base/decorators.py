from collections.abc import Callable
from functools import wraps
from typing import Any

from invana.graph.connectors.base.exceptions import NotSupportedError


def not_supported_by_vendor(message: str = "") -> Callable:
    """Decorator for methods not supported by a specific DB vendor.
    Raises NotSupportedError at call time with a descriptive message."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            raise NotSupportedError(f"'{func.__name__}' is not supported by this connector. {message}")

        return wrapper

    return decorator
