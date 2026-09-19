"""Producing and reading emissions (docs/for-developers/modules/ask/features/the-answer-surface.md).

An answer is a sequence of typed emissions, not a text blob (AS1). This module is
where they become **records** — which is what makes AS10 true: an answer survives
a reload, because it was never page state.

Three rules live here:

- **The producing step declares the kind** (AS2). `project` asks
  `projections.render` what surface the chosen template produces and stores that;
  nothing downstream guesses from the payload.
- **Every emission cites** (AS3). The query and the record count travel with it,
  and an emission with nothing to cite is not written.
- **The header names a template only when one chose the rendering** (AS9).
  `template_id` stays NULL for a default, and the reader is told which was used.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from invana.runtime.models import Emission
from invana.runtime.projections import Shape, available_templates, render, select_template, shape_of

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def next_seq(session: AsyncSession, run_id: str) -> int:
    rows = (
        await session.execute(select(Emission.seq).where(Emission.run_id == run_id).order_by(Emission.seq))
    ).scalars()
    return max(list(rows), default=-1) + 1


async def produce(
    session: AsyncSession,
    *,
    run_id: str,
    graph_id: str,
    result: Any,
    query: str | None,
    message_id: str | None = None,
    step_id: str | None = None,
    intent: str = "",
) -> tuple[Emission, list[dict[str, Any]], Shape]:
    """Turn one query result into one persisted emission.

    Returns the emission, the full template offer list (so the header's picker
    can show what else would render this, and why the rest cannot), and the shape
    the decision was made against.
    """
    shape = shape_of(result)
    templates = await available_templates(session, graph_id=graph_id)
    template, offers = select_template(templates, shape, intent=intent)
    kind, payload = render(template, result, shape)

    emission = Emission(
        run_id=run_id,
        message_id=message_id,
        step_run_id=step_id,
        seq=await next_seq(session, run_id),
        kind=kind,
        payload=payload,
        template_id=template.id if template else None,
        citation={
            "query": query,
            "query_language": getattr(result, "query_language", None),
            "record_count": result.row_count,
            "execution_time_ms": getattr(result, "execution_time_ms", None),
        },
    )
    session.add(emission)
    await session.flush()
    return emission, offers, shape


async def list_for_run(session: AsyncSession, run_id: str) -> list[Emission]:
    stmt = select(Emission).where(Emission.run_id == run_id).order_by(Emission.seq)
    return list((await session.execute(stmt)).scalars().all())


async def get(session: AsyncSession, emission_id: str) -> Emission | None:
    return (await session.execute(select(Emission).where(Emission.id == emission_id))).scalar_one_or_none()


def to_dict(emission: Emission, *, offers: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """The wire shape Studio's emission card reads."""
    return {
        "id": emission.id,
        "seq": emission.seq,
        "kind": emission.kind,
        "payload": emission.payload,
        "template_id": emission.template_id,
        "citation": emission.citation,
        "message_id": emission.message_id,
        "templates": offers or [],
    }
