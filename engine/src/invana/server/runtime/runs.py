"""HTTP routes for runs (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md): read, tail,
resume, cancel.

Opening a run happens through the sessions routes (a message *is* the ask);
these address the run in its own right.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.sessions.schemas import SendMessageResponse, SessionMessageRead
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime import emissions, services
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.interpreter.payloads import _retry_for
from invana.runtime.managers.rule_citations import offered_rules
from invana.runtime.models import RunStatus, TaskPrompt
from invana.runtime.projections import (
    Shape,
    accepts_reason,
    available_templates,
    select_template,
)
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.schemas import (
    AnswerPrompt,
    CancelResponse,
    EmissionRead,
    ResumeTaskRun,
    RunNodeRead,
    SwitchTemplate,
    TaskPromptRead,
    TaskRunListResponse,
    TaskRunRead,
    TemplateOffer,
    TraceRead,
    TraceStep,
)
from invana.runtime.stream import subscribe
from invana.runtime.workflows import WORKFLOWS
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

runs_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/runs", tags=["runs"])


def get_runtime(request: Request) -> TaskRuntime:
    return request.app.state.task_runtime


def _sse(generator) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@runs_router.get("", response_model=TaskRunListResponse)
async def list_runs(
    agent_id: str | None = Query(default=None, description="Runs this agent actually performed."),
    task_id: str | None = Query(default=None, description="Runs opened for this task."),
    kind: str | None = Query(
        default=None,
        description="One kind of work — `ask`, `import`, `bulk`. The journal's filter.",
    ),
    candidates: bool = Query(
        default=False,
        description="Generated plans that served and were never promoted — the Promote picker's list.",
    ),
    interactive: bool = Query(
        default=False,
        description="Include canvas and system runs — expansions, checks — which the journal hides by default.",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskRunListResponse:
    """List runs as rows — the plan and its verdict, without the steps.

    The route is deliberately one endpoint with filters rather than
    ``/agents/{id}/plans`` and ``/workflows/candidates``: both questions are
    "which runs match this?", and splitting them would have given *served* two
    definitions to drift apart. **The journal is the same endpoint**: a load is
    a run, so *what changed my graph* is ``?kind=import`` rather than a surface
    of its own (§ 6.7).
    """
    items, total = await services.list_runs(
        session,
        graph_id=graph.id,
        agent_id=agent_id,
        task_id=task_id,
        kind=kind,
        candidates=candidates,
        interactive=interactive,
        limit=limit,
    )
    return TaskRunListResponse(items=items, total=total)


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
    return TaskRunRead(
        **TaskRunRead.model_validate(th).model_dump(exclude={"steps"}),
        steps=[RunNodeRead.model_validate(s) for s in steps],
    )


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
        await services.cancel_waiting(session, run=th)
        await session.commit()
        return CancelResponse(id=th.id, status=th.status)
    if th.status in {RunStatus.queued.value, RunStatus.running.value}:
        await runtime.cancel(th.id)
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
    _, offers = select_template(templates, shape, intent="")
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
            effective = agent.effective_budget
            # Every ceiling the dashboard draws, not the two it drew first:
            # a run's spend reads against its **per-run** ceiling, and the
            # month one belongs beside it or neither number says its window
            # ([EB1](docs/for-developers/modules/agents/features/envelope-and-budget.md)).
            # `max_cost_usd` rides along for one release under its old name.
            budget = {
                key: effective.get(key)
                for key in (
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
            }
    priced = [step.cost_usd for step in steps if step.cost_usd is not None]
    # A statement, never an id: the wording each step was given, resolved once
    # for the whole trace (RU12).
    rules = await offered_rules(session, steps=steps)
    # The bound each attempt count is read against — resolved the way the
    # interpreter resolves it, so the page and the loop cannot disagree (SR67).
    workflow = WORKFLOWS.get(run.workflow_key)
    opened_by = await _username(session, run.on_behalf_of_user_id or run.author_id)

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
            duration_ms=_duration_ms(step.started_at, step.finished_at),
            tokens_in=step.tokens_in,
            tokens_out=step.tokens_out,
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
        workflow_key=run.workflow_key,
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
        opened_by=opened_by,
        clarifications=run.clarifications,
        replans=run.replans,
        lens_id=run.lens_id,
        lens_name=_lens_name(run),
        lens_ref=_lens_ref(run),
        governed=run.lens_snapshot is not None,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=_duration_ms(run.started_at, run.finished_at),
        tokens_in=sum(s.tokens_in or 0 for s in steps),
        tokens_out=sum(s.tokens_out or 0 for s in steps),
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


def _duration_ms(start, end) -> int | None:
    if start is None or end is None:
        return None
    return int((end - start).total_seconds() * 1000)


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
