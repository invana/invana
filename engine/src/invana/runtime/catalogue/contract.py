"""What every step in the catalogue is handed, and what it may raise.

``RunVars`` is the run's shared state, ``TaskContext`` is this step's slice of
the world (a DB session, the graph manager, the emitter, the step row), and
``Out`` is what a step returns. A step that cannot proceed raises
``NeedsInput`` (the model asked back — the run suspends) or ``TaskFailure``
carrying a failure **class**
(docs/for-developers/modules/ask/features/when-it-cannot-answer.md), so the
interpreter can decide between retry, diagnose and stop.

The shared failure builders live here too: every step group turns the same
``HTTPException`` and ``QueryExecutionError`` into the same diagnosis.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer
from invana.apps.govern.catalogue import CatalogueResolver
from invana.apps.govern.models import TouchDirection
from invana.apps.govern.query_lens import CompiledLens, compile_lens
from invana.apps.govern.rules import Decision, EgressClass, Verdict
from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.query_service import QueryExecutionError, resolve_query_language
from invana.apps.graphs.schemas import QueryResponse
from invana.apps.llm.intent import Intent
from invana.apps.llm.pricing import cost_usd
from invana.apps.llm.propose import ModelProposal
from invana.apps.llm_providers.models import LLMProvider
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import Session
from invana.apps.sessions.transcript import (
    _assemble_history,
)
from invana.apps.skills.models import Rule, Skill
from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.graph.types.lens import QueryLens
from invana.runtime.contention import PoolExhausted, PoolSlots
from invana.runtime.governing import Egress, Governor
from invana.runtime.models import TaskRun
from invana.runtime.stream import Emitter

# ── Contract ──────────────────────────────────────────────────────────────────


class TaskFailure(Exception):
    """A task failed. ``cls`` is the failure class from
    docs/for-developers/modules/ask/features/when-it-cannot-answer.md that decides the response.

    ``cause`` is the machine code for the diagnosis, ``message`` the user-facing
    sentence, ``evidence`` the structured facts it was derived from.
    """

    def __init__(
        self,
        *,
        cls: str,
        cause: str,
        message: str,
        short: str | None = None,
        evidence: dict | None = None,
        raw: str | None = None,
    ) -> None:
        super().__init__(message)
        self.cls = cls
        self.cause = cause
        self.message = message
        self.short = short or message
        self.evidence = evidence or {}
        self.raw = raw


class NeedsInput(Exception):
    """The model asked a question instead of answering
    (docs/for-developers/modules/ask/features/clarifying-questions.md)."""

    def __init__(self, *, question: str, options: list[str]) -> None:
        super().__init__(question)
        self.question = question
        self.options = options


class CannotAnswer(Exception):
    """The ask is outside this graph — a legitimate outcome, not a failure.

    The run **succeeds**: promise #4 is that Invana says so, visibly
    styled as *not* an answer, rather than inventing one or erroring. Raised by
    *Understand*, so the judgement lands before any query is written.
    """

    def __init__(self, *, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(slots=True)
class LoadVars:
    """One load's working state. Populated for ``ask_kind = "import"``.

    It lives here because nothing below the runtime describes a load any more:
    loading owns no records, so there is no app to declare this in
    (the-runtime-package.md § 4a). A stage hands the next one tens of thousands
    of parsed records and a plan document is not where that goes — the split
    `load-data.md` **LD21** keeps is that ``${steps.x.y}`` binds what the
    catalogue **declares**, which is counts and ids, so those ride the plan and
    the records ride here.
    """

    #: Where the records are, and what the run was opened against. The prologue
    #: settled these before the first node ran (**LD20**).
    root: str = ""
    model_id: str = ""
    version_id: str = ""
    #: Identity keys, read from `model.json` when the folder ships one.
    model_json: dict = field(default_factory=dict)
    # validate_records →
    valid_nodes: dict[str, list[dict]] = field(default_factory=dict)
    valid_edges: dict[str, list[dict]] = field(default_factory=dict)
    #: Edges whose endpoints these records do not carry — `stitch` decides.
    deferred: list[dict] = field(default_factory=list)
    #: Accumulated across stages, because a rejection found while stitching
    #: belongs in the same report as one found while validating.
    report: list[dict] = field(default_factory=list)
    total: int = 0
    # write_graph →
    counts: dict[str, dict[str, int]] = field(default_factory=dict)
    written: int = 0


@dataclass(slots=True)
class Out:
    detail: str
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    tokens_in: int | None = None
    tokens_out: int | None = None


@dataclass(slots=True)
class RunVars:
    """Everything the tasks of one run read and write."""

    graph: Graph
    sess: Session
    actor_id: str
    encryption_key: str
    user_message_id: str
    user_seq: int
    assistant_message_id: str
    mode: str  # "nl" | "ql"
    prompt: str
    # : On a resumed run (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) the question this pass
    # answers — ``prompt``
    #: is then the user's answer to it. Recorded in the step's input digest so
    #: every round of a multi-question clarification is auditable on its own.
    answering: str | None = None
    language: str | None = None
    timeout_s: float | None = None
    parameters: dict | None = None
    provider: LLMProvider | None = None
    history: list[dict] = field(default_factory=list)
    grounding: GraphVersion | None = None
    # The prose the agent carries into every prompt (docs/for-developers/modules/ask/features/reasoning-trace.md).
    # ``skills`` is
    # the rows; a model's self-reported name maps back to that skill's current
    # **version** id, so ``skills_applied`` stores what ``skills_offered`` does.
    skills: list[Skill] = field(default_factory=list)
    #: The statements always true in this run's scope — graph invariants, then
    #: the project's working rules, in that fixed order (skills/spec.md § 4).
    rules: list[Rule] = field(default_factory=list)
    instructions: str = ""
    # The agent this run thinks through, and the envelope that bounds it.
    agent: Any = None
    envelope: Any = None
    run: TaskRun | None = None
    #: The lens this run froze, as the thing that decides and records
    #: (docs/for-developers/modules/govern/spec.md GV26). It rides the run's
    #: state rather than the step's so no step can reach a different lens than
    #: the one the run opened under (GV8). ``None`` only outside the
    #: interpreter — a run always has one, and an ungoverned Graph's is the
    #: widest rather than absent.
    governor: Governor | None = None
    #: The Graph's pools, and what is in them right now
    #: ([CC8](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
    #: Process state, like the queue (CC7), so it is handed down on the run's
    #: vars rather than reached up for. ``None`` outside the interpreter, which
    #: reads as *unbounded* — nothing else in this file can take a pool slot
    #: without the run that owns it.
    pools: PoolSlots | None = None
    #: ``llm/<provider row>/<model>``, resolved once — see :func:`model_address`.
    model_address: str | None = None
    # understand →
    intent: Intent | None = None
    # plan →
    plan_steps: list = field(default_factory=list)
    plan_origin: str | None = None
    #: The library plan this run is executing, when one was selected. Written
    #: onto the root run when the plan lands (LB12).
    task_plan_id: str | None = None
    # verify →
    verdict: str | None = None
    # delegation → the children this run opened, and what they emitted (R2:
    # the parent reads the child's stream, never its return value)
    spawned: list[str] = field(default_factory=list)
    delegated: list[dict] = field(default_factory=list)
    # understand →
    query: str | None = None
    query_language: str | None = None
    via: str | None = None
    llm_ms: float | None = None
    rationale: str | None = None
    # execute / project →
    result: QueryResponse | None = None
    nodes: int = 0
    edges: int = 0
    summary: str | None = None
    # modeller
    model: GraphModel | None = None
    draft: GraphVersion | None = None
    proposal: ModelProposal | None = None
    counts: dict[str, int] | None = None
    #: The load this run is carrying out, when it is carrying one out. Owned
    #: by the catalogue's own body modules and only carried here (LD21).
    load: LoadVars | None = None


@dataclass(slots=True)
class TaskContext:
    db: AsyncSession
    manager: GraphConnectionManager
    emitter: Emitter
    step: TaskRun
    #: Set by the Plan step so the runtime can queue the rows the plan asks
    #: for; the runtime reads it after the step settles.
    planned: list | None = None
    #: The files this step read or wrote, in the order it touched them — what
    #: the step dashboard's Artifacts panel lists (SR38). It rides the context
    #: rather than ``Out`` so a step that raises still keeps what it had already
    #: read: *needs input* after reading four files read four files.
    artifacts: list[dict] = field(default_factory=list)
    #: The runtime, so a ``delegate`` step can start its child. Typed loosely
    #: to keep the task layer from importing the adapter it runs under.
    runtime: Any = None

    def artifact(self, name: str, *, direction: str, summary: str | None = None) -> None:
        """Record one file this step read or wrote.

        ``direction`` is ``read`` or ``written`` — the word the Artifacts panel
        shows as a chip, so a reader can tell a source from a product without
        opening either.
        """
        entry: dict[str, Any] = {"name": name, "direction": direction}
        if summary:
            entry["summary"] = summary
        self.artifacts.append(entry)

    async def emit(self, kind: str, payload: dict | None = None) -> None:
        await self.emitter.emit(kind, payload, idem_key=f"{self.step.id}:{kind}")

    async def progress(self, detail: str) -> None:
        """Update the step row's one-liner mid-flight and tell subscribers."""
        self.step.detail = detail[:255]
        await self.db.flush()
        await self.emitter.emit("step.progress", {"step_id": self.step.id, "detail": self.step.detail})


