"""What a worker said and how hot it ran — kept in this process.

No column holds a worker's log lines or its CPU history, so they live here:
the gateway writes them from heartbeats, the worker detail reads them. They are
per engine process and are lost on restart; a worker detail opened on another
process shows an empty log.
"""

from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta

LOG_LINES = 200
CPU_POINTS = 60
CPU_EVERY = timedelta(seconds=30)

_logs: dict[str, deque[tuple[datetime, str]]] = {}
_cpu: dict[str, deque[tuple[datetime, int]]] = {}


def add_log(worker_id: str, lines: list[str]) -> None:
    now = datetime.now(UTC)
    ring = _logs.setdefault(worker_id, deque(maxlen=LOG_LINES))
    ring.extend((now, line) for line in lines)


def add_cpu(worker_id: str, cpu: float | None) -> None:
    """Keep one CPU sample per 30 s, so the ring spans the last 30 min."""
    if cpu is None:
        return
    now = datetime.now(UTC)
    ring = _cpu.setdefault(worker_id, deque(maxlen=CPU_POINTS))
    if not ring or now - ring[-1][0] >= CPU_EVERY:
        ring.append((now, round(cpu)))


def log_of(worker_id: str) -> list[tuple[datetime, str]]:
    return list(_logs.get(worker_id, ()))


def cpu_of(worker_id: str) -> list[tuple[datetime, int]]:
    return list(_cpu.get(worker_id, ()))
