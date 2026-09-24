"""HTTP views for the Explorer.

Parse, call one launcher, serialise (migration-plan §4.1). Every read the canvas
makes is a run (GC6 · SP11 · GC14): each view launches its builtin through
`invana.runtime.canvas` and answers with what that run read. The task runtime is
an app-state dependency, handed down rather than reached for.
"""

from __future__ import annotations

from fastapi import Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.explorer.schemas import (
    ExpandByEdgeTypeRequest,
    ExpandByNodeTypeRequest,
    ExpandNeighborsRequest,
    NeighborExpandResponse,
    ResolveElementsRequest,
    ResolveElementsResponse,
    TypeCountsResponse,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime import canvas
from invana.runtime.interpreter.loop import TaskRuntime
from invana.server.graphs.deps import require_graph_connected, require_graph_member


def _get_runtime(request: Request) -> TaskRuntime:
    return request.app.state.task_runtime


async def expand_neighbors(
    payload: ExpandNeighborsRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(_get_runtime),
) -> NeighborExpandResponse:
    return await canvas.expand(session, runtime=runtime, graph=graph, actor_id=user.id, req=payload)


async def expand_by_edge_type(
    payload: ExpandByEdgeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(_get_runtime),
) -> NeighborExpandResponse:
    return await canvas.expand(session, runtime=runtime, graph=graph, actor_id=user.id, req=payload)


async def expand_by_node_type(
    payload: ExpandByNodeTypeRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(_get_runtime),
) -> NeighborExpandResponse:
    return await canvas.expand(session, runtime=runtime, graph=graph, actor_id=user.id, req=payload)


async def resolve_elements(
    payload: ResolveElementsRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(_get_runtime),
) -> ResolveElementsResponse:
    """What of a reopened canvas is still in view — a `resolve-elements@1` run (GC5 · GC14).

    ``present`` is in the graph and the picked world, ``missing`` is gone from
    the graph. What the world excludes is in neither, and is not drawn.
    """
    return await canvas.resolve(
        session,
        runtime=runtime,
        graph=graph,
        actor_id=user.id,
        vertex_ids=payload.vertex_ids,
        lens_id=payload.lens_id,
    )


async def type_counts(
    lens_id: str | None = Query(default=None, description="The world the canvas has picked (SP11)."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_connected),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(_get_runtime),
) -> TypeCountsResponse:
    """The types the picked world holds, counted inside it — a `count-types@1` run (SP11).

    A type the world denies is absent, and every count is taken inside its
    slice — the Explorer panel's legend and the expand menus read this.
    """
    return await canvas.count_types(session, runtime=runtime, graph=graph, actor_id=user.id, lens_id=lens_id)