# ── the lens, at the moment a step engages something ──────────────────────────

_catalogue = CatalogueResolver()


# ── the pools a crossing draws on ─────────────────────────────────────────────

#: Which pool each crossing takes a slot in
#: ([CC8](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
#: Two, because two crossings exist. `heavy` is configured and has no call site
#: — graph algorithms are the thing it is for, and nothing dispatches one yet, so
#: naming it here would claim a bound nothing takes.
POOL_LLM = "llm"
POOL_GRAPHDB = "graphdb"


def _take_pool(ctx: TaskContext, v: RunVars, *, pool: str) -> str | None:
    """Hold a slot in ``pool`` for this crossing, or fail naming the pool.

    Returns the holder key, so the matching ``close_*`` can give the slot back;
    ``None`` when nothing is accounting — outside the interpreter, which is the
    same *unbounded* reading an absent governor gets.

    A pool that is full is a **bound**, not a query error: the question was
    fine, the machine is busy, and *a query error* would send the reader to fix
    a query that has nothing wrong with it (CC6 · CC8).
    """
    if v.pools is None or v.run is None:
        return None
    size = int((v.graph.pools or {}).get(pool, 0) or 0)
    holder = PoolSlots.holder(run_id=v.run.id, step_key=ctx.step.task_key, pool=pool)
    try:
        v.pools.acquire(graph_id=v.graph.id, pool=pool, size=size, holder=holder)
    except PoolExhausted as full:
        raise TaskFailure(
            cls="bound",
            cause="pool_exhausted",
            message=str(full),
            short=f"`{full.pool}` pool full",
            evidence={"pool": full.pool, "size": full.size},
        ) from full
    return holder


