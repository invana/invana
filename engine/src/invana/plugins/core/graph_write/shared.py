"""What the ``graph_write`` task types share."""

from __future__ import annotations

import logging

from invana.plugins.sdk.context import RunVars, TaskContext, TaskFailure

logger = logging.getLogger(__name__)


def _load(v: RunVars):
    if v.load is None:
        raise TaskFailure(
            cls="blocked",
            cause="not_a_load",
            message="This step belongs to a load, and this run is not one.",
            short="not a load",
        )
    return v.load


def _run_id(ctx: TaskContext) -> str:
    """The run whose name goes on every element this step writes (LD4 · §6.6).

    The **root**, not this node: provenance answers *which load wrote this*, and
    a load is the run, not the step inside it.
    """
    return ctx.step.parent_run_id or ctx.step.id
