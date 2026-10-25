"""HTTP routes for runs (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): read, tail,
resume, re-run, cancel.

Opening a run happens through the sessions routes (a message *is* the ask);
these address the run in its own right.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.querysets.asks import AskQuerySet, pending_for
from invana.apps.agents.models import Agent
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.apps.sessions.schemas import SendMessageResponse, SessionMessageRead
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.runtime import emissions, services
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.interpreter.payloads import _retry_for
from invana.runtime.managers.rule_citations import offered_rules
from invana.runtime.managers.run_pages import PendingAsk, RunPageManager
from invana.runtime.managers.run_stats import MAX_DAYS, RunStatsManager
from invana.runtime.models import RunStatus, TaskPrompt, TaskRun, span_ms
from invana.runtime.projections import (
    Shape,
    accepts_reason,
    available_templates,
    select_template,
)
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.results import run_tokens, step_progress
from invana.runtime.schemas import (
    RUN_LIST,
    AnswerPrompt,
    CancelResponse,
    EmissionRead,
    ResumeTaskRun,
    RunAgents,
    RunAssets,
    RunNodeRead,
    RunOverview,
    RunRerun,
    RunRerunResponse,
    RunStages,
    RunStats,
    RunTouched,
    SwitchTemplate,
    TaskPromptRead,
    TaskRunRead,
    TaskRunSummary,
    TemplateOffer,
    TraceRead,
    TraceStep,
)
from invana.runtime.stream import subscribe
from invana.runtime.workflows import WORKFLOWS
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

runs_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/runs", tags=["runs"])
#: Runs across every Graph the reader is a member of — the Imports page's tiles.
install_runs_router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


def get_runtime(request: Request) -> TaskRuntime:
    return request.app.state.task_runtime


def _sse(generator) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@runs_router.get("", response_model=Page[TaskRunSummary])
async def list_runs(
    params: ListParams = Depends(list_params(RUN_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Page[TaskRunSummary]:
    """List runs as rows — the plan and its verdict, without the steps.

    One endpoint with filters rather than ``/agents/{id}/plans`` and
    ``/flows/candidates``: both questions are "which runs match this?", and
    two endpoints would give *served* two definitions to drift apart. **The
    journal is the same endpoint**: a load is a run, so *what changed my
    graph* is ``?kind=import`` rather than a surface of its own.
    """
    items, info = await services.list_runs(session, graph_id=graph.id, params=params)
    labels = await services.run_filter_labels(session, graph_id=graph.id, params=params)
    return Page[TaskRunSummary].of(
        [TaskRunSummary.model_validate(i) for i in items], info, applied_filters(params, RUN_LIST, labels)
    )


@runs_router.get("/stats", response_model=RunStats)
async def run_stats(
    days: int = Query(default=1, ge=1, le=MAX_DAYS, description="The window in the reader's days; 1 is today."),
    tz: str = Query(default="UTC", description="The reader's IANA time zone — where midnight is."),
    kind: list[str] | None = Query(default=None, description="Only these kinds of work — `ask`, `import`, `bulk`."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunStats:
    """The journal's tiles for this Graph — *In flight*, *Today*, *Tokens today*,
    *Slowest*, *Served* and *Not served* — counted over every root run in the
    window, and *Waiting on you*: the pending asks naming the reader."""
    waiting = await AskQuerySet().count_for_approver(session, graph_ids=[graph.id], user_id=user.id)
    return await RunStatsManager().stats(
        session, graph_ids=[graph.id], kinds=kind, days=days, tz=tz, waiting_approvals=waiting
    )


@install_runs_router.get("/stats", response_model=RunStats)
async def install_run_stats(
    days: int = Query(default=30, ge=1, le=MAX_DAYS, description="The window in the reader's days; 1 is today."),
    tz: str = Query(default="UTC", description="The reader's IANA time zone — where midnight is."),
    kind: list[str] | None = Query(default=None, description="Only these kinds of work — `ask`, `import`, `bulk`."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunStats:
    """The same tiles over every Graph the reader is a member of — the Imports
    page's counts, median time and imports a day."""
    graph_ids = await GraphMemberQuerySet().graph_ids_for_user(session, user_id=user.id)
    waiting = await AskQuerySet().count_for_approver(session, graph_ids=graph_ids, user_id=user.id)
    return await RunStatsManager().stats(
        session, graph_ids=graph_ids, kinds=kind, days=days, tz=tz, waiting_approvals=waiting
    )