def _give_pool_back(v: RunVars, *, pool: str, holder: str | None) -> None:
    if v.pools is None or holder is None:
        return
    v.pools.release(graph_id=v.graph.id, pool=pool, holder=holder)


async def model_address(ctx: TaskContext, v: RunVars) -> str:
    """``llm/<provider row>/<model>`` — the participant a model call engages.

    Resolved through the catalogue rather than built here, so the string a run
    is checked at is the string a rule was written against; a second spelling of
    an address is a second participant
    (docs/for-developers/modules/govern/spec.md GV4). Cached on the run's state
    because the provider does not change mid-run and the resolution is a query.

    A model this Graph does not offer cannot be addressed, and an
    unaddressable participant cannot be governed — so it is refused rather than
    quietly permitted.
    """
    assert v.provider is not None
    if v.model_address is None:
        v.model_address = await _catalogue.llm_address(
            ctx.db, graph_id=v.graph.id, model_row_id=v.provider.model_row_id
        )
    if v.model_address is None:
        raise TaskFailure(
            cls="blocked",
            cause="unaddressable_provider",
            message="The LLM this run would call is not one this graph configures, so nothing can govern it.",
            short="provider not this graph's",
        )
    return v.model_address


async def engage(ctx: TaskContext, v: RunVars, *, address: str) -> Verdict:
    """Check one participant **before** the call, and record what was decided.

    A refusal is written to the ledger and then ends the run in *cannot answer*
    naming its rule, for the two layers a run cannot continue without
    (docs/for-developers/modules/govern/spec.md GV29). The run **succeeds**:
    a bound doing its job is not an engine failure, and the answer says what it
    could not reach.

    A run with no governor — anything driving a step outside the interpreter —
    is the widest, which is the same reading an ungoverned Graph gets (GV7).
    """
    if v.governor is None:
        return Verdict(decision=Decision.allowed, why="not narrowed")

    return await engaged(ctx, v, address=address, verdict=v.governor.check(address))


async def engaged(ctx: TaskContext, v: RunVars, *, address: str, verdict: Verdict) -> Verdict:
    """:func:`engage`'s tail, for a caller that has already decided.

    A graph read resolves the models a world named before it can say whether
    there is anything left to read ([GV33]), so it arrives here holding a
    verdict rather than an address to check. The recording and the refusal are
    the same either way — and they are here, once, because two places that end
    a run in *cannot answer* would be two places to forget the ledger.
    """
    if verdict.allowed:
        return verdict

    assert v.governor is not None
    await v.governor.record(
        ctx.db,
        ctx.emitter,
        address=address,
        direction=TouchDirection.refused,
        step_key=ctx.step.step_key,
        verdict=verdict,
    )
    reason = _refusal(address, verdict)
    await ctx.emit("cannot_answer", {"reason": reason, "stage": ctx.step.task_key, "address": address})
    raise CannotAnswer(reason=reason)


