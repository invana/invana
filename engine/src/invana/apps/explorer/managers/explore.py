"""Explorer rules — what an expansion is called, and whose session it lands in.

Every read the canvas makes is a run — an expansion, the type counts, a
reopened canvas's check — opened by `invana.runtime.canvas` under the canvas's
lens (GC6 · SP11 · GC14). No connector is reached from here
(migration-plan §2).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.sessions.models import Session
from invana.apps.sessions.querysets import SessionQuerySet


def expand_prompt(req: Any) -> str:
    """The user row of an expand turn (docs/for-developers/modules/explore/features/boards.md)."""
    qualifier = ""
    if getattr(req, "edge_label", None):
        qualifier = f'"{req.edge_label}" '
    elif getattr(req, "neighbor_label", None):
        qualifier = f'"{req.neighbor_label}" '
    direction = {"in": " (incoming)", "out": " (outgoing)"}.get(req.direction, "")
    return f'Expand {qualifier}neighbours of "{req.vertex_id}"{direction}'


class ExploreManager:
    sessions_qs = SessionQuerySet()

    async def owned_session(
        self, session: AsyncSession, *, graph: Graph, actor_id: str, session_id: str | None
    ) -> Session | None:
        """The session an expansion lands in, when the caller owns it in this Graph.

        Best-effort: an unknown or foreign id is no session rather than an error,
        so a bad id never breaks the expansion itself — it just runs unrecorded
        in a thread.
        """
        if not session_id:
            return None
        sess = await self.sessions_qs.get(session, session_id)
        if sess is None or sess.graph_id != graph.id or sess.created_by_id != actor_id:
            return None
        return sess
