"""Business logic for graph-scoped endpoints — Graph CRUD + members + invitations.

Functions flush but do not commit — the route handler commits at end-of-request.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.auth.models import User
from invana.auth.schemas import (
    GraphMemberOut,
    GraphMemberRoleUpdate,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
)
from invana.auth.services import (
    invitation_token_hash,
    make_invitation_expiry,
    new_invitation_raw_token,
    studio_redeem_url,
)
from invana.events import actions
from invana.events.services import current_trace_id, diff_changed_fields, emit_event
from invana.graphs.models import (
    Graph,
    GraphConnection,
    GraphMember,
    GraphRole,
    Invitation,
)
from invana.graphs.schemas import (
    SETUP_REQUIRED,
    SETUP_SECTIONS,
    SETUP_SKIPPABLE,
    GraphCreate,
    GraphRead,
    GraphUpdate,
)

# ---------------------------------------------------------------------------
# Graph container CRUD (RFC-017)
# ---------------------------------------------------------------------------


async def create_graph(session: AsyncSession, *, owner: User, payload: GraphCreate) -> GraphRead:
    """Create a Graph and auto-assign the creator as admin."""
    slug = payload.slug.lower()
    existing = await session.execute(select(Graph).where(Graph.created_by_id == owner.id, Graph.slug == slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"You already have a graph with slug '{slug}'.",
        )

    graph = Graph(
        slug=slug,
        name=payload.name,
        intent=payload.intent,
        created_by_id=owner.id,
        setup_state={},
    )
    session.add(graph)
    await session.flush()

    session.add(GraphMember(graph_id=graph.id, user_id=owner.id, role=GraphRole.admin))
    await session.flush()

    await emit_event(
        session,
        action=actions.GRAPH_CREATE,
        target_kind=actions.TARGET_GRAPH,
        target_id=graph.id,
        graph_id=graph.id,
        actor_id=owner.id,
        details={"slug": graph.slug, "name": graph.name},
        trace_id=current_trace_id(),
    )
    # Implicit member.add of the owner — surfaces as a parallel event so the
    # graph's audit trail shows who became admin and when.
    await emit_event(
        session,
        action=actions.MEMBER_ADD,
        target_kind=actions.TARGET_MEMBER,
        target_id=owner.id,
        graph_id=graph.id,
        actor_id=owner.id,
        details={"role": GraphRole.admin.value, "via": "graph.create"},
        trace_id=current_trace_id(),
    )

    return await _serialize_graph(session, graph)


async def list_graphs_for_user(session: AsyncSession, *, user_id: str) -> list[GraphRead]:
    """Return all Graphs the user is a member of, most recently updated first."""
    stmt = (
        select(Graph)
        .join(GraphMember, GraphMember.graph_id == Graph.id)
        .where(GraphMember.user_id == user_id)
        .order_by(Graph.updated_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().unique().all()
    return [await _serialize_graph(session, g) for g in rows]


async def get_graph_detail(session: AsyncSession, *, graph: Graph) -> GraphRead:
    return await _serialize_graph(session, graph)


async def update_graph(
    session: AsyncSession,
    *,
    graph: Graph,
    payload: GraphUpdate,
    actor_id: str,
) -> GraphRead:
    data = payload.model_dump(exclude_unset=True)
    before = {f: getattr(graph, f) for f in data}
    for field, value in data.items():
        setattr(graph, field, value)
    intent_completed = False
    if "intent" in data and graph.intent and graph.intent.strip():
        already_complete = bool((graph.setup_state or {}).get("intent", {}).get("completed_at"))
        _mark_section(graph, "intent", "complete")
        intent_completed = not already_complete
    await session.flush()
    after = {f: getattr(graph, f) for f in data}
    changed = diff_changed_fields(before, after, fields=list(data))
    if changed:
        await emit_event(
            session,
            action=actions.GRAPH_UPDATE,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"changed": changed, "name": graph.name},
            trace_id=current_trace_id(),
        )
    if intent_completed:
        await emit_event(
            session,
            action=actions.SETUP_COMPLETE,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"section": "intent", "via": "graph.update"},
            trace_id=current_trace_id(),
        )
    return await _serialize_graph(session, graph)


async def delete_graph(
    session: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
) -> None:
    # Emit the event BEFORE deleting so the FK to graphs.id still resolves at
    # insert. The cascade (events.graph_id ON DELETE SET NULL) flips graph_id
    # to NULL on commit — fine, the per-graph view is unreachable for a
    # deleted graph anyway. `details.slug` + `details.name` carry the human
    # context the row lost when the FK went null.
    await emit_event(
        session,
        action=actions.GRAPH_DELETE,
        target_kind=actions.TARGET_GRAPH,
        target_id=graph.id,
        graph_id=graph.id,
        actor_id=actor_id,
        details={"slug": graph.slug, "name": graph.name},
        trace_id=current_trace_id(),
    )
    await session.delete(graph)
    await session.flush()


# ---------------------------------------------------------------------------
# GraphConnection sub-resource — /u/{username}/{graphSlug}/connection
# ---------------------------------------------------------------------------


async def get_graph_connection(session: AsyncSession, *, graph_id: str) -> GraphConnection | None:
    stmt = select(GraphConnection).where(GraphConnection.graph_id == graph_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def put_graph_connection(
    session: AsyncSession,
    *,
    graph: Graph,
    payload,  # GraphConnectionCreate
    encryption_key: str,
    actor_id: str,
) -> tuple[GraphConnection, bool]:
    """Create or replace the Graph's connection. Returns (connection, created)."""
    from invana.graphs.encryption import encrypt_credentials  # noqa: PLC0415
    from invana.graphs.store import GraphConnectionStore  # noqa: PLC0415

    existing = await get_graph_connection(session, graph_id=graph.id)
    store = GraphConnectionStore()
    if existing is None:
        connection = await store.create(session, data=payload, encryption_key=encryption_key)
        connection.graph_id = graph.id
        # Saving connection details completes the graph_info wizard section
        # (re-applies on every save so a prior reset is undone).
        _mark_section(graph, "graph_info", "complete")
        await session.flush()
        await emit_event(
            session,
            action=actions.CONNECTION_ATTACH,
            target_kind=actions.TARGET_CONNECTION,
            target_id=connection.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={
                "uri": connection.uri,
                "connector_class": connection.connector_class,
                "read_only": connection.read_only,
            },
            trace_id=current_trace_id(),
        )
        return connection, True

    # Replace: update all fields. connector_class is immutable once set.
    if payload.connector_class != existing.connector_class:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="connector_class cannot be changed once a connection is established.",
        )
    before = {
        "uri": existing.uri,
        "read_only": existing.read_only,
        "has_auth": existing.auth_encrypted is not None,
    }
    existing.uri = payload.uri
    existing.read_only = payload.read_only
    if payload.auth:
        existing.auth_encrypted = encrypt_credentials(payload.auth, encryption_key)
    # Manually-declared version (RFC-022) — fallback for backends we can't auto-detect.
    # A successful auto-detect on the reconnect below overrides it.
    declared = (payload.server_version or "").strip() or None
    if declared:
        from invana.graphs.compatibility import compatibility_status_for  # noqa: PLC0415

        existing.server_version = declared
        existing.server_version_source = "declared"
        existing.compatibility_status = compatibility_status_for(existing.connector_class, declared)
        existing.version_acknowledged = False
    existing.status = "CONNECTING"
    _mark_section(graph, "graph_info", "complete")
    await session.flush()
    after = {
        "uri": existing.uri,
        "read_only": existing.read_only,
        "has_auth": existing.auth_encrypted is not None,
    }
    changed = diff_changed_fields(
        before,
        after,
        fields=["uri", "read_only", "has_auth"],
    )
    if changed:
        await emit_event(
            session,
            action=actions.CONNECTION_UPDATE,
            target_kind=actions.TARGET_CONNECTION,
            target_id=existing.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"changed": changed, "uri": existing.uri},
            trace_id=current_trace_id(),
        )
    return existing, False