def _refusal(address: str, verdict: Verdict) -> str:
    """The sentence a refused run ends on, naming what refused it.

    [GR4](docs/for-developers/modules/govern/features/guardrails.md) wants a rule
    named, and a **closed layer** has none to name: nothing matched, because the
    layer admits only what it names ([GR15]). So the world is named instead —
    which is the actionable half anyway, since the recourse is to widen *this*
    world rather than to find a rule that does not exist.
    """
    where = f"is not in {verdict.narrowed_by}" if verdict.narrowed_by else "is not in this run's world"
    return f"{address} {where} — {verdict.why}."


async def touched(
    ctx: TaskContext,
    v: RunVars,
    *,
    address: str,
    verdict: Verdict,
    direction: TouchDirection | str = TouchDirection.out,
    volume: dict[str, Any] | None = None,
    applied: dict[str, Any] | None = None,
    sent: dict[str, Any] | None = None,
    query: dict[str, Any] | None = None,
    cost_usd: float | None = None,
    duration_ms: float | int | None = None,
) -> None:
    """Record the engagement that just happened, with what it cost.

    Called **after** the call rather than beside the check, because half of what
    a touch carries — rows, tokens, the executed digest — does not exist until
    the participant has answered.
    """
    if v.governor is None:
        return
    await v.governor.record(
        ctx.db,
        ctx.emitter,
        address=address,
        direction=direction,
        step_key=ctx.step.step_key,
        verdict=verdict,
        volume=volume,
        applied=applied,
        sent=sent,
        query=query,
        cost_usd=cost_usd,
        duration_ms=round(duration_ms) if duration_ms is not None else None,
    )


def egress_for(v: RunVars, verdict: Verdict, *, carrying: tuple[str, ...]) -> Egress:
    """What of ``carrying`` may accompany this crossing, and what may not."""
    if v.governor is None:
        return Egress(classes=tuple(carrying), cut=())
    return v.governor.egress_for(verdict, carrying=carrying)


# ── a model call, as a governed crossing ──────────────────────────────────────


@dataclass(slots=True)
class ModelCrossing:
    """One governed model call: who is engaged, and what may go with the ask.

    Every ``llm`` entry opens one before it builds a prompt and closes
    one after the model answers. The two halves are separate because half of
    what a touch carries — tokens, cost, how long it took — does not exist
    until the model has replied
    ([GV28](docs/for-developers/modules/govern/spec.md)).
    """

    address: str
    verdict: Verdict
    egress: Egress
    #: The `llm` pool slot this crossing holds, given back by ``close_model``.
    #: ``None`` when nothing is accounting.
    pool_holder: str | None = None

    @property
    def may_send(self) -> frozenset[str] | None:
        """What the prompt builders cut against — ``None`` is unbounded."""
        return None if self.verdict.egress_unbounded else frozenset(self.egress.classes)

    def history(self, history: list[dict]) -> list[dict]:
        """The conversation, or none of it.

        Prior turns carry results, and a result is property values. A world that
        does not send them does not send the transcript that quotes them — the
        cut is to the part, before the prompt exists ([GV31]).
        """
        return history if self.egress.permits(EgressClass.property_values) else []


def _carrying(*, grounding: object | None, history: list[dict]) -> tuple[str, ...]:
    """What *this* call would send, of what a prompt can send at all.

    Only what the step actually holds: a step with no history to pass must not
    record ``property_values`` as cut, because that claims the lens removed
    something the run never had.
    """
    classes: list[str] = []
    if grounding is not None:
        classes += [EgressClass.type_names.value, EgressClass.property_names.value]
    classes.append(EgressClass.the_question.value)
    if history:
        classes.append(EgressClass.property_values.value)
    return tuple(classes)


async def open_model(ctx: TaskContext, v: RunVars, *, grounding: object | None = None) -> ModelCrossing:
    """Check the model before the prompt is built, and work out the cut.

    A denied model ends the run in *cannot answer* naming its rule: there is
    nothing left to think with, and that is the run **succeeding** with a
    refusal rather than erroring ([GV29]).
    """
    address = await model_address(ctx, v)
    verdict = await engage(ctx, v, address=address)
    egress = egress_for(v, verdict, carrying=_carrying(grounding=grounding, history=v.history))
    if not egress.permits(EgressClass.the_question):
        # The one class a call cannot proceed without. Refusing here rather than
        # sending an empty prompt: a model asked nothing answers nothing, and an
        # answer grounded in no question is the outcome this module exists to
        # prevent.
        reason = f"This run's world does not let the question reach {address}, so there is nothing to ask it."
        await touched(
            ctx,
            v,
            address=address,
            verdict=verdict,
            direction=TouchDirection.refused,
            sent=egress.as_sent(to=address),
        )
        await ctx.emit("cannot_answer", {"reason": reason, "stage": ctx.step.task_key, "address": address})
        raise CannotAnswer(reason=reason)
    # The pool is taken **after** the lens has spoken: a call this world refuses
    # must not first consume a slot somebody else could have used.
    holder = _take_pool(ctx, v, pool=POOL_LLM)
    return ModelCrossing(address=address, verdict=verdict, egress=egress, pool_holder=holder)


