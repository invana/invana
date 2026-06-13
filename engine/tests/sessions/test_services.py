"""Service-layer tests for Query Sessions (RFC-024) against a real Postgres.

Covers the persistence behaviors that don't need a live graph DB connector:
private-to-creator scoping, ordering, rename, cascade delete, and the
natural-language path (recorded, not executed). The `ql` execution path and the
HTTP routes are exercised via the API harness (httpx + a live graph DB), not
here.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from invana.sessions import services
from invana.sessions.models import SessionMessage, SessionMessageStatus
from invana.sessions.schemas import SendMessage

pytestmark = pytest.mark.asyncio


async def _message_count(session, session_id: str) -> int:
    stmt = select(func.count()).select_from(SessionMessage).where(SessionMessage.session_id == session_id)
    return int((await session.execute(stmt)).scalar_one())


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

    async def test_delete_cascades_messages(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=None)
        await services.send_message(
            session,
            sess=sess,
            graph=graph,
            manager=None,  # nl path doesn't touch the connector
            payload=SendMessage(content="hello", mode="nl"),
            actor_id=user.id,
        )
        await session.commit()
        assert await _message_count(session, sess.id) == 2

        await services.delete_session(session, sess=sess, actor_id=user.id)
        await session.commit()
        assert await _message_count(session, sess.id) == 0

    async def test_nl_message_is_recorded_not_executed(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=None)
        user_msg, assistant_msg, result = await services.send_message(
            session,
            sess=sess,
            graph=graph,
            manager=None,
            payload=SendMessage(content="who are the people?", mode="nl"),
            actor_id=user.id,
        )
        await session.commit()

        assert result is None  # not executed
        assert user_msg.seq == 1
        assert assistant_msg.seq == 2
        assert assistant_msg.status == SessionMessageStatus.ok
        assert "wired" in assistant_msg.content.lower()
        assert sess.message_count == 2
        # The latest reply's status is denormalized onto the session for the list.
        assert sess.last_status == SessionMessageStatus.ok
        # Title is derived from the first prompt when none was given.
        assert sess.title.startswith("who are the people")

    async def test_seq_is_monotonic_across_sends(self, session, graph, user):
        sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title="t")
        await services.send_message(
            session,
            sess=sess,
            graph=graph,
            manager=None,
            payload=SendMessage(content="one", mode="nl"),
            actor_id=user.id,
        )
        await services.send_message(
            session,
            sess=sess,
            graph=graph,
            manager=None,
            payload=SendMessage(content="two", mode="nl"),
            actor_id=user.id,
        )
        await session.commit()

        seqs = sorted(m.seq for m in await services.list_messages(session, sess=sess))
        assert seqs == [1, 2, 3, 4]
        assert sess.message_count == 4
