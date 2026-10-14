"""What the ``graph_read`` task types share."""

from __future__ import annotations

from fastapi import HTTPException

from invana.apps.graphs.query_service import (
    QueryExecutionError,
    _resolve_connector,
)
from invana.graph.connectors.base.exceptions import LensViolationError
from invana.plugins.sdk.context import (
    RunVars,
    TaskContext,
    http_failure,
)


def _rewritten(result) -> bool:
    """Did the lens change the query between generation and execution?"""
    return result.composed is not None and result.composed.rewritten


def query_record(result, *, digests: dict[str, str], timeout_s, parameters: bool) -> dict:
    """What the step records about the query it sent.

    Both digests always, and **both texts** only when the lens rewrote the
    query. A digest proves a difference without showing one, and *1,283*
    printed beside the generated query is a citation that returns 4,902 if a
    reader runs it — so the query that produced the number is recorded beside
    the one that was asked for ([GV34](docs/for-developers/modules/govern/spec.md)).

    Both, because the step is what the board reads and the generated query
    is not otherwise on it: an ask run's `args` carry `read_only` and nothing
    else, the question living on the message. A band that could show only the
    rewritten half would leave a reader comparing it against something they
    have to go and find.

    On the step, never on the touch: `run_touches` is an index into the trace,
    and a copy of the text there would make it a second record of it
    ([GV20](docs/for-developers/modules/govern/spec.md)). Where the digests are
    equal nothing is recorded, because the resolved request already **is** what
    ran and a second copy of it would say nothing.
    """
    record: dict = {"query": digests}
    if _rewritten(result):
        record["generated_query"] = result.composed.generated
        record["executed_query"] = result.composed.executed
    record["timeout_s"] = timeout_s
    record["parameters"] = parameters
    return record


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _preview_refusal(exc: Exception) -> str | None:
    """A rule the lens refuses, or one the graph cannot count, is that rule's verdict."""
    if isinstance(exc, LensViolationError):
        return str(exc)
    if isinstance(exc, QueryExecutionError):
        return f"The graph could not count this rule: {exc}"
    return None


async def _connector(ctx: TaskContext, v: RunVars):
    try:
        _, connector = await _resolve_connector(ctx.db, graph=v.graph, manager=ctx.manager)
    except HTTPException as exc:
        raise http_failure(exc) from exc
    return connector


def _type_rows(counts: dict[str, int] | None, labels: list[str]) -> list[dict]:
    """Biggest first; a vendor that cannot count keeps its own order, with no numbers (SP8)."""
    if counts is None:
        return [{"name": label, "count": None} for label in labels]
    rows = [{"name": label, "count": int(n)} for label, n in counts.items()]
    rows.sort(key=lambda r: (-r["count"], r["name"]))
    return rows