async def close_model(
    ctx: TaskContext, v: RunVars, crossing: ModelCrossing, *, usage, duration_ms: float | None
) -> None:
    """Record what the call engaged, and what it cost — and give the slot back."""
    _give_pool_back(v, pool=POOL_LLM, holder=crossing.pool_holder)
    tokens_in = usage.input_tokens if usage else None
    tokens_out = usage.output_tokens if usage else None
    await touched(
        ctx,
        v,
        address=crossing.address,
        verdict=crossing.verdict,
        volume={k: n for k, n in (("tokens_in", tokens_in), ("tokens_out", tokens_out)) if n is not None},
        sent=crossing.egress.as_sent(to=crossing.address),
        cost_usd=cost_usd(v.provider, tokens_in, tokens_out),
        duration_ms=duration_ms,
    )


# ── a graph read, as a governed crossing ──────────────────────────────────────


@dataclass(slots=True)
class GraphCrossing:
    """The version a query reads, and what this world lets it read of it."""

    address: str | None = None
    verdict: Verdict | None = None
    #: Handed to the connector, which composes the predicate and rewrites the
    #: projection **before** execution. ``None`` narrows nothing, and the query
    #: then runs byte-identical ([GV7]).
    lens: QueryLens | None = None
    #: The authored model versions whose rules reached this read
    #: ([GV33](docs/for-developers/modules/govern/spec.md)). Recorded on the
    #: touch, so a run can answer *what bound me* months later without
    #: ``lens_snapshot`` carrying a copy of the schema.
    bound_by: tuple[str, ...] = ()
    #: What compiling the lens decided, in the words the world was authored in —
    #: the per-type slice and the per-type exclusions
    #: ([WO17](docs/for-developers/modules/govern/features/worlds.md)). Kept
    #: beside the connector's lens rather than inside it, because a connector has
    #: no use for `time` · `geo` · `dims` and a person reading the touch has
    #: nothing else.
    compiled: CompiledLens | None = None
    #: The `graphdb` pool slot this read holds, given back by ``close_graph``.
    #: ``None`` when nothing is accounting.
    pool_holder: str | None = None

    @property
    def governed(self) -> bool:
        return self.address is not None and self.verdict is not None


async def open_graph(ctx: TaskContext, v: RunVars) -> GraphCrossing:
    """Check the version this run is grounded on, and compile what it may read.

    A run with no published model version has nothing in ``graph_data`` to
    address, and an unaddressable participant cannot be checked. That is the
    widest reading and the honest one — **except** where the lens has *closed*
    the layer ([GV23](docs/for-developers/modules/govern/spec.md)), which says
    only what it names is in view: naming nothing and reading everything is the
    one way a closed layer could fail open, so it is refused instead.
    """
    governor = v.governor
    address = await _catalogue.version_address(ctx.db, version_id=v.grounding.id) if v.grounding is not None else None
    if address is None:
        if governor is not None and Layer.graph_data in governor.effective.closed_layers:
            raise CannotAnswer(
                reason=(
                    "This run's world allow-lists graph data, and this graph publishes no model version "
                    "to allow — so there is nothing it may read."
                )
            )
        return GraphCrossing(pool_holder=_take_pool(ctx, v, pool=POOL_GRAPHDB))

    assert v.grounding is not None
    if governor is None:
        verdict = await engage(ctx, v, address=address)
        return GraphCrossing(address=address, verdict=verdict, pool_holder=_take_pool(ctx, v, pool=POOL_GRAPHDB))

    # The authored models first: a rule naming one of them bounds the types it
    # declares, and that is what decides whether this read has anything left
    # ([GV33]). Compiling before deciding is the whole of the change — the
    # grounding version's own address is often *not* what a world names.
    bindings = await _catalogue.model_bindings(ctx.db, graph_id=v.graph.id, excluding=address)
    own = governor.check(address)
    compiled = compile_lens(governor.effective, version=v.grounding, verdict=own, bindings=bindings)
    lens = compiled.query_lens
    bound_by = tuple(b.address for b in bindings if governor.check(b.address).rule_matched is not None)

    verdict = _graph_verdict(own, lens, bound_by)
    await engaged(ctx, v, address=address, verdict=verdict)
    return GraphCrossing(
        address=address,
        verdict=verdict,
        lens=(lens if not lens.is_empty else None),
        bound_by=bound_by,
        compiled=compiled,
        # Taken last: a read this world refuses must not first consume a
        # connection somebody else could have used.
        pool_holder=_take_pool(ctx, v, pool=POOL_GRAPHDB),
    )


