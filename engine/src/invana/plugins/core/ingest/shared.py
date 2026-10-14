"""What the ``ingest`` task types share."""

from __future__ import annotations

from invana.apps.modeller.store import ModelStore
from invana.plugins.sdk.context import RunVars, TaskContext, TaskFailure

_store = ModelStore()


def _root(ctx: TaskContext, v: RunVars) -> str:
    """Where the files are — the step's own arg, else what the run was opened on."""
    bound = str((ctx.step.args or {}).get("root") or "")
    if bound:
        return bound
    if v.load is not None and v.load.root:
        return v.load.root
    raise TaskFailure(
        cls="blocked",
        cause="no_source",
        message="This step has no source folder to read.",
        short="no source",
    )


def _load(v: RunVars):
    if v.load is None:
        raise TaskFailure(
            cls="blocked",
            cause="not_a_load",
            message="This step belongs to a load, and this run is not one.",
            short="not a load",
        )
    return v.load
