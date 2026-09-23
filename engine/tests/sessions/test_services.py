"""Service-layer tests for Query Sessions (docs/for-developers/modules/ask/spec.md ·
docs/for-developers/modules/ask/features/ask-in-natural-language.md) against a real Postgres.

Covers the persistence behaviors that don't need a live graph DB connector:
private-to-creator scoping, ordering, rename, cascade delete, monotonic
sequencing, and natural-language provider resolution
(docs/for-developers/modules/ask/features/ask-in-natural-language.md). Both `ql` and
`nl` execute through the run runtime (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) and
are exercised via the
API harness (httpx + a live graph DB + a real LLM); message-persistence
properties here append rows through the store directly.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from invana.apps.sessions import transcript
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import (
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
)
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.apps.sessions.schemas import RecordOperation, SendMessage, SessionMessageRead
from invana.core.errors import NotFoundError, ValidationError
from invana.runtime import services as run_services

sessions = SessionManager()

pytestmark = pytest.mark.asyncio


async def _message_count(session, session_id: str) -> int:
    stmt = select(func.count()).select_from(SessionMessage).where(SessionMessage.session_id == session_id)
    return int((await session.execute(stmt)).scalar_one())


async def _append_turn(session, sess, content: str, *, mode: str | None = None) -> None:
    """Append a user+assistant message pair via the store (no execution)."""
    store = SessionMessageQuerySet()
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
        await sessions.create_session(session, graph=graph, user_id=user.id, title="A")
        await sessions.create_session(session, graph=graph, user_id=user.id, title="B")
        # A session owned by someone else must not leak into the user's list.
        await sessions.create_session(session, graph=graph, user_id=other_user.id, title="theirs")
        await session.commit()

        items, total = await sessions.list_sessions(session, graph_id=graph.id, user_id=user.id, limit=30, offset=0)
        assert total == 2
        titles = {s.title for s in items}
        assert titles == {"A", "B"}

    async def test_get_or_404_enforces_owner_and_graph(self, session, graph, user, other_user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="mine")
        await session.commit()

        # Wrong user → 404 (private to creator).
        with pytest.raises(NotFoundError):
            await sessions.get_or_404(session, session_id=sess.id, graph_id=graph.id, user_id=other_user.id)

        # Nonexistent id → 404.
        with pytest.raises(NotFoundError):
            await sessions.get_or_404(session, session_id="missing", graph_id=graph.id, user_id=user.id)

    async def test_rename(self, session, graph, user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="old")
        await sessions.rename_session(session, sess=sess, title="renamed")
        await session.commit()
        assert sess.title == "renamed"

    async def test_update_toggles_pin_and_archive(self, session, graph, user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="t")
        assert sess.pinned is False and sess.archived is False

        await sessions.update_session(session, sess=sess, pinned=True, archived=True)
        await session.commit()
        assert sess.pinned is True and sess.archived is True

        # A partial update leaves untouched fields alone.
        await sessions.update_session(session, sess=sess, archived=False)
        await session.commit()
        assert sess.pinned is True and sess.archived is False

    async def test_list_pins_first_and_hides_archived_by_default(self, session, graph, user):
        plain = await sessions.create_session(session, graph=graph, user_id=user.id, title="plain")
        pinned = await sessions.create_session(session, graph=graph, user_id=user.id, title="pinned")
        gone = await sessions.create_session(session, graph=graph, user_id=user.id, title="archived")
        await sessions.update_session(session, sess=pinned, pinned=True)
        await sessions.update_session(session, sess=gone, archived=True)
        await session.commit()

        # Archived hidden by default; pinned floats to the top.
        items, total = await sessions.list_sessions(session, graph_id=graph.id, user_id=user.id, limit=30, offset=0)
        assert total == 2
        assert items[0].id == pinned.id
        assert {s.id for s in items} == {pinned.id, plain.id}

        # Opting in surfaces the archived session.
        items, total = await sessions.list_sessions(
            session, graph_id=graph.id, user_id=user.id, limit=30, offset=0, include_archived=True
        )
        assert total == 3
        assert gone.id in {s.id for s in items}

    async def test_mode_persists_and_round_trips_to_read_dto(self, session, graph, user):
        """The originating mode ("nl"/"ql") is stored on the assistant message and
        surfaces in the read DTO, so the composer restores it on reopen."""
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title=None)
        await _append_turn(session, sess, "show me people", mode="nl")
        await session.commit()

        messages = await sessions.list_messages(session, sess=sess)
        reads = [SessionMessageRead.model_validate(m) for m in messages]
        assistant = next(r for r in reads if r.role == SessionMessageRole.assistant)
        assert assistant.mode == "nl"

    async def test_delete_cascades_messages(self, session, graph, user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title=None)
        await _append_turn(session, sess, "hello")
        await session.commit()
        assert await _message_count(session, sess.id) == 2

        await sessions.delete_session(session, sess=sess, actor_id=user.id)
        await session.commit()
        assert await _message_count(session, sess.id) == 0

    async def test_nl_without_provider_is_rejected(self, session, graph, user):
        """An nl send with no LLM provider configured fails fast
        (docs/for-developers/modules/ask/features/ask-in-natural-language.md) — the
        422 raises before any message is written, so nothing persists."""
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title=None)
        with pytest.raises(ValidationError) as exc:
            await run_services.open_turn(
                session,
                sess=sess,
                graph=graph,
                payload=SendMessage(content="who are the people?", mode="nl"),
                actor_id=user.id,
            )
        # The copy names where the list lives now — the Agents panel's LLMs drawer, not
        # Settings (PM6). A refusal that routes somebody to a moved screen is
        # a refusal with no recourse.
        assert "Agents" in exc.value.detail
        assert await _message_count(session, sess.id) == 0

    async def test_seq_is_monotonic_across_appends(self, session, graph, user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="t")
        await _append_turn(session, sess, "one")
        await _append_turn(session, sess, "two")
        await session.commit()

        seqs = sorted(m.seq for m in await sessions.list_messages(session, sess=sess))
        assert seqs == [1, 2, 3, 4]
        assert sess.message_count == 4


class TestFriendlyQueryError:
    """NL-mode failures show backend-owned guidance keyed off the connector's
    category; QL keeps the raw driver error (asserted in the connector tests)."""

    async def test_known_categories_map_to_distinct_copy(self):
        from invana.graph.connectors.base.exceptions import QueryErrorCategory

        syntax = transcript._friendly_query_error(QueryErrorCategory.SYNTAX)
        timeout = transcript._friendly_query_error(QueryErrorCategory.TIMEOUT)
        assert "rephrasing" in syntax
        assert "too long" in timeout
        assert syntax != timeout

    async def test_unknown_category_falls_back_to_default(self):
        assert transcript._friendly_query_error("unknown") == transcript._FRIENDLY_QUERY_ERROR_DEFAULT


class TestOperationLogging:
    """Canvas operations logged as session turns (docs/for-developers/modules/explore/features/canvases.md) — no graph
    DB needed:
    these exercise persistence + the context-replay exclusion directly."""

    async def test_record_expand_appends_pair_and_grows_totals(self, session, graph, user):
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="s")
        user_msg, assistant_msg = await sessions.record_operation(
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
        sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="s")
        _, assistant_msg = await sessions.record_load(
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
        turns = transcript._context_turns(rows)
        assert len(turns) == 1
        assert turns[0]["query"] == "MATCH (a:Airport) RETURN a"