def _graph_verdict(own: Verdict, lens: QueryLens, bound_by: tuple[str, ...]) -> Verdict:
    """The decision for the read, once the named models have been resolved.

    A world that closes ``graph_data`` and names four authored models does not
    name the mirror the run is grounded on, so ``own`` is a refusal — and taking
    it at face value is what made every such world answer *cannot answer*
    ([GV33]). What the world actually said is *these types and no others*, and
    that is a bound, not a refusal.

    **Only a closed-layer refusal is rescued.** ``rule_matched`` set means a
    rule denied the grounding version by name, and deny wins at any specificity
    ([GV5]) — a named model must not punch through it. And a rescue needs
    something admitted: an allow-list that admits no type is a world with
    nothing in view, which is a refusal however it was written.
    """
    if own.allowed or own.rule_matched is not None:
        return own
    if not lens.allowed_types:
        return own
    count = len(bound_by)
    named = f"{count} participant{'' if count == 1 else 's'} this world names" if count else "this world"
    return Verdict(
        decision=Decision.allowed,
        rule_matched=own.rule_matched,
        # The count, not the list: `bound_by` rides the touch, and a `why` that
        # names seventeen addresses is a sentence nobody reads.
        why=f"bound to {len(lens.allowed_types)} type(s) by {named}",
    )


async def close_graph(
    ctx: TaskContext,
    v: RunVars,
    crossing: GraphCrossing,
    *,
    result,
    digests: dict[str, str],
) -> None:
    """Record the read, both digests, and what the lens did to the query.

    ``in``: the data came *to* the run, and ``rows`` is the only count there is
    ([WO19](docs/for-developers/modules/govern/features/worlds.md)) — what the
    unsliced query would have returned is knowable only by running it, and that
    is a second execution on every governed read.
    """
    # The slot first, and before the early return: an ungoverned read still took
    # a connection, and a pool that only ever shrinks is worse than no pool.
    _give_pool_back(v, pool=POOL_GRAPHDB, holder=crossing.pool_holder)
    if not crossing.governed:
        return
    assert crossing.address is not None and crossing.verdict is not None
    await touched(
        ctx,
        v,
        address=crossing.address,
        verdict=crossing.verdict,
        direction=TouchDirection.into,
        volume={"rows": result.row_count},
        applied=_applied(crossing.verdict, result, bound_by=crossing.bound_by, compiled=crossing.compiled),
        query={"generated_sha256": digests["generated"], "executed_sha256": digests["executed"]},
        duration_ms=result.execution_time_ms,
    )


#: The key a narrowing written against the grounding version itself is filed
#: under, so ``applied.select`` is one shape whatever authored it ([WO17]).
_GROUNDING = "*"


def _applied(
    verdict: Verdict,
    result,
    *,
    bound_by: tuple[str, ...] = (),
    compiled: CompiledLens | None = None,
) -> dict:
    """What the lens did to this query, as the step dashboard reads it back.

    **``select`` and ``properties_excluded`` are keyed by type**
    ([WO17](docs/for-developers/modules/govern/features/worlds.md)). A world that
    narrows by naming authored models compiles a slice per type, and the read's
    own verdict carries none of them — so both come off the compiled lens, which
    is where the answer actually is. The verdict is the fallback for the one
    shape that has no compiled lens: a rule written directly against the
    grounding version, whose narrowing is the whole read's and is recorded under
    that version's own name.

    ``projected`` names the returns the projection rewrote and ``composed`` the
    types a predicate was composed onto. Empty keys are dropped, so *nothing was
    narrowed* is an empty object rather than four empty containers claiming four
    narrowings.

    ``models`` is what [GV33](docs/for-developers/modules/govern/spec.md) wants
    kept: the authored versions whose rules reached this read. The resolution
    happens at run open against the live catalogue, so recording the answer is
    what lets a run say *what bound me* after one of those versions is archived.
    """
    out: dict = {}
    if bound_by:
        out["models"] = list(bound_by)

    selects = dict(compiled.selects) if compiled else {}
    excluded = {k: list(v) for k, v in compiled.excluded.items()} if compiled else {}
    # The version's own name is the only type key an uncompiled narrowing has:
    # the rule named the grounding version, not a type inside it.
    if not selects and verdict.select:
        selects = {_GROUNDING: dict(verdict.select)}
    if not excluded and verdict.properties_excluded:
        excluded = {_GROUNDING: list(verdict.properties_excluded)}

    if selects:
        out["select"] = {k: dict(v) for k, v in selects.items()}
    if excluded:
        out["properties_excluded"] = excluded
    composed = result.composed
    if composed is not None and composed.projected:
        out["projected"] = list(composed.projected)
    if composed is not None and composed.composed:
        out["composed"] = list(composed.composed)
    return out


