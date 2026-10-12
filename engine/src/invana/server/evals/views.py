"""HTTP handlers for evals — parse, call ``EvalManager``, return.

An eval run is opened here and worked by the runtime once the request has
committed (``submit_eval``), like any run: the replays take minutes, and the
request does not hold them.
"""

from __future__ import annotations

from fastapi import Depends, Path, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.settings import settings
from invana.runtime.managers import EvalManager
from invana.runtime.schemas import (
    EvalBudgetRead,
    EvalBudgetWrite,
    EvalCaseRead,
    EvalCaseUpdate,
    EvalCaseWrite,
    EvalDrift,
    EvalDriftResponse,
    EvalPromote,
    EvalResultRead,
    EvalRunDetail,
    EvalRunOpen,
    EvalRunOpened,
    EvalRunRead,
    EvalSetRead,
    EvalSetWrite,
)
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

evals = EvalManager()


async def _set_read(session: AsyncSession, eval_set) -> EvalSetRead:
    cases = await evals.cases(session, eval_set=eval_set)
    return EvalSetRead(
        id=eval_set.id,
        subject_kind=eval_set.subject_kind,
        subject_id=eval_set.subject_id,
        judge_model_pin=eval_set.judge_model_pin,
        rubric=eval_set.rubric,
        cases=[EvalCaseRead.model_validate(c) for c in cases],
    )


async def get_set(
    subject_kind: str = Path(..., description="skill · agent"),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EvalSetRead:
    """The subject's eval set and its cases; an empty set when none was written."""
    eval_set = await evals.get_set(session, graph_id=graph.id, subject_kind=subject_kind, subject_id=subject_id)
    return await _set_read(session, eval_set)


async def put_set(
    payload: EvalSetWrite,
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalSetRead:
    """Set the judge's pin and rubric. A judge on the model under test is refused, naming both."""
    eval_set = await evals.put_set(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        actor_id=user.id,
        judge_model_pin=payload.judge_model_pin,
        rubric=payload.rubric,
    )
    return await _set_read(session, eval_set)


async def add_case(
    payload: EvalCaseWrite,
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalCaseRead:
    """Write a case, or propose one — a proposed case replays only once a person accepts it."""
    case = await evals.add_case(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        question=payload.question,
        checks=[c.model_dump() for c in payload.checks],
        label=payload.label,
        proposed=payload.proposed,
        actor_id=user.id,
    )
    return EvalCaseRead.model_validate(case)


async def propose(
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EvalCaseRead]:
    """The assistant's starter set from the subject's text — every case waits as proposed."""
    cases = await evals.propose(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        actor_id=user.id,
        encryption_key=settings.encryption_key,
    )
    return [EvalCaseRead.model_validate(c) for c in cases]


async def update_case(
    payload: EvalCaseUpdate,
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    case_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalCaseRead:
    """Accept a proposed case (``status: active``), relabel, retire, or rewrite it."""
    fields = payload.model_dump(exclude_unset=True)
    if payload.checks is not None:
        fields["checks"] = [c.model_dump() for c in payload.checks]
    case = await evals.update_case(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        case_id=case_id,
        actor_id=user.id,
        fields=fields,
    )
    return EvalCaseRead.model_validate(case)


async def delete_case(
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    case_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await evals.delete_case(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        case_id=case_id,
        actor_id=user.id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def open_run(
    payload: EvalRunOpen,
    request: Request,
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalRunOpened:
    """Replay every active case on live, on the candidate, or on both — 202, then poll the run."""
    run = await evals.open_run(
        session,
        graph_id=graph.id,
        subject_kind=subject_kind,
        subject_id=subject_id,
        side=payload.side,
        actor_id=user.id,
        trigger=payload.trigger,
        version=payload.version,
        model_pin=payload.model_pin,
    )
    await session.commit()
    request.app.state.task_runtime.submit_eval(run.id)
    return EvalRunOpened(run_id=run.id, status=run.status, detail=run.detail)


async def list_runs(
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[EvalRunRead]:
    runs = await evals.runs(session, graph_id=graph.id, subject_kind=subject_kind, subject_id=subject_id)
    return [EvalRunRead.model_validate(r) for r in runs]


async def get_run(
    subject_kind: str = Path(...),
    subject_id: str = Path(...),
    run_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EvalRunDetail:
    """One eval run: its summary, the gate's verdict and every case's result on each side."""
    run, results = await evals.run(
        session, graph_id=graph.id, subject_kind=subject_kind, subject_id=subject_id, run_id=run_id
    )
    return EvalRunDetail(
        **EvalRunRead.model_validate(run).model_dump(),
        results=[EvalResultRead.model_validate(r) for r in results],
    )


async def promote(
    payload: EvalPromote,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalCaseRead:
    """Make a real ask a passing or failing case — a person's act."""
    case = await evals.promote(
        session,
        graph_id=graph.id,
        run_id=payload.run_id,
        subject_kind=payload.subject_kind,
        subject_id=payload.subject_id,
        label=payload.label,
        actor_id=user.id,
        checks=[c.model_dump() for c in payload.checks] if payload.checks is not None else None,
    )
    return EvalCaseRead.model_validate(case)


async def drift(
    payload: EvalDrift,
    request: Request,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EvalDriftResponse:
    """The drift pass: a live eval run for every set with active cases."""
    runs = await drift_after(request, session, graph_id=graph.id, trigger=payload.trigger)
    return EvalDriftResponse(run_ids=[r.id for r in runs])


async def drift_after(request: Request, session: AsyncSession, *, graph_id: str, trigger: str) -> list:
    """Open the drift pass in the caller's transaction, commit it, and hand the runs to the runtime.

    A Graph model publishing and a world or guardrail changing call this as
    their last step, so the change and its drift runs commit together; a run
    the budget paused at open is not submitted.
    """
    runs = await evals.drift(session, graph_id=graph_id, trigger=trigger)
    await session.commit()
    for run in runs:
        if run.status == "queued":
            request.app.state.task_runtime.submit_eval(run.id)
    return runs


async def get_budget(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> EvalBudgetRead:
    """The Graph's monthly eval tokens and what eval runs have spent this month."""
    return EvalBudgetRead(**await evals.budget(session, graph_id=graph.id))


async def put_budget(
    payload: EvalBudgetWrite,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EvalBudgetRead:
    return EvalBudgetRead(
        **await evals.put_budget(session, graph_id=graph.id, monthly_tokens=payload.monthly_tokens, actor_id=user.id)
    )
