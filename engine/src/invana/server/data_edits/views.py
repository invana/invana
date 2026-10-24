"""The view behind ``POST /data-edits`` — parse, check, open the run, work it, answer.

The board's Save waits on this, so the run is worked here (``run_inline``), as a
stitch commit is: the answer is the ids the database gave the added elements,
or the refusal that stopped the batch. The model check runs before the run is
opened, so a batch that cannot fit never becomes a run.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.modeller.managers.data_edit import DataEditManager
from invana.apps.modeller.schemas import DataEditBatch, DataEditResult
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime import services as run_services
from invana.runtime.models import RunStatus
from invana.runtime.querysets import TaskRunQuerySet
from invana.server.graphs.deps import require_graph_connected, require_graph_member


async def save_data_edits(
    payload: DataEditBatch,
    request: Request,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DataEditResult:
    """Check the board's edits against the model, write them as one run, and return the new ids.

    422 names the first edit the model refuses; 409 is no published model or a
    read-only connection; 502 is the database refusing an edit, with how many
    were written before it.
    """
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    model_id = connection.model_id if connection else None
    manager = DataEditManager()
    checked = manager.check_batch(payload, await manager.model_index(session, model_id))
    run = await run_services.open_data_edit_run(
        session,
        graph=graph,
        model_id=model_id or "",
        edits=[e.model_dump(mode="json") for e in checked],
        actor_id=user.id,
    )
    run_id = run.id
    await session.commit()
    await request.app.state.task_runtime.run_inline(run_id)

    await session.refresh(run)
    if run.status != RunStatus.succeeded.value:
        error = run.error or {}
        raise HTTPException(
            HTTPStatus.BAD_GATEWAY if error.get("cause") == "write_failed" else HTTPStatus.CONFLICT,
            detail={
                "error": error.get("cause") or "save_failed",
                "run_id": run_id,
                "message": error.get("message") or f"The save {run.status}. Open the run for the trace.",
            },
        )
    nodes = await TaskRunQuerySet().nodes_of(session, run_id=run_id)
    out = next((n.output or {} for n in nodes if n.task_key == "graph.write.edits"), {})
    return DataEditResult(run_id=run_id, ids=dict(out.get("ids") or {}), applied=int(out.get("applied") or 0))