# ── a graph write, as a governed crossing ─────────────────────────────────────


@dataclass(slots=True)
class Writes:
    """The model versions one step writes into — checked before, recorded after.

    A write is addressed by the version it lands in, the same string a read
    engages ([GV35](docs/for-developers/modules/govern/spec.md)), so *which runs
    touched Deals* finds the loads beside the questions. Only ``allow`` decides:
    a write that honoured a slice or a property exclusion would load half a
    record and call it a load.

    One per step, because a stitch writes into two models at once and a step
    that solves ten stitches over the same pair is one touch per model, not ten.
    """

    ctx: TaskContext
    v: RunVars
    #: address → what the lens said, for every version this step asked about.
    verdicts: dict[str, Verdict] = field(default_factory=dict)
    #: version id → address, ``None`` for a version the catalogue cannot name.
    addresses: dict[str, str | None] = field(default_factory=dict)
    nodes: dict[str, int] = field(default_factory=dict)
    edges: dict[str, int] = field(default_factory=dict)

    async def _address(self, version_id: str) -> str | None:
        if version_id not in self.addresses:
            self.addresses[version_id] = await _catalogue.version_address(self.ctx.db, version_id=version_id)
        return self.addresses[version_id]

    async def admit(self, version_id: str | None, *, fatal: bool = True) -> bool:
        """Whether this step may write into *version_id*.

        ``fatal`` is the write target: refusing it ends the run in *cannot
        answer* naming the rule, before anything is written ([GV29]). A stitch's
        other side is not fatal — the stitch is skipped, its refusal recorded
        once, and the step carries on with the rest.
        """
        address = await self._address(version_id) if version_id else None
        if address is None or self.v.governor is None:
            return True
        if address in self.verdicts:
            return self.verdicts[address].allowed
        verdict = self.v.governor.check(address)
        self.verdicts[address] = verdict
        if verdict.allowed or fatal:
            await engaged(self.ctx, self.v, address=address, verdict=verdict)
            return True
        await touched(self.ctx, self.v, address=address, verdict=verdict, direction=TouchDirection.refused)
        return False

    def wrote(self, version_id: str | None, *, nodes: int = 0, edges: int = 0) -> None:
        address = self.addresses.get(version_id or "")
        if address is None:
            return
        self.nodes[address] = self.nodes.get(address, 0) + nodes
        self.edges[address] = self.edges.get(address, 0) + edges

    async def close(self) -> None:
        """One ``out`` touch per version something landed in.

        Admitted is not touched: a load's `stitch` checks every active stitch,
        and one scoped to records this load did not write merges nothing. A
        touch there would say the run reached a model it never wrote to (ST53).
        """
        for address, verdict in self.verdicts.items():
            nodes, edges = self.nodes.get(address, 0), self.edges.get(address, 0)
            if not verdict.allowed or not nodes + edges:
                continue
            await touched(
                self.ctx,
                self.v,
                address=address,
                verdict=verdict,
                direction=TouchDirection.out,
                volume={"rows": nodes + edges, "nodes": nodes, "edges": edges},
            )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _provider_label(p: LLMProvider) -> str:
    return f"{p.provider.value} · {p.model_id}"


def _line_count(text: str) -> int:
    return text.count("\n") + 1


_CYPHER_LABEL = re.compile(r":\s*`?([A-Za-z_][A-Za-z0-9_]*)`?")
_GREMLIN_LABEL = re.compile(r"hasLabel\(\s*['\"]([^'\"]+)['\"]")


async def query_language_for(ctx: TaskContext, v: RunVars, *, strict: bool) -> str:
    """The dialect this run speaks, resolved once and remembered on ``RunVars``.

    Reading the connector's dialect is **connection metadata, not a graph
    read** — no query is sent — which is why it lives here, in the shared
    contract, rather than pulling ``apps/graphs`` into a bound module that
    would then span two bounds.

    ``strict`` is the difference between the two callers. *Translate* needs a
    real dialect to ground the prompt, so an unavailable connection is its
    failure to report. *Validate*'s check is textual: when the connection
    cannot say, Cypher's markers are the fallback and *Execute* reports the
    connection.
    """
    if v.query_language:
        return v.query_language
    if v.language:
        v.query_language = v.language
        return v.query_language
    try:
        v.query_language = (await resolve_query_language(ctx.db, graph=v.graph, manager=ctx.manager)).value
    except HTTPException as exc:
        if strict:
            raise http_failure(exc) from exc
        v.query_language = "cypher"
    return v.query_language


