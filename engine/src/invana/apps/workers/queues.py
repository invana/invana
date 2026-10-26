"""Queue names for tool steps — ``tools.<labels>``.

docs/for-developers/modules/agents/features/workers.md. A tool step defers onto
the queue named for the resources its function declares, sorted and joined by
``+``: ``tools.cpu``, ``tools.cpu+gpu``. A worker takes jobs from every queue
whose labels its own labels cover.
"""

from __future__ import annotations

from collections.abc import Iterable

PREFIX = "tools."


def queue_for(resources: Iterable[str]) -> str:
    """The queue a step needing ``resources`` waits on."""
    labels = sorted({str(r) for r in resources}) or ["cpu"]
    return PREFIX + "+".join(labels)


def labels_of(queue: str) -> frozenset[str]:
    """The labels a ``tools.<labels>`` queue needs; empty for any other queue name."""
    if not queue.startswith(PREFIX):
        return frozenset()
    return frozenset(part for part in queue[len(PREFIX) :].split("+") if part)


def covers(labels: Iterable[str], queue: str) -> bool:
    """True when ``labels`` carry every label the queue needs."""
    needed = labels_of(queue)
    return bool(needed) and needed <= set(labels)
