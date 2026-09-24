"""Canvas acts, as runs — every read the canvas makes is a builtin plan (GC6 · SP11 · GC14).

The explorer's endpoints are launchers. Each opens one builtin plan under the
canvas's lens (GC11), awaits it inline because a person is waiting (RP31), and
answers with the shape the canvas already draws, plus the run's id (GC12).
There is no other path from the canvas to the graph
([orchestration § 4.1a](docs/for-developers/orchestration.md)).

| Act | Plan | Trigger |
|---|---|---|
| Expand a node | `expand-neighbours@1` | `canvas` |
| Count the types a world holds | `count-types@1` | `canvas` |
| Check a reopened canvas | `resolve-elements@1` | `system` |

Lives in the runtime because opening a run is the runtime's, and the run has to
be committed before the interpreter reads it in its own session — the same
shape a stitch commit has.
"""

from __future__ import annotations

import dataclasses
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import PlanStep
from invana.apps.explorer.managers import ExploreManager
from invana.apps.explorer.managers.explore import expand_prompt
from invana.apps.explorer.schemas import (
    NeighborExpandResponse,
    ResolveElementsResponse,
    TypeCount,
    TypeCountsResponse,
)
from invana.apps.graphs.models import Graph
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import Session
from invana.core.errors import ConflictError
from invana.graph.types.data_elements import Edge, GraphResponse, ResultMetadata, Vertex
from invana.runtime.models import RunStatus, TaskRun, TriggeredBy
from invana.runtime.planning import plan_payload, queue_plan_steps, select_plan_by_key
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.services import _prune, freeze_lens

if TYPE_CHECKING:
    from invana.apps.explorer.schemas import _ExpandBase
    from invana.runtime.interpreter.loop import TaskRuntime

#: The builtins a canvas act runs (GC9 · LB32).
EXPAND_PLAN_KEY = "expand-neighbours"
COUNT_TYPES_PLAN_KEY = "count-types"
RESOLVE_PLAN_KEY = "resolve-elements"
#: What an expansion's step is handed — the request, less what only the launcher reads.
_STEP_ARGS = ("vertex_id", "direction", "edge_label", "neighbor_label", "filters", "sort", "limit", "offset")

_explore = ExploreManager()
_sessions = SessionManager()


async def _open(
    db: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
    key: str,
    args: dict,
    body: str,
    trigger: TriggeredBy,
    lens_id: str | None,
    sess: Session | None = None,
    user_msg=None,
    assistant=None,
) -> TaskRun:
    """Open one canvas builtin as a run under the canvas's lens (GC11).

    The lens is the session's agent (when there is a session), the picked
    world and the Graph's guardrails. The agent narrows it but is not the
    performer: ``agent_id`` stays null, so a canvas act spends no agent budget
    and never waits on the agent's own ceiling.
    """
    selected = await select_plan_by_key(db, graph_id=graph.id, key=key)
    if selected is None:
        raise RuntimeError(f"The plan library has no populated {key!r}.")
    steps = [
        dataclasses.replace(step, args={**step.args, **args})
        for step in (PlanStep.parse(dict(s), index=i) for i, s in enumerate(selected.steps))
    ]
    run = TaskRun(
        graph_id=graph.id,
        session_id=sess.id if sess else None,
        message_id=user_msg.id if user_msg else None,
        assistant_message_id=assistant.id if assistant else None,
        author_id=actor_id,
        author_kind="user",
        ask_kind="canvas",
        body=body,
        params=args,
        workflow_key=selected.ref,
        task_plan_id=selected.plan_id,
        plan_origin=f"template:{selected.ref}",
        triggered_by=trigger.value,
        on_behalf_of_user_id=actor_id,
        status=RunStatus.queued.value,
        **await freeze_lens(db, graph_id=graph.id, agent_id=sess.agent_id if sess else None, lens_id=lens_id),
    )
    db.add(run)
    await db.flush()
    run.plan_revision = 1
    run.plan_snapshot = plan_payload(steps, source=run.plan_origin or "", version=1)
    await queue_plan_steps(db, run=run, message_id=assistant.id if assistant else None, steps=steps, start_seq=0)
    if assistant is not None:
        assistant.run_id = run.id
    await _prune(db, graph.id)
    return run


