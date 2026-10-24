"""The ``graph.read.validate`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm.translate import _looks_read_only
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _sha, labels_in, query_language_for
from invana.plugins.sdk.errors import TaskFailure


async def graph_read_validate(ctx: TaskContext, v: RunVars) -> Out:
    """A query is never run unvalidated — the read-only check, as a step on the record.

    ``args.query`` lets a compound plan validate *this branch's* query rather
    than whatever the last translate step happened to leave behind; the
    binding was resolved before dispatch, so by here it is a literal.
    """
    query = str((ctx.step.args or {}).get("query") or "") or v.query or v.prompt
    v.query = query
    language = await query_language_for(ctx, v, strict=False)
    if not _looks_read_only(query, language):
        raise TaskFailure(
            cls="blocked",
            cause="query_not_read_only",
            message="That query would write to the graph — Invana only runs read-only queries.",
            short="not read-only",
            evidence={"generated_query": query},
        )
    labels = labels_in(query, language)
    return Out(
        detail="read-only ✓" + (f" · {', '.join(labels)}" if labels else ""),
        input={"query_sha": _sha(query), "language": language},
        output={"verdict": "read-only", "labels": labels},
    )


run = graph_read_validate