async def test_connection_credentials(
    *,
    uri: str,
    connector_class: str,
    auth: dict,
    timeout_s: float = 10.0,
) -> dict:
    """Build a transient connector and try to connect. Returns {ok, latency_ms?, error?}.

    The connector is never registered with the manager — it's discarded after
    the test. Used by the studio's "Test Connection" button to validate
    credentials before saving them.
    """
    import asyncio  # noqa: PLC0415
    import contextlib  # noqa: PLC0415
    import time  # noqa: PLC0415

    from invana.utils import import_class_from_dotted_path  # noqa: PLC0415

    try:
        ConnectorClass = import_class_from_dotted_path(connector_class)
    except Exception as exc:
        return {"ok": False, "error": f"Unknown connector '{connector_class}': {exc}"}

    try:
        connector = ConnectorClass(uri=uri, **auth)
    except Exception as exc:
        return {"ok": False, "error": f"Could not build connector: {exc}"}

    t0 = time.monotonic()
    try:
        await asyncio.wait_for(connector.connect(), timeout=timeout_s)
        latency_ms = int((time.monotonic() - t0) * 1000)
        # connect() already auto-detected the server version (RFC-022). Capture it
        # here so the version is sourced from the database itself, not user input.
        resolved = connector.resolve_capabilities()
    except TimeoutError:
        return {"ok": False, "error": f"Connect timed out after {timeout_s:.0f}s."}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        with contextlib.suppress(Exception):
            await connector.disconnect()

    return {
        "ok": True,
        "latency_ms": latency_ms,
        "server_version": str(resolved.version) if resolved.version else None,
        "compatibility_status": resolved.status.value,
    }