@runs_router.get("/{run_id}", response_model=TaskRunRead)
async def get_run(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRunRead:
    th = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    steps = await services.list_steps(session, run_id=th.id)
    read = TaskRunRead(
        **TaskRunRead.model_validate(th).model_dump(exclude={"steps"}),
        steps=[RunNodeRead.model_validate(s) for s in steps],
    )
    read.steps_done, read.steps_total = step_progress(steps)
    if read.run_tokens is None:
        # Still going: the same sum the settle stores, read from the rows so far.
        read.run_tokens_in, read.run_tokens_out = run_tokens(th, steps)
        read.run_tokens = read.run_tokens_in + read.run_tokens_out
    return read


# ---------------------------------------------------------------------------
# The run page (docs/for-developers/modules/agents/features/the-run-page.md)
# ---------------------------------------------------------------------------


async def _pending_asks(session: AsyncSession, graph: Graph) -> list[PendingAsk]:
    """The Graph's pending asks, for the run page to keep the ones raised in its tree."""
    return [PendingAsk.of(a) for a in await pending_for(session, graph_id=graph.id)]


@runs_router.get("/{run_id}/overview", response_model=RunOverview)
async def run_overview(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunOverview:
    """The run page's Overview — head, tiles, agents over time, steps a minute,
    what waits on the reader, and past fifty agents the large-run reading."""
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    asks = await _pending_asks(session, graph)
    return await RunPageManager().overview(session, run=run, reader_id=user.id, asks=asks)


@runs_router.get("/{run_id}/agents", response_model=RunAgents)
async def run_agents(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunAgents:
    """Who spawned whom in this run, its pending delegation asks, and its roles."""
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    asks = await _pending_asks(session, graph)
    return await RunPageManager().agents(session, run=run, asks=asks)


@runs_router.get("/{run_id}/stages", response_model=RunStages)
async def run_stages(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunStages:
    """The run's stages — one per step key, in plan order, with counts in and out."""
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    return await RunPageManager().stages(session, run=run)


@runs_router.get("/{run_id}/assets", response_model=RunAssets)
async def run_assets(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunAssets:
    """Every emission, file, branch and Todo the run produced."""
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    return await RunPageManager().assets(session, run=run)


@runs_router.get("/{run_id}/touched", response_model=RunTouched)
async def run_touched(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RunTouched:
    """What the run engaged — graph types, web domains, models and secrets."""
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    return await RunPageManager().touched(session, run=run)


@runs_router.get("/{run_id}/stream")
async def stream_run(
    request: Request,
    run_id: str = Path(...),
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE tail of a run's stream: replay after the cursor, then live.

    ``Last-Event-ID`` (set by the browser on reconnect) wins over ``after``.
    The request-scoped DB session is released before the generator starts —
    the tail opens its own for the replay.
    """
    await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    if last_event_id and last_event_id.isdigit():
        after = int(last_event_id)
    factory = request.app.state.db_session_factory
    return _sse(subscribe(factory, run_id=run_id, after=after))


@runs_router.post("/{run_id}/resume", response_model=SendMessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def resume_run(
    payload: ResumeTaskRun,
    run_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> SendMessageResponse:
    """Answer a clarification — the same run continues (UC7)."""
    # Deferred: sessions ↔ run is a real two-way need (migration-plan §14).
    from invana.apps.sessions.managers import SessionManager  # noqa: PLC0415

    th = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    sess = await SessionManager().get_or_404(session, session_id=th.session_id, graph_id=graph.id, user_id=user.id)
    user_msg, assistant_msg = await services.resume_turn(session, sess=sess, run=th, answer=payload.answer)
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    runtime.submit(th.id)
    return SendMessageResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
        result=None,
        run_id=th.id,
        stream_url=services.stream_url(username, graphSlug, th.id),
    )


@runs_router.post("/{run_id}/rerun", response_model=RunRerunResponse, status_code=status.HTTP_202_ACCEPTED)
async def rerun_run(
    payload: RunRerun,
    run_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> RunRerunResponse:
    """Re-run an ended ask on the versions it recorded (``same``), on today's
    (``current``), or retuned — agent version, model version, run budget, world."""
    th = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    retune = services.Retune(
        agent_version=payload.agent_version,
        model_version=payload.model_version,
        max_tokens_run=payload.max_tokens_run,
        lens_id=payload.lens_id,
    )
    rerun = await services.rerun_run(
        session, graph=graph, run=th, versions=payload.versions, actor_id=user.id, retune=retune
    )
    await session.commit()
    runtime.submit(rerun.id)
    return RunRerunResponse(
        run_id=rerun.id,
        rerun_of_run_id=th.id,
        model_version=rerun.model_version,
        stream_url=services.stream_url(username, graphSlug, rerun.id),
    )


@runs_router.post("/{run_id}/cancel", response_model=CancelResponse, status_code=status.HTTP_202_ACCEPTED)
async def cancel_run(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> CancelResponse:
    """Stop run (UC9). A run in flight is cancelled; one parked on a question is closed."""
    th = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    if th.status == RunStatus.awaiting_input.value:
        await services.cancel_waiting(session, run=th, stopped_by=user.id)
        await session.commit()
        await runtime.cancel(th.id, stopped_by=user.id)
        return CancelResponse(id=th.id, status=th.status)
    if th.status in {RunStatus.queued.value, RunStatus.running.value}:
        await runtime.cancel(th.id, stopped_by=user.id)
        await session.refresh(th)
    return CancelResponse(id=th.id, status=th.status)


# ---------------------------------------------------------------------------
# Emissions — the answer, as records (the-answer-surface.md AS10)
# ---------------------------------------------------------------------------


async def _offers_for(session: AsyncSession, *, graph: Graph, emission) -> list[dict]:
    """Every template that would render this emission's records, and why the rest cannot.

    Rebuilt on read rather than stored: the set of templates changes when someone
    authors one, and a frozen list would quietly stop offering it.
    """
    shape = _shape_from_citation(emission)
    if shape is None:
        return []
    templates = await available_templates(session, graph_id=graph.id)
    _, offers = select_template(templates, shape)
    return offers


def _shape_from_citation(emission) -> Shape | None:
    """Recover the shape an emission was rendered from, without the records.

    A `payload` knows what it holds — a table its columns, a chart its series, a
    subgraph its nodes — so the picker can say what else accepts it without going
    back to the database.
    """
    payload = emission.payload or {}
    count = int((emission.citation or {}).get("record_count") or 0)
    if emission.kind == "subgraph":
        data = payload.get("data") or {}
        return Shape(
            result_type="graph",
            row_count=count,
            node_count=len(data.get("nodes") or []),
            edge_count=len(data.get("edges") or []),
        )
    if emission.kind == "empty":
        return Shape(result_type="tabular", row_count=0)
    rows = payload.get("rows") or []
    columns = tuple(payload.get("columns") or (rows[0].keys() if rows else ()))
    numeric = tuple(
        column
        for column in columns
        if rows
        and all(isinstance(row.get(column), (int, float)) and not isinstance(row.get(column), bool) for row in rows)
    )
    if emission.kind == "metric" and not columns:
        columns = (payload.get("label") or "value",)
    return Shape(result_type="tabular", row_count=count or len(rows), columns=columns, numeric_columns=numeric)


@runs_router.get("/{run_id}/emissions", response_model=list[EmissionRead])
async def list_emissions(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EmissionRead]:
    """The answer this run produced, in order.

    An emission is a record, so this is what makes an answer survive a reload
    (AS10) rather than living in the page until someone refreshes.
    """
    await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    rows = await emissions.list_for_run(session, run_id)
    out: list[EmissionRead] = []
    for row in rows:
        read = EmissionRead.model_validate(row)
        read.templates = [TemplateOffer(**offer) for offer in await _offers_for(session, graph=graph, emission=row)]
        out.append(read)
    return out


@runs_router.post("/{run_id}/emissions/{emission_id}/template", response_model=EmissionRead)
async def switch_emission_template(
    payload: SwitchTemplate,
    run_id: str = Path(...),
    emission_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EmissionRead:
    """Render the **same records** through another template (P5).

    The query never runs again. A template that cannot accept the shape is
    refused by name with its reason (P4) rather than rendering half-empty.
    """
    await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    emission = await emissions.get(session, emission_id)
    if emission is None or emission.run_id != run_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "emission_not_found", "emission_id": emission_id})

    shape = _shape_from_citation(emission)
    templates = await available_templates(session, graph_id=graph.id)
    template = next((t for t in templates if t.id == payload.template_id), None) if payload.template_id else None
    if payload.template_id and template is None:
        raise HTTPException(
            HTTPStatus.NOT_FOUND, detail={"error": "template_not_found", "template_id": payload.template_id}
        )
    if template is not None and shape is not None:
        reason = accepts_reason(template, shape)
        if reason is not None:
            raise HTTPException(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                detail={"error": "template_cannot_render", "template": template.name, "reason": reason},
            )

    emission.kind = template.surface if template else emission.kind
    if template is not None and template.surface == "markdown":
        emission.kind = "prose"
    emission.template_id = template.id if template else None
    await session.commit()

    read = EmissionRead.model_validate(emission)
    read.templates = [TemplateOffer(**offer) for offer in await _offers_for(session, graph=graph, emission=emission)]
    return read


# ---------------------------------------------------------------------------
# The trace (reasoning-trace.md)
# ---------------------------------------------------------------------------


_CEILINGS = (
    "max_tokens_run",
    "max_tokens_month",
    "max_tokens",
    "max_steps",
    "max_cost_usd",
    "max_cost_usd_run",
    "max_cost_usd_month",
    "max_concurrent_runs",
    "max_clarifications",
    "max_replans",
    "max_fanout",
)


def run_ceilings(run: TaskRun, agent: Agent) -> dict[str, Any]:
    """Every ceiling the run board draws a token count or a count against.

    Effort is its own column (EB9) and is read beside the token budgets. Every
    ceiling, not the two the board drew first: a run's tokens read against its
    **per-run** budget, and the month one belongs beside it or neither number
    says its window ([EB8](docs/for-developers/modules/agents/features/envelope-and-budget.md)).
    `max_tokens` is `max_tokens_run` under its old name, and the money keys are
    answered as the row stores them — both for one release.

    **The per-run budget is the one this run froze** — the session's tokens per
    run, already clamped to the agent's budget — never the agent's budget as it
    reads today. A run is drawn against the bound it opened with (AG25 · EB13).
    A run opened before tokens were frozen keeps the money cap it froze.
    """
    effective = {**agent.effective_budget, **agent.effective_effort}
    ceilings = {key: effective.get(key) for key in _CEILINGS}
    params = run.params or {}
    if params.get("max_tokens_run") is not None:
        ceilings["max_tokens_run"] = ceilings["max_tokens"] = params["max_tokens_run"]
    if params.get("max_cost_usd_run") is not None:
        ceilings["max_cost_usd_run"] = params["max_cost_usd_run"]
    return ceilings


@runs_router.get("/{run_id}/trace", response_model=TraceRead)
async def get_trace(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TraceRead:
    """The whole run, after the fact — every step with what it cost and what it read.

    This is part of the answer, not an admin view (RT1): if you can see the
    answer you can see how it was reached. What it shows is what the step
    *recorded* — offered and applied stay two separate lists (RT3), and nothing
    here is reconstructed after the fact.
    """
    run = await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    steps = await services.list_steps(session, run_id=run_id)
    # Which node delegated which run — read off the tree rather than a column.
    # A delegated run's parent *is* the node that delegated it, so one query
    # over the nodes answers it for the whole trace.
    delegated: dict[str, str] = {}
    if steps:
        for child in await TaskRunQuerySet().nodes_of_many(session, run_ids=[s.id for s in steps]):
            delegated.setdefault(child.parent_run_id or "", child.id)
    rows = await emissions.list_for_run(session, run_id)
    # The ceiling, so a spend can be drawn against it rather than as a bare
    # total (SR41 · SR20). Reading it is not enforcing it: pausing at the
    # ceiling is a budget approval (orchestration §0.10) and is not built here.
    budget = None
    if run.agent_id:
        agent = await AgentQuerySet().get(session, run.agent_id)
        if agent is not None:
            budget = run_ceilings(run, agent)
    priced = [step.cost_usd for step in steps if step.cost_usd is not None]
    # A statement, never an id: the wording each step was given, resolved once
    # for the whole trace (RU12).
    rules = await offered_rules(session, steps=steps)
    # The bound each attempt count is read against — resolved the way the
    # interpreter resolves it, so the page and the loop cannot disagree (SR67).
    workflow = WORKFLOWS.get(run.flow_key)
    opened_by = await _username(session, run.on_behalf_of_user_id or run.author_id)
    # The run's spend as the settle stored it; still going, the same sum so far.
    if run.run_tokens is not None:
        spent_in, spent_out = run.run_tokens_in or 0, run.run_tokens_out or 0
    else:
        spent_in, spent_out = run_tokens(run, steps)
    spent = spent_in + spent_out

    trace_steps = [
        TraceStep(
            id=step.id,
            seq=step.seq,
            attempt=step.attempt,
            task_key=step.task_key,
            label=step.label,
            status=step.status,
            detail=step.detail,
            started_at=step.started_at,
            finished_at=step.finished_at,
            duration_ms=step.duration_ms,
            offset_ms=span_ms(run.started_at, step.started_at),
            share_of_run=(
                round(step.duration_ms / run.duration_ms, 4)
                if step.duration_ms is not None and run.duration_ms
                else None
            ),
            tokens_in=step.tokens_in,
            tokens_out=step.tokens_out,
            tokens=step.tokens,
            share_of_run_tokens=round(step.tokens / spent, 4) if step.tokens is not None and spent else None,
            input=step.input,
            output=step.output,
            error=step.error,
            args=step.args,
            # The bound belongs to the catalogue entry, not to the run — read it
            # where it is declared so the two can never disagree (SR33).
            bound=_bound_of(step.task_key),
            max_attempts=_retry_for(workflow, step, run.plan_snapshot).max_attempts,
            step_key=step.step_key,
            lane=step.lane,
            result=step.result,
            skills_offered=step.skills_offered or [],
            skills_applied=step.skills_applied or [],
            rules_offered=[rules[r] for r in (step.rules_offered or []) if r in rules],
            rules_cited=[rules[r] for r in (step.rules_cited or []) if r in rules],
            child_run_id=delegated.get(step.id),
        )
        for step in steps
    ]
    return TraceRead(
        # `run_id`, not `parent_run_id`: this is the run being read, not a
        # parent of it. The rename to `parent_run_id` landed on the argument
        # and not on the field, and every call to this route raised a
        # ValidationError until it was put back.
        run_id=run.id,
        flow_key=run.flow_key,
        status=run.status,
        ask_kind=run.ask_kind,
        body=run.body,
        result=run.result,
        outcome=run.outcome,
        agent_id=run.agent_id,
        agent_version=run.agent_version,
        plan_origin=run.plan_origin,
        plan_revision=run.plan_revision,
        triggered_by=run.triggered_by,
        trace_id=run.trace_id,
        opened_by=opened_by,
        clarifications=run.clarifications,
        replans=run.replans,
        lens_id=run.lens_id,
        lens_name=_lens_name(run),
        lens_ref=_lens_ref(run),
        governed=run.lens_snapshot is not None,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        queue_ms=run.queue_ms,
        work_ms=run.work_ms,
        ask_ms=run.ask_ms,
        wait_ms=run.wait_ms,
        tokens_in=spent_in,
        tokens_out=spent_out,
        tokens=spent,
        # Summed over the rows that had a price. A run where nothing was priced
        # has no cost at all, not a total of the half it could price.
        cost_usd=round(sum(priced), 6) if priced else None,
        budget=budget,
        steps=trace_steps,
        emissions=[EmissionRead.model_validate(row) for row in rows],
        error=run.error,
    )


def _lens_contributor(run) -> dict | None:
    """The contributor a run's lens is named after — its world, else the first."""
    contributors = (run.lens_snapshot or {}).get("contributors") or []
    worlds = [c for c in contributors if c.get("kind") == "world"]
    return worlds[0] if worlds else (contributors[0] if contributors else None)


def _lens_ref(run) -> dict | None:
    first = _lens_contributor(run)
    if first and first.get("id") and first.get("kind"):
        return {"id": first["id"], "kind": first["kind"]}
    return {"id": run.lens_id, "kind": "world"} if run.lens_id else None


def _lens_name(run) -> str | None:
    """The world this run froze, by the name it had **then**.

    Read out of ``lens_snapshot``'s contributors rather than off the row, so a
    rename since does not rewrite what a past run says it ran under
    ([GR3](docs/for-developers/modules/govern/features/guardrails.md)). A
    snapshot written before names were carried falls back to the slug, and one
    with neither leaves this ``None`` — which reads *Everything*.
    """
    first = _lens_contributor(run)
    return (first.get("name") or first.get("key")) if first else None


async def _username(session: AsyncSession, user_id: str | None) -> str | None:
    if not user_id:
        return None
    return await session.scalar(select(User.username).where(User.id == user_id))


def _bound_of(task_key: str) -> str | None:
    """What a step spends, from the catalogue entry its ``task_key`` names.

    A root run names a plan rather than an entry, and a generated plan may name
    a key the catalogue does not carry — both read as ``None`` rather than as
    ``none``, which is a bound an entry can actually declare.
    """
    entry = CATALOGUE.get(task_key)
    return entry.bound.value if entry else None


# ---------------------------------------------------------------------------
# Answering a closed question (projections.md F1 · clarifying-questions.md)
# ---------------------------------------------------------------------------


@runs_router.post(
    "/{run_id}/answer",
    response_model=TaskPromptRead,
    status_code=status.HTTP_201_CREATED,
)
async def answer_prompt(
    payload: AnswerPrompt,
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskPromptRead:
    """Record what a person chose, as a value and an option id — never as prose (P3).

    Only a person answers a clarification (CQ5), which is why this route takes
    the current user as the answerer and offers no way to say otherwise. Resuming
    the run is a separate act: `POST …/resume` carries the answer into the same
    run (CQ4).
    """
    await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    answer = TaskPrompt(
        run_id=run_id,
        step_seq=payload.step_seq,
        template_id=payload.template_id,
        answered_by_kind="user",
        answered_by_id=user.id,
        value={**payload.value, **({"option_id": payload.option_id} if payload.option_id else {})},
    )
    session.add(answer)
    await session.commit()
    return TaskPromptRead.model_validate(answer)


@runs_router.get("/{run_id}/answers", response_model=list[TaskPromptRead])
async def list_prompt_answers(
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TaskPromptRead]:
    await services.get_run_or_404(session, run_id=run_id, graph_id=graph.id, user_id=user.id)
    stmt = select(TaskPrompt).where(TaskPrompt.run_id == run_id).order_by(TaskPrompt.answered_at)
    rows = (await session.execute(stmt)).scalars().all()
    return [TaskPromptRead.model_validate(row) for row in rows]
