"""Service-layer tests for Query Sessions (RFC-024 / RFC-030) against a real Postgres.

Covers the persistence behaviors that don't need a live graph DB connector:
private-to-creator scoping, ordering, rename, cascade delete, monotonic
sequencing, and natural-language provider resolution (RFC-030). Both `ql` and
`nl` now execute, so message creation through ``send_message`` is exercised via
the API harness (httpx + a live graph DB + a real LLM); message-persistence
properties here append rows through the store directly.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from invana.sessions import services
from invana.sessions.models import (
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
)
from invana.sessions.schemas import RecordOperation, SendMessage, SessionMessageRead
from invana.sessions.store import SessionStore

pytestmark = pytest.mark.asyncio


async def _message_count(session, session_id: str) -> int:
    stmt = select(func.count()).select_from(SessionMessage).where(SessionMessage.session_id == session_id)
    return int((await session.execute(stmt)).scalar_one())


async def _append_turn(session, sess, content: str, *, mode: str | None = None) -> None:
    """Append a user+assistant message pair via the store (no execution)."""
    store = SessionStore()
    seq = await store.next_seq(session, session_id=sess.id)
    await store.add(
        session,
        SessionMessage(session_id=sess.id, seq=seq, role=SessionMessageRole.user, content=content),
    )
    await store.add(
        session,
        SessionMessage(
            session_id=sess.id,
            seq=seq + 1,
            role=SessionMessageRole.assistant,
            content="ok",
            status=SessionMessageStatus.ok,
            mode=mode,
        ),
    )
    sess.message_count += 2
    await session.flush()


class TestSessionPersistence:
    async def test_list_is_private_to_creator_and_ordered(self, session, graph, user, other_user):
        await services.create_session(session, graph_id=graph.id, user_id=user.id, title="A")
        await services.create_session(session, graph_id=graph.id, user_id=user.id, title="B")
        # A session owned by someone else must not leak into the user's list.
        await services.create_session(session, graph_id=graph.id, user_id=other_user.id, title="theirs")
        await session.commit()

        items, total = await services.list_sessions(session, graph_id=graph.id, user_id=user.id, limit=30, offset=0)
        assert total == 2
        titles = {s.title for s in items}
        assert titles == {"A", "B"}

    async def test_get_or_404_enforces_owner_and_graph(self, session, graph, user, other_user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="mine")
        await session.commit()

        # Wrong user → 404 (private to creator).
        with pytest.raises(HTTPException) as exc:
            await services.get_or_404(session, session_id=sess.id, graph_id=graph.id, user_id=other_user.id)
        assert exc.value.status_code == 404

        # Nonexistent id → 404.
        with pytest.raises(HTTPException):
            await services.get_or_404(session, session_id="missing", graph_id=graph.id, user_id=user.id)

    async def test_rename(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="old")
        await services.rename_session(session, sess=sess, title="renamed")
        await session.commit()
        assert sess.title == "renamed"

    async def test_update_toggles_pin_and_archive(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="t")
        assert sess.pinned is False and sess.archived is False

        await services.update_session(session, sess=sess, pinned=True, archived=True)
        await session.commit()
        assert sess.pinned is True and sess.archived is True

        # A partial update leaves untouched fields alone.
        await services.update_session(session, sess=sess, archived=False)
        await session.commit()
        assert sess.pinned is True and sess.archived is False

    async def test_list_pins_first_and_hides_archived_by_default(self, session, graph, user):
        plain = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="plain")
        pinned = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="pinned")
        gone = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="archived")
        await services.update_session(session, sess=pinned, pinned=True)
        await services.update_session(session, sess=gone, archived=True)
        await session.commit()

        # Archived hidden by default; pinned floats to the top.
        items, total = await services.list_sessions(session, graph_id=graph.id, user_id=user.id, limit=30, offset=0)
        assert total == 2
        assert items[0].id == pinned.id
        assert {s.id for s in items} == {pinned.id, plain.id}

        # Opting in surfaces the archived session.
        items, total = await services.list_sessions(
            session, graph_id=graph.id, user_id=user.id, limit=30, offset=0, include_archived=True
        )
        assert total == 3
        assert gone.id in {s.id for s in items}

    async def test_mode_persists_and_round_trips_to_read_dto(self, session, graph, user):
        """The originating mode ("nl"/"ql") is stored on the assistant message and
        surfaces in the read DTO, so the composer restores it on reopen."""
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=None)
        await _append_turn(session, sess, "show me people", mode="nl")
        await session.commit()

        messages = await services.list_messages(session, sess=sess)
        reads = [SessionMessageRead.model_validate(m) for m in messages]
        assistant = next(r for r in reads if r.role == SessionMessageRole.assistant)
        assert assistant.mode == "nl"

    async def test_delete_cascades_messages(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=None)
        await _append_turn(session, sess, "hello")
        await session.commit()
        assert await _message_count(session, sess.id) == 2

        await services.delete_session(session, sess=sess, actor_id=user.id)
        await session.commit()
        assert await _message_count(session, sess.id) == 0

    async def test_nl_without_provider_is_rejected(self, session, graph, user):
        """An nl send with no LLM provider configured fails fast (RFC-030) — the
        422 raises before any message is written, so nothing persists."""
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=None)
        with pytest.raises(HTTPException) as exc:
            await services.send_message(
                session,
                sess=sess,
                graph=graph,
                manager=None,  # provider resolution runs first, before the connector
                payload=SendMessage(content="who are the people?", mode="nl"),
                actor_id=user.id,
                encryption_key="unused",
            )
        assert exc.value.status_code == 422
        assert "Settings" in exc.value.detail
        assert await _message_count(session, sess.id) == 0

    async def test_seq_is_monotonic_across_appends(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="t")
        await _append_turn(session, sess, "one")
        await _append_turn(session, sess, "two")
        await session.commit()

        seqs = sorted(m.seq for m in await services.list_messages(session, sess=sess))
        assert seqs == [1, 2, 3, 4]
        assert sess.message_count == 4


class TestFriendlyQueryError:
    """NL-mode failures show backend-owned guidance keyed off the connector's
    category; QL keeps the raw driver error (asserted in the connector tests)."""

    async def test_known_categories_map_to_distinct_copy(self):
        from invana.graph.connectors.base.exceptions import QueryErrorCategory

        syntax = services._friendly_query_error(QueryErrorCategory.SYNTAX)
        timeout = services._friendly_query_error(QueryErrorCategory.TIMEOUT)
        assert "rephrasing" in syntax
        assert "too long" in timeout
        assert syntax != timeout

    async def test_unknown_category_falls_back_to_default(self):
        assert services._friendly_query_error("unknown") == services._FRIENDLY_QUERY_ERROR_DEFAULT


class TestOperationLogging:
    """Canvas operations logged as session turns (RFC-046) — no graph DB needed:
    these exercise persistence + the context-replay exclusion directly."""

    async def test_record_expand_appends_pair_and_grows_totals(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="s")
        user_msg, assistant_msg = await services.record_operation(
            session,
            sess=sess,
            kind="expand",
            user_content='Expand neighbours of "n1"',
            summary="Added 3 nodes and 2 relationships.",
            source_query="MATCH (n)-[r]-(m) RETURN n, r, m",
            query_language="cypher",
            row_count=3,
            execution_time_ms=8,
            node_count=3,
            edge_count=2,
            add_to_totals=True,
        )
        # Both rows carry the operation marker; the assistant reply reuses the
        # normal result fields so the thread renders it like a query turn.
        assert user_msg.operation == "expand"
        assert assistant_msg.operation == "expand"
        assert assistant_msg.status == SessionMessageStatus.ok
        assert assistant_msg.source_query == "MATCH (n)-[r]-(m) RETURN n, r, m"
        assert assistant_msg.via == "Cypher"
        # An expand genuinely grows the canvas → the session totals grow with it.
        assert (sess.node_count, sess.edge_count) == (3, 2)
        assert sess.message_count == 2
        assert sess.last_status == SessionMessageStatus.ok
        assert await _message_count(session, sess.id) == 2

    async def test_record_load_does_not_double_count_totals(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="s")
        _, assistant_msg = await services.record_load(
            session,
            sess=sess,
            payload=RecordOperation(
                kind="load",
                source_query="MATCH (a:Airport) RETURN a",
                query_language="cypher",
                row_count=5,
                node_count=5,
                edge_count=4,
                execution_time_ms=12,
            ),
        )
        assert assistant_msg.operation == "load"
        assert "onto the canvas" in assistant_msg.content
        # Re-projecting an already-run query must not re-count its rows.
        assert (sess.node_count, sess.edge_count) == (0, 0)
        assert sess.message_count == 2

    async def test_context_turns_excludes_operations(self):
        # A real query turn followed by an expand op turn: only the query is
        # replayed as NL context — the expand's traversal must never leak in.
        rows = [
            SessionMessage(session_id="s", seq=1, role=SessionMessageRole.user, content="show airports"),
            SessionMessage(
                session_id="s",
                seq=2,
                role=SessionMessageRole.assistant,
                content="ok",
                status=SessionMessageStatus.ok,
                source_query="MATCH (a:Airport) RETURN a",
            ),
            SessionMessage(
                session_id="s",
                seq=3,
                role=SessionMessageRole.user,
                content='Expand neighbours of "n1"',
                operation="expand",
            ),
            SessionMessage(
                session_id="s",
                seq=4,
                role=SessionMessageRole.assistant,
                content="Added 3 nodes and 2 relationships.",
                status=SessionMessageStatus.ok,
                operation="expand",
                source_query="MATCH (n)-[r]-(m) RETURN n, r, m",
            ),
        ]
        turns = services._context_turns(rows)
        assert len(turns) == 1
        assert turns[0]["query"] == "MATCH (a:Airport) RETURN a"
