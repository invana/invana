"""The ``data.version.draft`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from pydantic import ValidationError as SchemaError

from invana.apps.datasets.schemas import DatasetVersionCreate
from invana.core.errors import InvanaError
from invana.plugins.core.datasets.drafts import dataset_of, datasets, refused
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure

_BODY = ("records", "licence", "author_chain", "why", "source")


async def data_version_draft(ctx: TaskContext, v: RunVars) -> Out:
    """Store the records as the dataset's next **draft** — numbered, listed, never current.

    The same gates a draft pushed over the API passes: only the dataset's owner
    pushes, records that match the current version are refused as unchanged,
    and a ``block`` claim they break refuses them. Its owner publishes it.
    """
    dataset, user = await dataset_of(ctx, v)
    args = ctx.step.args or {}
    try:
        payload = DatasetVersionCreate.model_validate({k: args[k] for k in _BODY if args.get(k) is not None})
    except SchemaError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first.get("loc", ()))
        raise TaskFailure(
            cls="blocked", cause="bad_draft", message=f"{where}: {first.get('msg')}", short="bad draft"
        ) from exc
    try:
        version = await datasets.push_draft(ctx.db, dataset=dataset, payload=payload, actor=user)
        warnings = await datasets.claims.warnings(ctx.db, dataset=dataset, version=version)
    except InvanaError as exc:
        raise refused(exc, cause="draft_refused") from exc
    return Out(
        detail=f"{dataset.name} · draft v{version.version} · {version.record_count} records",
        input={"dataset": dataset.address, "records": len(payload.records)},
        output={
            "dataset": dataset.address,
            "version": version.version,
            "state": version.state,
            "record_count": version.record_count,
            "warnings": warnings,
        },
    )


run = data_version_draft
