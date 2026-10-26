"""The ``data.version.check`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.core.ingest.drafts import dataset_of, datasets
from invana.plugins.sdk.context import Out, RunVars, TaskContext


async def data_version_check(ctx: TaskContext, v: RunVars) -> Out:
    """Read records as a draft push of the dataset would, and write nothing.

    Every record that cannot be keyed is named with its reason; the keyed ones
    are scored against the standards the dataset claims. What a caller learns
    here is what ``data.version.draft`` would refuse.
    """
    dataset, _ = await dataset_of(ctx, v)
    records = list((ctx.step.args or {}).get("records") or [])
    checked = await datasets.check_records(ctx.db, dataset=dataset, records=records)
    rejected = len(checked["rejected"])
    detail = f"{checked['valid']} valid · {rejected} rejected"
    if checked["blocked"]:
        detail += f" · {len(checked['blocked'])} blocked"
    if checked["unchanged"]:
        detail += " · unchanged"
    return Out(detail=detail, input={"dataset": dataset.address, "records": len(records)}, output=checked)


run = data_version_check
