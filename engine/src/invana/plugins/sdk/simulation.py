"""What a simulator imports — the pinned inputs it may read
(docs/for-developers/modules/work/features/simulation.md).

A simulator does the science; Invana decides what it reads. Before a run
opens, every input dataset version is resolved, checked readable by the person
simulating, and pinned on the step as ``{ref, dataset_id, version_id,
content_hash}``. :func:`read_inputs` is the only way a simulator reaches data:
it loads those versions' records and refuses a version whose hash no longer
matches its pin or that was retracted after the simulation opened, so a result
always rests on exactly the inputs it names.

Usage, inside a simulator's ``run.py``::

    from invana.plugins.sdk.simulation import read_inputs

    async def run(ctx, v):
        inputs = await read_inputs(ctx)
        for item in inputs:
            item.ref                      # "ada/accessions@3"
            item.records["ICC 4958"]      # {"seed_weight": 24.1, …}
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from invana.apps.datasets.querysets import DatasetRecordQuerySet, DatasetVersionQuerySet
from invana.plugins.sdk.context import TaskContext
from invana.plugins.sdk.errors import TaskFailure


@dataclass(frozen=True, slots=True)
class Input:
    """One pinned dataset version and its records, by record key."""

    ref: str
    version_id: str
    content_hash: str
    records: dict[str, dict[str, Any]] = field(default_factory=dict)


async def read_inputs(ctx: TaskContext) -> list[Input]:
    """The step's pinned inputs, in the order the simulation named them."""
    versions, records = DatasetVersionQuerySet(), DatasetRecordQuerySet()
    out: list[Input] = []
    for pin in (ctx.step.args or {}).get("inputs") or []:
        row = await versions.get(ctx.db, pin["version_id"])
        if row is None or row.content_hash != pin["content_hash"]:
            raise TaskFailure(
                cls="blocked",
                cause="input_changed",
                message=f"{pin['ref']} is no longer the version this simulation pinned.",
                short="input changed",
            )
        if row.retracted_at is not None:
            raise TaskFailure(
                cls="blocked",
                cause="input_retracted",
                message=(
                    f"{pin['ref']} was retracted after this simulation opened: "
                    f"{row.retraction_reason or 'no reason given'}."
                ),
                short="input retracted",
            )
        rows = await records.all_for_version(ctx.db, row.id)
        out.append(
            Input(
                ref=pin["ref"],
                version_id=row.id,
                content_hash=row.content_hash,
                records={r.key: dict(r.values) for r in rows},
            )
        )
        ctx.artifact(pin["ref"], direction="read", summary=f"{len(rows)} records")
    return out


__all__ = ["Input", "read_inputs"]
