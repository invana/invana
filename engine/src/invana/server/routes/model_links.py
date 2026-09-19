"""Stitching routes — declared links, the resolve preview, and the derived global model.

Two domain models meet only where somebody said they meet
(docs/for-developers/modules/connect-and-model/features/stitch-models.md). Nothing here
infers anything (ST1), and the global model this returns is computed on the way out —
there is no row behind it (ST3).

Routes
------
GET    /model-links                list the Graph's declared links (?status= narrows)
POST   /model-links                declare one — it lands **staged** (ST21)
POST   /model-links/commit         flip every staged stitch to active, in one action
POST   /model-links/discard        delete the staged set, or one of it
DELETE /model-links/{link_id}      remove one — immediate, staged or active
POST   /model-links/preview        how many resolve, *before* declaring
GET    /global-model               the union of published models plus their links
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.pool import GraphConnectionManager, GraphUnavailableError
from invana.apps.graphs.query_service import QueryExecutionError, execute_query
from invana.apps.modeller import links as link_service
from invana.apps.modeller.links import GlobalModel, LinkRefused, StitchPreview
from invana.apps.modeller.solve import withdraw_link
from invana.apps.modeller.store import ModelStore
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events import actions as event_actions
from invana.core.events.services import emit_event
from invana.runtime.catalogue.stitching import commit_stitches
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.server.schemas import ActionResponse, action

model_links_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["model-links"])

_store = ModelStore()


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


# ---------------------------------------------------------------------------
# Shapes
# ---------------------------------------------------------------------------


class LinkDeclare(BaseModel):
    kind: Literal["anchor", "relationship"]
    source_version_id: str
    source_type: str
    target_version_id: str
    target_type: str
    # A key on each side, and how the two compare (ST26). Never a score (C3).
    source_property: str | None = None
    target_property: str | None = None
    identity_match: Literal["exact", "case_insensitive"] = "exact"
    # relationship only — the edge type, and, when the endpoints are not already
    # on the records, the model whose records supply them. Keys or a source
    # model (ST27).
    edge_type: str | None = None
    source_model_id: str | None = None
    description: str = ""


class LinkResponse(BaseModel):
    id: str
    kind: str
    # "staged" until somebody commits it; the union takes active rows only (ST21).
    status: str = "active"
    source_version_id: str
    source_type: str
    source_model: str | None = None
    source_version: str | None = None
    target_version_id: str
    target_type: str
    target_model: str | None = None
    target_version: str | None = None
    source_property: str | None = None
    target_property: str | None = None
    identity_match: str = "exact"
    edge_type: str | None = None
    source_model_id: str | None = None
    description: str = ""
    # What solving this stitch wrote, when the commit that ran it is what is being
    # answered (ST44). Absent on a list: the number belongs to a run, not to the row.
    edges_written: int | None = None


class DiscardRequest(BaseModel):
    """Which staged stitches to drop. Omit ``link_id`` to drop the whole set."""

    link_id: str | None = None


class PreviewRequest(BaseModel):
    """One join rule, counted before anything is declared.

    The same shape for both kinds: an anchor asks *are these the same entity*
    and a relationship asks *where does the edge attach*, and both are answered
    by the one question — which value on this side equals which on that one.
    """

    source_type: str
    source_property: str
    target_type: str
    target_property: str
    identity_match: Literal["exact", "case_insensitive"] = "exact"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _decorate(session: AsyncSession, link) -> LinkResponse:
    """Name the models a link joins — ids alone read as nothing."""
    resp = LinkResponse.model_validate(link, from_attributes=True)
    for side in ("source", "target"):
        version = await _store.get_version(session, getattr(link, f"{side}_version_id"))
        if version is None:
            continue
        model = await _store.get_graph_model(session, version.model_id)
        setattr(resp, f"{side}_model", model.name if model else None)
        setattr(resp, f"{side}_version", version.version)
    return resp


async def _writable_connector(session: AsyncSession, graph: Graph, manager: GraphConnectionManager):
    """The Graph's live connector, refused up front when it cannot be written to.

    Resolved **before** anything is flipped: a commit that marked rows active and
    then found no database would leave a union the graph does not reflect (ST44).
    """
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise HTTPException(
            HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"error": "no_connection", "graph_id": graph.id},
        )
    if connection.read_only:
        raise HTTPException(
            HTTPStatus.FORBIDDEN,
            detail={
                "error": "read_only_graph",
                "message": "This connection is marked read-only, and solving a stitch writes edges.",
            },
        )
    try:
        return manager.get_connector(connection.id)
    except GraphUnavailableError:
        raise HTTPException(
            HTTPStatus.SERVICE_UNAVAILABLE,
            detail={"error": "graph_not_active", "connection_id": connection.id},
        ) from None


def _refused(exc: LinkRefused) -> HTTPException:
    status_code = HTTPStatus.CONFLICT if exc.error == "link_already_declared" else HTTPStatus.UNPROCESSABLE_ENTITY
    return HTTPException(status_code, detail={"error": exc.error, **exc.detail})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@model_links_router.get("/model-links", response_model=list[LinkResponse])
async def list_model_links(
    status_filter: Literal["staged", "active"] | None = Query(None, alias="status"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[LinkResponse]:
    """Every stitch touching this Graph. Staged ones are listed beside the active
    ones rather than hidden — a staged set nobody can see is a staged set nobody
    reviews (ST21)."""
    links = await link_service.list_links(session, graph.id, status=status_filter)
    return [await _decorate(session, link) for link in links]


@model_links_router.post(
    "/model-links",
    response_model=ActionResponse[LinkResponse],
    status_code=status.HTTP_201_CREATED,
)
async def declare_model_link(
    payload: LinkDeclare,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[LinkResponse]:
    try:
        link = await link_service.declare(
            session,
            _store,
            graph_id=graph.id,
            kind=payload.kind,
            source_version_id=payload.source_version_id,
            source_type=payload.source_type,
            target_version_id=payload.target_version_id,
            target_type=payload.target_type,
            source_property=payload.source_property,
            target_property=payload.target_property,
            identity_match=payload.identity_match,
            edge_type=payload.edge_type,
            source_model_id=payload.source_model_id,
            description=payload.description,
        )
    except LinkRefused as exc:
        raise _refused(exc) from exc

    await emit_event(
        session,
        action=event_actions.MODEL_LINK_DECLARE,
        target_kind=event_actions.TARGET_MODEL_LINK,
        target_id=link.id,
        graph_id=graph.id,
        actor_id=user.id,
        details={
            "kind": link.kind,
            "status": link.status,
            "source_type": link.source_type,
            "target_type": link.target_type,
            "source_property": link.source_property,
            "target_property": link.target_property,
            "edge_type": link.edge_type,
        },
    )
    await session.commit()
    rule = f"{payload.source_type}.{payload.source_property} = {payload.target_type}.{payload.target_property}"
    if payload.kind == "anchor":
        pair = f"{payload.source_type} ≡ {payload.target_type} on {rule} — linked, not merged."
    elif payload.source_model_id:
        pair = f"{payload.source_type} -[{payload.edge_type}]-> {payload.target_type}, rows from its own records."
    else:
        pair = f"{payload.source_type} -[{payload.edge_type}]-> {payload.target_type} on {rule}."
    # Say what did *not* happen: the stitch exists, and no answer changed.
    message = f"{pair} Staged — the global model is unchanged until you commit."
    return action(message, await _decorate(session, link))


@model_links_router.post("/model-links/commit", response_model=ActionResponse[list[LinkResponse]])
async def commit_staged_links(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    manager: GraphConnectionManager = Depends(_get_manager),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[list[LinkResponse]]:
    """Flip every staged stitch to active — one action for the whole set (ST21).

    Nothing is validated again here. A stitch was refused or accepted when it was
    declared, and the resolve preview ran before that; a commit is the moment a
    person says *yes, these belong in the union*, not a second gate.
    """
    staged = await link_service.list_links(session, graph.id, status="staged")
    if not staged:
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail={"error": "nothing_staged", "message": "There are no staged stitches to commit."},
        )
    connector = await _writable_connector(session, graph, manager)
    # Committing is what runs the stitch (ST44): a union the graph does not reflect
    # is a claim nothing can traverse.
    run = await commit_stitches(session, graph_id=graph.id, connector=connector)
    committed = run.links
    solved = {result.link_id: result for result in (*run.solved, *run.loaded)}
    for link in committed:
        await emit_event(
            session,
            action=event_actions.MODEL_LINK_COMMIT,
            target_kind=event_actions.TARGET_MODEL_LINK,
            target_id=link.id,
            graph_id=graph.id,
            actor_id=user.id,
            details={
                "kind": link.kind,
                "source_type": link.source_type,
                "target_type": link.target_type,
                "edges_written": solved[link.id].written if link.id in solved else 0,
            },
        )
    await session.commit()
    noun = "stitch" if len(committed) == 1 else "stitches"
    written = run.written
    responses = []
    for link in committed:
        resp = await _decorate(session, link)
        resp.edges_written = solved[link.id].written if link.id in solved else None
        responses.append(resp)
    edges = "edge" if written == 1 else "edges"
    rejected = f" {run.rejected:,} row(s) had an endpoint that resolved nowhere." if run.rejected else ""
    return action(
        f"{len(committed)} {noun} committed. The global model now spans them, "
        f"and {written:,} {edges} were written.{rejected}",
        responses,
    )


@model_links_router.post("/model-links/discard", response_model=ActionResponse[None])
async def discard_staged_links(
    payload: DiscardRequest | None = None,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    """Drop the staged set, or one stitch out of it.

    A staged stitch was never in the union, so there is nothing to put back —
    discarding deletes the row rather than reverting it.
    """
    link_id = payload.link_id if payload else None
    dropped = await link_service.discard_staged(session, graph.id, link_id)
    if not dropped:
        raise HTTPException(
            HTTPStatus.NOT_FOUND,
            detail={"error": "nothing_staged", "link_id": link_id},
        )
    for link in dropped:
        await emit_event(
            session,
            action=event_actions.MODEL_LINK_DISCARD,
            target_kind=event_actions.TARGET_MODEL_LINK,
            target_id=link.id,
            graph_id=graph.id,
            actor_id=user.id,
            details={"kind": link.kind, "source_type": link.source_type, "target_type": link.target_type},
        )
    await session.commit()
    noun = "stitch" if len(dropped) == 1 else "stitches"
    return action(f"{len(dropped)} staged {noun} discarded. Nothing in the global model changed.", None)


@model_links_router.delete("/model-links/{link_id}", response_model=ActionResponse[None])
async def remove_model_link(
    link_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    manager: GraphConnectionManager = Depends(_get_manager),
    session: AsyncSession = Depends(get_session),
) -> ActionResponse[None]:
    link = await link_service.get_link(session, graph.id, link_id)
    if link is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "link_not_found", "link_id": link_id})

    # Withdrawing the rule withdraws the edges derived from it (ST48). A staged
    # stitch never wrote any, and a database nobody can reach is not a reason to
    # keep a rule somebody asked to remove — the edges name the stitch either way.
    withdrawn = 0
    if link.status == "active":
        try:
            connector = await _writable_connector(session, graph, manager)
            await connector.connect()
            try:
                withdrawn = await withdraw_link(connector, link)
            finally:
                await connector.disconnect()
        except HTTPException:
            withdrawn = -1

    removed = await link_service.remove(session, graph.id, link_id)
    if not removed:  # pragma: no cover — it was read a line ago
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "link_not_found", "link_id": link_id})
    await emit_event(
        session,
        action=event_actions.MODEL_LINK_REMOVE,
        target_kind=event_actions.TARGET_MODEL_LINK,
        target_id=link_id,
        graph_id=graph.id,
        actor_id=user.id,
        details={"edges_withdrawn": withdrawn},
    )
    await session.commit()
    if withdrawn > 0:
        tail = f" {withdrawn:,} edge(s) it wrote went with it."
    elif withdrawn < 0:
        tail = " Its edges are still in the database — the connection was unreachable; they carry `_inv_stitch_id`."
    else:
        tail = ""
    return action(f"Stitch removed. The global model no longer spans that pair.{tail}", None)


@model_links_router.post("/model-links/preview", response_model=StitchPreview)
async def preview_stitch(
    payload: PreviewRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    manager: GraphConnectionManager = Depends(_get_manager),
    session: AsyncSession = Depends(get_session),
) -> StitchPreview:
    """How many the rule resolves — counted before anything is declared.

    A count of zero comes back as a verdict, not an error: the rule is wrong, not
    the data ("nothing resolves" in the journey).
    """
    query = link_service.stitch_preview_query(
        source_type=payload.source_type,
        source_property=payload.source_property,
        target_type=payload.target_type,
        target_property=payload.target_property,
        case_insensitive=payload.identity_match == "case_insensitive",
    )
    try:
        result = await execute_query(
            session,
            graph=graph,
            manager=manager,
            query=query,
            parameters=None,
            actor_id=user.id,
        )
    except QueryExecutionError as exc:
        raise HTTPException(
            HTTPStatus.BAD_GATEWAY,
            detail={"error": "preview_failed", "message": str(exc), "category": exc.category},
        ) from exc
    await session.commit()
    rows = result.rows or []
    return link_service.read_preview(
        rows[0] if rows else {},
        source_type=payload.source_type,
        source_property=payload.source_property,
        target_type=payload.target_type,
        target_property=payload.target_property,
    )


@model_links_router.get("/global-model", response_model=GlobalModel)
async def get_global_model(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> GlobalModel:
    """The union, computed on the way out. Nothing here is stored (ST3)."""
    return await link_service.derive_global_model(session, _store, graph_id=graph.id)
