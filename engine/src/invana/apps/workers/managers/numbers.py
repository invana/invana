"""The arithmetic Workers shows, in one place so every surface agrees."""

from __future__ import annotations

import math
from collections.abc import Sequence

from invana.core.errors import PermissionDeniedError

#: How far back *Suggested* looks.
SUGGEST_WINDOW_S = 600
#: A heartbeat this old and the worker is lost.
LOST_AFTER_S = 30


def require_install_admin(actor) -> None:
    """Only an install admin (``User.is_superuser``) adds and scales workers."""
    if not getattr(actor, "is_superuser", False):
        raise PermissionDeniedError("Install admins add and scale workers")


def suggested_workers(ready: Sequence[int], slots_per_worker: int) -> int:
    """Ready steps ÷ slots a worker, averaged over the samples given, rounded up, never below zero."""
    if not ready:
        return 0
    average = sum(ready) / len(ready)
    return max(0, math.ceil(average / max(1, slots_per_worker)))


def pool_state(*, workers: int, slots: int, slots_busy: int, queued: int, suggested: int) -> str:
    """``no_workers`` · ``short`` · ``keeping_up`` · ``healthy`` — in that order of precedence."""
    if workers == 0:
        return "no_workers"
    if queued > 0 and (slots_busy >= slots or suggested > workers):
        return "short"
    if queued > 0:
        return "keeping_up"
    return "healthy"
