"""The ``shape_for_canvas`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.sdk.context import Out, RunVars, TaskContext, _plural
from invana.runtime.emissions import produce as produce_emission
from invana.runtime.emissions import to_dict as emission_to_dict


async def shape_for_canvas(ctx: TaskContext, v: RunVars) -> Out:
    """Project: records become an **emission**, through a template.

    This is the `project` step of the pipeline
    (docs/for-developers/modules/ask/features/the-answer-surface.md). It declares the
    emission's kind (AS2) by asking the chosen template what surface it produces,
    writes the emission as a row so the answer survives a reload (AS10), and
    carries the citation — the query and the record count — with it (AS3).

    The offer list travels on the stream frame so the emission header's picker can
    show every other template that would render these same records, and the reason
    the rest cannot (P10) — without re-running anything (P5).
    """
    assert v.result is not None
    r = v.result
    v.nodes = len(r.data.nodes) if r.data else 0
    v.edges = len(r.data.edges) if r.data else 0

    emission, offers, shape = await produce_emission(
        ctx.db,
        run_id=ctx.step.parent_run_id,
        graph_id=v.graph.id,
        result=r,
        query=v.query,
        message_id=v.assistant_message_id,
        step_id=ctx.step.id,
        kind=v.intent.kind if v.intent else "",
        prefer=v.intent.prefer if v.intent else "",
    )
    await ctx.emit("emission", emission_to_dict(emission, offers=offers))

    if emission.kind == "empty":
        # Zero rows is an answer — "the graph does not hold this" — worded as one
        # rather than drawn as a blank table (AS7).
        v.summary = emission.payload.get("statement", "")
        detail = "nothing held → the empty answer"
    elif r.result_type == "graph":
        v.summary = f"Returned {_plural(v.nodes, 'node')} and {_plural(v.edges, 'relationship')}."
        detail = f"{_plural(v.nodes, 'node')} · {_plural(v.edges, 'relationship')} → canvas"
    else:
        v.summary = f"Returned {_plural(r.row_count, 'row')}."
        detail = f"{r.row_count} row{'' if r.row_count == 1 else 's'} → {emission.kind}"

    return Out(
        detail=detail,
        output={
            "nodes": v.nodes,
            "edges": v.edges,
            "result_type": r.result_type,
            "emission_id": emission.id,
            "emission_kind": emission.kind,
            # NULL when no template chose it — the header says "no template"
            # rather than naming a default so the row looks complete (AS9).
            "template_id": emission.template_id,
            "single_value": shape.is_single_value,
        },
    )


run = shape_for_canvas
