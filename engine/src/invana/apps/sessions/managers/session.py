"""Session rules — the thread a person asks in, and the messages in it.

**A session is private to its creator.** Every read is scoped by
``created_by_id`` as well as by Graph, and a session in another Graph or another
person's name reads as absent rather than forbidden.

No ``fastapi``, no ``select()``, no ``commit()`` (migration-plan §4.1).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.apps.modeller.store import ModelStore
from invana.apps.sessions.models import (
    Session,
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
    SessionSurface,
)
from invana.apps.sessions.querysets import SessionMessageQuerySet, SessionQuerySet
from invana.apps.sessions.schemas import RecordOperation
from invana.apps.sessions.transcript import (
    _HISTORY_TURNS,
    _LANGUAGE_LABEL,
    _context_turns,
    _plural,
    _title_from_text,
)
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class SessionManager:
    sessions_qs = SessionQuerySet()
    messages_qs = SessionMessageQuerySet()

    async def list_sessions(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        limit: int,
        offset: int,
        sort: str = "updated",
        include_archived: bool = False,
        surface: str | None = None,
    ) -> tuple[list[Session], int]:
        items = await self.sessions_qs.list_for_user(
            session,
            graph_id=graph_id,
            user_id=user_id,
            limit=limit,
            offset=offset,
            sort=sort,
            include_archived=include_archived,
            surface=surface,
        )
        total = await self.sessions_qs.count_for_user(
            session, graph_id=graph_id, user_id=user_id, include_archived=include_archived, surface=surface
        )
        return items, total

    async def get_or_404(
        self,
        session: AsyncSession,
        *,
        session_id: str,
        graph_id: str,
        user_id: str,
    ) -> Session:
        """Fetch a session, enforcing graph scope + private-to-creator visibility."""
        sess = await self.sessions_qs.get(session, session_id)
        if sess is None or sess.graph_id != graph_id or sess.created_by_id != user_id:
            raise NotFoundError("Session not found.")
        return sess

    async def list_messages(self, session: AsyncSession, *, sess: Session) -> list[SessionMessage]:
        return await self.messages_qs.list_messages(session, session_id=sess.id)

    async def get_message_or_404(
        self,
        session: AsyncSession,
        *,
        message_id: str,
        sess: Session,
    ) -> SessionMessage:
        msg = await self.messages_qs.get_message(session, message_id)
        if msg is None or msg.session_id != sess.id:
            raise NotFoundError("Message not found.")
        return msg

    async def set_feedback(
        self, session: AsyncSession, *, message: SessionMessage, value: str | None
    ) -> SessionMessage:
        """Record a 👍/👎 vote on an assistant reply (docs/for-developers/modules/ask/features/clarifying-questions.md ·
        docs/for-developers/modules/workflows/features/promote-a-plan.md) — the capture
        signal the learning loop will later distil. ``None`` clears the vote."""
        message.feedback = value
        await session.flush()
        return message

    async def get_message_context(self, session: AsyncSession, *, message: SessionMessage) -> list[dict]:
        """Recompute the conversation context (docs/for-developers/modules/ask/spec.md) sent for an assistant turn.

        Reuses the exact functions ``send_message`` uses, so the result is identical
        to what was replayed to the model — see docs/for-developers/modules/ask/features/reasoning-trace.md. Empty for a
        user message, a
        non-``nl`` reply (ql turns send no context), or a first turn. ``before_seq``
        is ``message.seq - 1`` (the triggering user turn's seq), matching the window
        ``send_message`` built.
        """
        if message.role != SessionMessageRole.assistant or message.mode != "nl":
            return []
        rows = await self.messages_qs.list_recent_messages(
            session, session_id=message.session_id, before_seq=message.seq - 1, limit=_HISTORY_TURNS * 2
        )
        return _context_turns(rows)

    async def create_session(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        user_id: str,
        title: str | None,
        surface: str = "explorer",
        model_id: str | None = None,
        agent_id: str | None = None,
    ) -> Session:
        # A modeller session may bind to a model up front (docs/for-developers/modules/ask/spec.md). Re-scope
        # to the route's graph so a cross-graph model id 404s rather than leaks. An
        # introspected ("global") model is read-only — never an authoring target; drop
        # the binding and let the first generation create a fresh studio model.
        graph_id = graph.id
        if model_id is not None:
            model = await ModelStore().get_graph_model(session, model_id)
            if model is None or model.graph_id != graph_id:
                raise NotFoundError("Model not found for this graph.")
            if model.origin == "introspected":
                model_id = None

        # Every session names an agent (docs/for-developers/modules/agents/spec.md). The picker's default comes
        # from the surface, so a user who picks nothing still gets one — and the
        # header can always say which mind is answering.
        from invana.apps.agents.managers import AgentManager

        if agent_id:
            agent = await AgentManager().require_available(session, agent_id=agent_id, graph_id=graph_id)
        else:
            await AgentManager().seed_agents(session, graph=graph)
            agent = await AgentManager().default_agent_for_surface(session, graph=graph, surface=surface)

        sess = Session(
            graph_id=graph_id,
            created_by_id=user_id,
            title=title or "",
            surface=SessionSurface(surface),
            model_id=model_id,
            agent_id=agent.id if agent else None,
        )
        await self.sessions_qs.add(session, sess)
        await emit_event(
            session,
            action=actions.SESSION_CREATE,
            target_kind=actions.TARGET_SESSION,
            target_id=sess.id,
            graph_id=graph_id,
            actor_id=user_id,
            details={},
            trace_id=current_trace_id(),
        )
        return sess

    async def rename_session(self, session: AsyncSession, *, sess: Session, title: str) -> Session:
        sess.title = title
        await session.flush()
        return sess

    async def update_session(
        self,
        session: AsyncSession,
        *,
        sess: Session,
        title: str | None = None,
        pinned: bool | None = None,
        archived: bool | None = None,
        agent_id: str | None = None,
        actor_id: str | None = None,
    ) -> Session:
        """Apply a partial update (only the provided fields) to a session.

        Changing the agent takes effect on the **next** run_ask — earlier runs
        keep the agent they ran under, because ``runs.agent_id`` is the record
        and the session is only configuration (docs/for-developers/modules/agents/spec.md).
        """
        if title is not None:
            sess.title = title
        if pinned is not None:
            sess.pinned = pinned
        if archived is not None:
            sess.archived = archived
        if agent_id is not None and agent_id != sess.agent_id:
            from invana.apps.agents.managers import AgentManager

            agent = await AgentManager().require_available(session, agent_id=agent_id, graph_id=sess.graph_id)
            before = sess.agent_id
            sess.agent_id = agent.id
            await emit_event(
                session,
                action=actions.SESSION_UPDATE,
                target_kind=actions.TARGET_SESSION,
                target_id=sess.id,
                graph_id=sess.graph_id,
                actor_id=actor_id,
                details={"changed": {"agent_id": {"before": before, "after": agent.id}}, "agent_name": agent.name},
            )
        await session.flush()
        return sess

    async def delete_session(self, session: AsyncSession, *, sess: Session, actor_id: str) -> None:
        session_id = sess.id
        graph_id = sess.graph_id
        await self.sessions_qs.delete(session, sess)
        await emit_event(
            session,
            action=actions.SESSION_DELETE,
            target_kind=actions.TARGET_SESSION,
            target_id=session_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={},
            trace_id=current_trace_id(),
        )

    async def _grounding_version(self, session: AsyncSession, graph_id: str) -> GraphVersion | None:
        """The active model version to ground against — the introspected/global model
        first (it mirrors the live DB), else any model's active version."""
        store = ModelStore()
        introspected = await store.get_introspected_model(session, graph_id)
        if introspected is not None:
            version = await store.get_active_version(session, introspected.id)
            if version is not None:
                return version
        for model in await store.list_graph_models(session, graph_id):
            version = await store.get_active_version(session, model.id)
            if version is not None:
                return version
        return None

    async def record_operation(
        self,
        session: AsyncSession,
        *,
        sess: Session,
        kind: str,
        user_content: str,
        summary: str,
        source_query: str | None = None,
        query_language: str | None = None,
        row_count: int | None = None,
        execution_time_ms: int | None = None,
        node_count: int = 0,
        edge_count: int = 0,
        add_to_totals: bool = False,
    ) -> tuple[SessionMessage, SessionMessage]:
        """Append a canvas-operation turn — a user/assistant pair
        (docs/for-developers/modules/explore/features/boards.md)
        whose
        ``operation`` marks it as an expand/load rather than a composer query.

        Reuses the assistant reply's existing result fields so the thread renders it
        like any query turn (summary + "View query" + meta). ``add_to_totals`` grows
        the session's node/edge running totals — true for an ``expand`` (the canvas
        genuinely grew), false for a ``load`` (those rows were counted when the query
        first ran; re-projecting must not double-count).
        """
        user_seq = await self.messages_qs.next_seq(session, session_id=sess.id)
        user_msg = SessionMessage(
            session_id=sess.id,
            seq=user_seq,
            role=SessionMessageRole.user,
            content=user_content,
            operation=kind,
        )
        assistant_msg = SessionMessage(
            session_id=sess.id,
            seq=user_seq + 1,
            role=SessionMessageRole.assistant,
            content=summary,
            status=SessionMessageStatus.ok,
            operation=kind,
            mode="ql",
            via=_LANGUAGE_LABEL.get(query_language, query_language) if query_language else None,
            query_language=query_language,
            source_query=source_query,
            row_count=row_count,
            execution_time_ms=execution_time_ms,
            node_count=node_count,
            edge_count=edge_count,
        )
        await self.sessions_qs.add(session, user_msg)
        await self.sessions_qs.add(session, assistant_msg)
        sess.message_count += 2
        sess.last_status = assistant_msg.status
        if add_to_totals:
            sess.node_count += node_count
            sess.edge_count += edge_count
        await session.flush()
        return user_msg, assistant_msg

    async def open_operation(
        self,
        session: AsyncSession,
        *,
        sess: Session,
        kind: str,
        user_content: str,
    ) -> tuple[SessionMessage, SessionMessage]:
        """Open a canvas-operation turn **before** its run, still running (GC12).

        The run's steps are queued under the reply, which is what lists it in
        the session's Tasks tab; the interpreter settles the reply from the
        run's own result when it ends — the turn *is* the run, so nothing here
        writes an answer.
        """
        user_seq = await self.messages_qs.next_seq(session, session_id=sess.id)
        user_msg = SessionMessage(
            session_id=sess.id,
            seq=user_seq,
            role=SessionMessageRole.user,
            content=user_content,
            operation=kind,
        )
        assistant_msg = SessionMessage(
            session_id=sess.id,
            seq=user_seq + 1,
            role=SessionMessageRole.assistant,
            content="",
            status=SessionMessageStatus.running,
            operation=kind,
            mode="ql",
        )
        await self.sessions_qs.add(session, user_msg)
        await self.sessions_qs.add(session, assistant_msg)
        sess.message_count += 2
        sess.last_status = assistant_msg.status
        await session.flush()
        return user_msg, assistant_msg

    async def record_load(
        self, session: AsyncSession, *, sess: Session, payload: RecordOperation
    ) -> tuple[SessionMessage, SessionMessage]:
        """Log a "Load to canvas" click as a session turn (docs/for-developers/modules/explore/features/boards.md).

        ``add_to_totals`` is false: the loaded query's rows were already counted when
        it first ran, so re-projecting them must not double the session's totals.
        """
        summary = (
            f"Loaded {_plural(payload.node_count, 'node')} and "
            f"{_plural(payload.edge_count, 'relationship')} onto the canvas."
        )
        return await self.record_operation(
            session,
            sess=sess,
            kind="load",
            user_content="Load to canvas",
            summary=summary,
            source_query=payload.source_query,
            query_language=payload.query_language.value if payload.query_language else None,
            row_count=payload.row_count,
            execution_time_ms=payload.execution_time_ms,
            node_count=payload.node_count,
            edge_count=payload.edge_count,
            add_to_totals=False,
        )

    async def _ensure_model_and_draft(
        self, session: AsyncSession, *, sess: Session, graph: Graph, prompt: str
    ) -> tuple[GraphModel, GraphVersion]:
        """Resolve the model + editable draft a modeller session authors (docs/for-developers/modules/ask/spec.md).

        Bound session → load its model + draft (creating a draft if it has none).
        Unbound (or bound to a deleted/read-only model) → create a fresh studio model
        + initial draft and bind the session to it. Returns the eager-loaded draft so
        the proposal can ground + reconcile against it.
        """
        store = ModelStore()
        model: GraphModel | None = None
        if sess.model_id:
            model = await store.get_graph_model(session, sess.model_id)
            # Defensive: a dangling/cross-graph/read-only binding falls through to a
            # fresh studio model rather than authoring somewhere it shouldn't.
            if model is not None and (model.graph_id != graph.id or model.origin == "introspected"):
                model = None

        if model is None:
            model = await store.create_graph_model(
                session, name=_title_from_text(prompt), graph_id=graph.id, origin="studio"
            )
            sess.model_id = model.id
            draft = await store.create_version(session, model_id=model.id)
        else:
            draft = next((v for v in model.versions if v.status == "draft"), None)
            if draft is None:
                draft = await store.create_version(session, model_id=model.id)

        # Reload eager so node/edge types + property keys are available for grounding
        # + the by-name reconcile diff (create_version returns an unloaded version).
        eager = await store.get_version(session, draft.id)
        assert eager is not None  # just created/loaded in this transaction
        return model, eager