def labels_in(query: str, language: str | None) -> list[str]:
    """Best-effort label scan for the Validate step's description."""
    pattern = _GREMLIN_LABEL if language == "gremlin" else _CYPHER_LABEL
    seen: list[str] = []
    for m in pattern.finditer(query):
        name = m.group(1)
        if name not in seen:
            seen.append(name)
        if len(seen) >= 6:
            break
    return seen


# The connection/config codes ``query_service`` raises carry a machine code and
# no prose, so each needs a sentence of its own here.
_HTTP_MESSAGES = {
    "no_connection": "This graph has no graph connection yet.",
    "graph_not_active": "The graph connection is not active right now.",
    "unsupported_query_language": "The connection speaks neither Cypher nor Gremlin.",
}


def http_failure(exc: HTTPException) -> TaskFailure:
    """A config/availability answer about the graph — never an engine defect.

    The detail is a machine code, so a missing ``message`` must not fall
    through to ``str(detail)``: the reader would get a Python dict where a
    sentence belongs.
    """
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    code = str(detail.get("error") or "")
    message = str(detail.get("message") or _HTTP_MESSAGES.get(code) or "The graph connection is not available.")
    if code == "read_only_graph":
        return TaskFailure(cls="blocked", cause="query_not_read_only", message=message, short="not read-only")
    return TaskFailure(
        cls="blocked", cause="db_unreachable", message=message, short="no connection", evidence={"error": code}
    )


def _query_failure(exc: QueryExecutionError, *, query: str, mode: str) -> TaskFailure:
    if exc.category == QueryErrorCategory.TIMEOUT:
        return TaskFailure(
            cls="transient",
            cause="timeout",
            message="The graph did not answer in time.",
            short="timeout",
            evidence={"generated_query": query, "error": str(exc)},
            raw=str(exc),
        )
    if exc.category == QueryErrorCategory.SYNTAX:
        return TaskFailure(
            cls="repairable",
            cause="query_invalid",
            message=(
                "I couldn't turn that into a query the graph accepts."
                if mode == "nl"
                else f"The graph rejected the query: {exc}"
            ),
            short="query rejected",
            evidence={"generated_query": query, "error": str(exc)},
            raw=str(exc),
        )
    return TaskFailure(
        cls="transient",
        cause="db_error",
        message="The graph returned an error." if mode == "nl" else str(exc),
        short="graph error",
        evidence={"generated_query": query, "error": str(exc)},
        raw=str(exc),
    )


# ── nl-query / ql-query ───────────────────────────────────────────────────────


def offered_skill_version_ids(v: RunVars) -> list[str]:
    """What prompt assembly is about to put in front of the model.

    Recorded on the step **before** the call, because *offered* is a fact about
    the prompt — it stays true whether or not the model says anything about it.

    The **version** is what is recorded, never the bare skill id
    ([SK3](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
    the prose in this prompt is one particular published text, and a count that
    spans a rewrite is a claim about two different skills wearing one name
    ([US3](docs/for-developers/modules/skills/features/usage.md)).
    """
    return [s.current_version_id for s in v.skills if s.current_version_id]


def offered_rule_version_ids(v: RunVars) -> list[str]:
    """The rule versions this prompt carries, in the order it carries them.

    A fact about the prompt, recorded before the call — the same shape and the
    same reason as the skills above (RU7).
    """
    return [r.current_version_id for r in v.rules if r.current_version_id]


def cited_rule_version_ids(v: RunVars, statements: list[str]) -> list[str]:
    """Map the model's citations back to the versions it was offered.

    The model cites a rule by its **statement**, because that is what it was
    shown; anything that does not match one of the offered statements is
    dropped, exactly as an unknown skill name is. A rule is offered and cited,
    never enforced (RU5) — nothing downstream reads this as permission.
    """
    by_statement = {r.statement.strip().lower(): r.current_version_id for r in v.rules if r.current_version_id}
    return [by_statement[k] for s in statements if (k := s.strip().lower()) in by_statement]


def _report_ids(v: RunVars, names: list[str]) -> list[str]:
    """Map the model's self-reported skill names back to version ids.

    A name the graph does not have is dropped rather than stored: a report
    about a skill that was never offered is noise, not evidence.
    """
    by_name = {s.name.lower(): s.current_version_id for s in v.skills if s.current_version_id}
    return [by_name[n.lower()] for n in names if n.lower() in by_name]


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _sha(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()[:12]


async def load_grounding(db: AsyncSession, graph_id: str) -> GraphVersion | None:
    return await SessionManager()._grounding_version(db, graph_id)


def assemble_history(rows) -> list[dict]:
    return _assemble_history(rows)
