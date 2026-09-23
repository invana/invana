"""Enforcing the lens a run froze, and recording what it engaged.

[Govern](docs/for-developers/modules/govern/spec.md) is declared in ``apps`` and
*happens* here: the interpreter checks an address before it dispatches, and
writes one touch whichever way the check went. The freeze itself happened at run
open (``runtime.services.freeze_lens``, [GV26]), so nothing in this module
composes anything — it reads the document already on the run, which is what
makes a past answer reconstructible rather than a pointer at rows that have
since moved.

**A touch is the projection of a frame** ([GV28]): every engagement emits one
``touch`` frame onto ``task_stream`` and then writes one ``run_touches`` row
carrying that frame's ``seq``. Written beside the ledger instead of from it, the
projection would be a second record, and the first time the two disagreed nobody
could say which one the run did.

**Egress is the one narrowing that is applied rather than checked.** The
participant is permitted or refused; what may accompany the call is cut out of
the prompt's parts before the prompt exists ([GV31]), and both halves —
``sent.classes`` and ``sent.cut`` — land on the touch, because *nothing was cut*
and *nothing was governed* are different runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.managers.touch import TouchManager
from invana.apps.govern.models import TouchDirection
from invana.apps.govern.rules import Effective, EgressClass, Verdict, from_snapshot
from invana.runtime.models import TaskRun
from invana.runtime.stream import Emitter

#: What a prompt assembled by this runtime can carry out of the Graph. Each is a
#: **part of the assembly**, not a pass over its text: the grounding block's
#: labels and their properties, the ask itself, and the conversation carried into
#: it. A class nobody can point at a part of the prompt is a promise nobody
#: could check, which is why this map is short and closed.
PROMPT_CLASSES: tuple[str, ...] = (
    EgressClass.type_names.value,
    EgressClass.property_names.value,
    EgressClass.the_question.value,
    EgressClass.property_values.value,
)


@dataclass(frozen=True, slots=True)
class Egress:
    """What may accompany one crossing, and what was taken out of it."""

    #: What the prompt is allowed to carry, of what it would have carried.
    classes: tuple[str, ...]
    #: What the lens removed. Empty on an unbounded crossing, and empty is a
    #: fact about the run rather than an absence of one.
    cut: tuple[str, ...]

    def permits(self, class_: str | EgressClass) -> bool:
        return str(class_) in self.classes

    def as_sent(self, *, to: str) -> dict[str, Any]:
        """``{to, classes, cut}`` — the shape ``run_touches.sent`` holds."""
        return {"to": to, "classes": list(self.classes), "cut": list(self.cut)}


@dataclass(slots=True)
class Governor:
    """The frozen lens, as the thing that decides and records.

    One per run, built where the run's state is built and carried on
    ``RunVars`` — so a step cannot reach a different lens than the one the run
    opened under ([GV8]).
    """

    effective: Effective
    run_id: str
    graph_id: str
    touches: TouchManager

    @classmethod
    def for_run(cls, run: TaskRun) -> Governor:
        """A run opened before Govern shipped froze nothing, and the widest
        reading of that is the honest one — it ran under no narrowing."""
        return cls(
            effective=from_snapshot(run.lens_snapshot),
            run_id=run.id,
            graph_id=run.graph_id,
            touches=TouchManager(),
        )

    # ── deciding ─────────────────────────────────────────────────────────────

    def check(self, address: str) -> Verdict:
        """What the frozen lens says about one participant. Pure, and cheap.

        Separate from recording because the two happen at different moments: the
        decision is taken **before** the call and the touch is written after it,
        carrying what the call cost.
        """
        return self.effective.decide(address)

    def egress_for(self, verdict: Verdict, *, carrying: tuple[str, ...] = PROMPT_CLASSES) -> Egress:
        """The cut for one crossing, against the parts this call would carry.

        ``carrying`` is what the caller has to send, not the vocabulary: a step
        with no history to pass does not record ``property_values`` as cut, and
        recording it would claim the lens removed something the run never held.

        An unbounded crossing ([GV30]) permits everything the caller holds —
        which is [GV7] one grain down: a rule nobody wrote narrows nothing.
        """
        if verdict.egress_unbounded:
            return Egress(classes=tuple(carrying), cut=())
        permitted = set(verdict.may_send)
        return Egress(
            classes=tuple(c for c in carrying if c in permitted),
            cut=tuple(c for c in carrying if c not in permitted),
        )

    # ── recording ────────────────────────────────────────────────────────────

    async def record(
        self,
        db: AsyncSession,
        emitter: Emitter,
        *,
        address: str,
        direction: TouchDirection | str,
        step_key: str | None = None,
        verdict: Verdict | None = None,
        volume: dict[str, Any] | None = None,
        applied: dict[str, Any] | None = None,
        sent: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        cost_usd: float | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Emit the frame, then project it — in that order, always ([GV28]).

        The frame carries the whole touch rather than a pointer at it, so the
        projection can be rebuilt from the ledger and loses to it on any
        disagreement ([GV20]).
        """
        payload: dict[str, Any] = {
            "address": address,
            "layer": address.split("/", 1)[0],
            "direction": TouchDirection(direction).value,
            "step_key": step_key,
            "rule_matched": verdict.rule_matched if verdict else None,
            "why": verdict.why if verdict else None,
            "volume": volume or {},
            "applied": applied or {},
            "sent": sent or {},
            "query": query or {},
            "cost_usd": cost_usd,
            "duration_ms": duration_ms,
        }
        frame = await emitter.emit("touch", payload)
        await self.touches.record(
            db,
            run_id=self.run_id,
            graph_id=self.graph_id,
            seq=frame.seq,
            address=address,
            direction=direction,
            step_key=step_key,
            verdict=verdict,
            volume=volume,
            applied=applied,
            sent=sent,
            query=query,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
        )


def is_fatal(address: str) -> bool:
    """Whether a run has anything left to do once this participant is refused.

    Two of the five layers are load-bearing for an answer — **the model a run
    thinks with** and **the graph data it is grounded on** — and denying either
    leaves nothing to answer from, so the run ends in *cannot answer* naming the
    rule. The other three are refused, recorded, and the run carries on without
    them ([GV29]). Never an engine failure either way: a bound doing its job is
    not a fault.
    """
    return address.split("/", 1)[0] in (Layer.llm.value, Layer.graph_data.value)