async def delete_graph_connection(
    session: AsyncSession,
    *,
    graph: Graph,
    actor_id: str,
) -> GraphConnection | None:
    """Hard-delete the Graph's connection. Returns the removed row for manager cleanup."""
    connection = await get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        return None
    snapshot = {
        "uri": connection.uri,
        "connector_class": connection.connector_class,
    }
    conn_id = connection.id
    await session.delete(connection)
    # Removing the connection un-completes the graph_info wizard section.
    _mark_section(graph, "graph_info", "reset")
    await emit_event(
        session,
        action=actions.CONNECTION_DELETE,
        target_kind=actions.TARGET_CONNECTION,
        target_id=conn_id,
        graph_id=graph.id,
        actor_id=actor_id,
        details=snapshot,
        trace_id=current_trace_id(),
    )
    return connection


# ---------------------------------------------------------------------------
# Setup wizard
# ---------------------------------------------------------------------------


def _mark_section(graph: Graph, section: str, action: str) -> None:
    """Mutate graph.setup_state to record a section action.

    ``action`` is ``complete`` | ``skip`` | ``reset``. Required sections
    (``graph_info``, ``intent``) cannot be skipped — caller must validate first.
    """
    state = dict(graph.setup_state or {})
    now = datetime.now(UTC).isoformat()
    if action == "complete":
        state[section] = {"completed_at": now}
    elif action == "skip":
        state[section] = {"skipped_at": now}
    elif action == "reset":
        state.pop(section, None)
    graph.setup_state = state


async def update_setup_section(
    session: AsyncSession,
    *,
    graph: Graph,
    section: str,
    action: str,
    actor_id: str,
) -> GraphRead:
    if section not in SETUP_SECTIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown wizard section '{section}'. Expected one of: {', '.join(SETUP_SECTIONS)}.",
        )
    if action == "skip" and section not in SETUP_SKIPPABLE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Section '{section}' is required and cannot be skipped.",
        )
    _mark_section(graph, section, action)
    await session.flush()
    event_action = {
        "complete": actions.SETUP_COMPLETE,
        "skip": actions.SETUP_SKIP,
        "reset": actions.SETUP_RESET,
    }.get(action)
    if event_action is not None:
        await emit_event(
            session,
            action=event_action,
            target_kind=actions.TARGET_GRAPH,
            target_id=graph.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"section": section},
            trace_id=current_trace_id(),
        )
    return await _serialize_graph(session, graph)


def is_setup_complete(graph: Graph) -> tuple[bool, list[str]]:
    """Return (all_required_done, missing_sections)."""
    state = graph.setup_state or {}
    missing = [s for s in SETUP_REQUIRED if not state.get(s, {}).get("completed_at")]
    return (not missing, missing)