async def _settle(db: AsyncSession, runtime: TaskRuntime, run: TaskRun, *, task_key: str, what: str) -> dict:
    """Run it inline and return its step's output — or a 409 saying why there is none.

    A run the Graph's ceiling queues, a refusal and a failure each carry the
    run's id: the canvas draws nothing it did not read, and says why.
    """
    run_id = run.id
    await db.commit()
    await runtime.run_inline(run_id)
    await db.refresh(run)
    if run.status == RunStatus.queued.value:
        raise ConflictError(
            {
                "error": f"{what}_queued",
                "run_id": run_id,
                "message": "This Graph is at its run ceiling; this is queued and draws nothing yet.",
            }
        )
    nodes = await TaskRunQuerySet().nodes_of(db, run_id=run_id)
    out = next((n.output or {} for n in nodes if n.task_key == task_key), {})
    if run.outcome == "cannot_answer" or "cannot_answer" in out:
        raise ConflictError(
            {"error": "outside_lens", "run_id": run_id, "message": out.get("cannot_answer") or "Outside this world."}
        )
    if run.status != RunStatus.succeeded.value:
        raise ConflictError(
            {
                "error": f"{what}_failed",
                "run_id": run_id,
                "message": (run.error or {}).get("message") or f"The run {run.status}. Open it for the trace.",
            }
        )
    return {**out, "run_id": run_id}


async def open_expand_run(
    db: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
    req: _ExpandBase,
    sess: Session | None,
) -> TaskRun:
    """Open the run one expansion is, and its turn when it has a session (GC12)."""
    args = req.model_dump(mode="json", include=set(_STEP_ARGS), exclude_none=True)
    prompt = expand_prompt(req)
    user_msg = assistant = None
    if sess is not None:
        user_msg, assistant = await _sessions.open_operation(db, sess=sess, kind="expand", user_content=prompt)
    return await _open(
        db,
        graph=graph,
        actor_id=actor_id,
        key=EXPAND_PLAN_KEY,
        args=args,
        body=prompt,
        trigger=TriggeredBy.canvas,
        lens_id=req.lens_id,
        sess=sess,
        user_msg=user_msg,
        assistant=assistant,
    )


async def expand(
    db: AsyncSession,
    *,
    runtime: TaskRuntime,
    graph: Graph,
    actor_id: str,
    req: _ExpandBase,
) -> NeighborExpandResponse:
    """Expand one node as a run, and answer with what it read (GC6 · GC12 · GC13)."""
    sess = await _explore.owned_session(db, graph=graph, actor_id=actor_id, session_id=req.session_id)
    run = await open_expand_run(db, graph=graph, actor_id=actor_id, req=req, sess=sess)
    out = await _settle(db, runtime, run, task_key="expand_neighbours", what="expand")
    data = GraphResponse(
        nodes=[Vertex.model_validate(n) for n in out.get("nodes") or []],
        edges=[Edge.model_validate(e) for e in out.get("edges") or []],
        metadata=ResultMetadata.model_validate(out.get("metadata") or {}),
    )
    return NeighborExpandResponse(
        data=data,
        total=int(out.get("total") or 0),
        offset=req.offset,
        limit=req.limit,
        returned=len(data.edges),
        has_more=bool(out.get("has_more")),
        run_id=out["run_id"],
    )


async def count_types(
    db: AsyncSession,
    *,
    runtime: TaskRuntime,
    graph: Graph,
    actor_id: str,
    lens_id: str | None,
) -> TypeCountsResponse:
    """The types the picked world holds, counted inside it, as a run (SP11)."""
    run = await _open(
        db,
        graph=graph,
        actor_id=actor_id,
        key=COUNT_TYPES_PLAN_KEY,
        args={},
        body="Count types",
        trigger=TriggeredBy.canvas,
        lens_id=lens_id,
    )
    out = await _settle(db, runtime, run, task_key="count_types", what="count")
    return TypeCountsResponse(
        nodes=[TypeCount.model_validate(t) for t in out.get("node_types") or []],
        edges=[TypeCount.model_validate(t) for t in out.get("edge_types") or []],
        counted=bool(out.get("counted", True)),
        run_id=out["run_id"],
    )


async def resolve(
    db: AsyncSession,
    *,
    runtime: TaskRuntime,
    graph: Graph,
    actor_id: str,
    vertex_ids: list[str],
    lens_id: str | None,
) -> ResolveElementsResponse:
    """What of a reopened canvas is still in view, as a run (GC14).

    ``present`` is in the graph and the world, ``missing`` is gone from the
    graph. Anything else is outside the world and the canvas does not draw it
    — it is never told why. An empty canvas asks nothing, so opens no run.
    """
    if not vertex_ids:
        return ResolveElementsResponse()
    run = await _open(
        db,
        graph=graph,
        actor_id=actor_id,
        key=RESOLVE_PLAN_KEY,
        args={"vertex_ids": vertex_ids},
        body=f"Resolve {len(vertex_ids)} canvas element(s)",
        trigger=TriggeredBy.system,
        lens_id=lens_id,
    )
    out = await _settle(db, runtime, run, task_key="resolve_elements", what="resolve")
    return ResolveElementsResponse(
        present=list(out.get("present") or []),
        missing=list(out.get("missing") or []),
        checked=len(vertex_ids),
        run_id=out["run_id"],
    )