async def _serialize_graph(session: AsyncSession, graph: Graph) -> GraphRead:
    """Hydrate a Graph row into the GraphRead payload (owner_username, member_count, has_connection)."""
    owner = await session.get(User, graph.created_by_id)
    member_count = (
        await session.execute(
            select(func.count()).where(GraphMember.graph_id == graph.id),
        )
    ).scalar_one()
    has_connection = (
        await session.execute(
            select(func.count()).where(GraphConnection.graph_id == graph.id),
        )
    ).scalar_one() > 0

    return GraphRead(
        id=graph.id,
        slug=graph.slug,
        name=graph.name,
        description=graph.description,
        intent=graph.intent,
        objectives=graph.objectives,
        success_criteria=graph.success_criteria,
        setup_state=graph.setup_state or {},
        status=graph.status,
        owner_id=graph.created_by_id,
        owner_username=owner.username if owner else "",
        member_count=member_count,
        has_connection=has_connection,
        created_at=graph.created_at,
        updated_at=graph.updated_at,
    )


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def list_graph_members(session: AsyncSession, *, graph_id: str) -> list[GraphMemberOut]:
    stmt = (
        select(GraphMember)
        .where(GraphMember.graph_id == graph_id)
        .options(selectinload(GraphMember.user))
        .order_by(GraphMember.created_at.asc())
    )
    return [
        GraphMemberOut(
            user_id=m.user_id,
            username=m.user.username,
            email=m.user.email,
            first_name=m.user.first_name,
            last_name=m.user.last_name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in (await session.execute(stmt)).scalars().all()
    ]


async def update_graph_member_role(
    session: AsyncSession,
    *,
    graph_id: str,
    target_user_id: str,
    payload: GraphMemberRoleUpdate,
    actor_id: str,
) -> GraphMemberOut:
    member = await _get_membership(session, graph_id=graph_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if (
        member.role is GraphRole.admin
        and payload.role is not GraphRole.admin
        and await _is_sole_graph_admin(session, graph_id=graph_id, user_id=target_user_id)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot demote the only admin of this Graph.",
        )
    before_role = member.role.value
    member.role = payload.role
    await session.flush()
    await session.refresh(member, ["user"])
    await emit_event(
        session,
        action=actions.MEMBER_ROLE_CHANGE,
        target_kind=actions.TARGET_MEMBER,
        target_id=target_user_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={
            "username": member.user.username,
            "changed": {"role": {"before": before_role, "after": payload.role.value}},
        },
        trace_id=current_trace_id(),
    )
    return GraphMemberOut(
        user_id=member.user_id,
        username=member.user.username,
        email=member.user.email,
        first_name=member.user.first_name,
        last_name=member.user.last_name,
        role=member.role,
        created_at=member.created_at,
    )


async def remove_graph_member(
    session: AsyncSession,
    *,
    graph_id: str,
    target_user_id: str,
    actor_id: str,
) -> None:
    member = await _get_membership(session, graph_id=graph_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if member.role is GraphRole.admin and await _is_sole_graph_admin(
        session, graph_id=graph_id, user_id=target_user_id
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot remove the only admin of this Graph.",
        )
    # Pull the username snapshot before delete so it survives the FK SET NULL
    # on the audit event row.
    await session.refresh(member, ["user"])
    username = member.user.username
    role_at_remove = member.role.value
    await emit_event(
        session,
        action=actions.MEMBER_REMOVE,
        target_kind=actions.TARGET_MEMBER,
        target_id=target_user_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={"username": username, "role": role_at_remove},
        trace_id=current_trace_id(),
    )
    await session.delete(member)


async def _is_sole_graph_admin(session: AsyncSession, *, graph_id: str, user_id: str) -> bool:
    stmt = select(func.count()).where(
        GraphMember.graph_id == graph_id,
        GraphMember.role == GraphRole.admin,
        GraphMember.user_id != user_id,
    )
    return (await session.execute(stmt)).scalar_one() == 0


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


async def create_invitation(
    session: AsyncSession,
    *,
    invited_by: User,
    graph_id: str,
    payload: InvitationCreateRequest,
) -> InvitationCreateResponse:
    raw_token = new_invitation_raw_token()
    invitation = Invitation(
        token_hash=invitation_token_hash(raw_token),
        email=payload.email.lower(),
        graph_id=graph_id,
        role=payload.role,
        invited_by_id=invited_by.id,
        expires_at=make_invitation_expiry(),
    )
    session.add(invitation)
    await session.flush()

    await emit_event(
        session,
        action=actions.INVITATION_CREATE,
        target_kind=actions.TARGET_INVITATION,
        target_id=invitation.id,
        graph_id=graph_id,
        actor_id=invited_by.id,
        details={"email": invitation.email, "role": invitation.role.value},
        trace_id=current_trace_id(),
    )

    return InvitationCreateResponse(
        id=invitation.id,
        email=invitation.email,
        graph_id=invitation.graph_id,
        role=invitation.role,
        invited_by_id=invitation.invited_by_id,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        redeem_url=studio_redeem_url(raw_token),
    )


async def list_graph_invitations(session: AsyncSession, *, graph_id: str) -> list[InvitationOut]:
    stmt = select(Invitation).where(Invitation.graph_id == graph_id).order_by(Invitation.created_at.desc())
    return [InvitationOut.model_validate(r) for r in (await session.execute(stmt)).scalars().all()]


async def delete_invitation(
    session: AsyncSession,
    *,
    graph_id: str,
    invitation_id: str,
    actor_id: str,
) -> None:
    invitation = await session.get(Invitation, invitation_id)
    if invitation is None or invitation.graph_id != graph_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    snapshot = {"email": invitation.email, "role": invitation.role.value}
    await emit_event(
        session,
        action=actions.INVITATION_DELETE,
        target_kind=actions.TARGET_INVITATION,
        target_id=invitation_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details=snapshot,
        trace_id=current_trace_id(),
    )
    await session.delete(invitation)


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------


async def _get_membership(session: AsyncSession, *, graph_id: str, user_id: str) -> GraphMember | None:
    stmt = select(GraphMember).where(
        GraphMember.graph_id == graph_id,
        GraphMember.user_id == user_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()
