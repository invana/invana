"""Approvals and the ledger, as lists the assistant can open.

``board.open`` (docs/for-developers/modules/ask/features/the-assistant-opens-boards.md)
counts a list with the list's own query. The runtime registers the lists it
owns — Runs and Agents — and this band registers its own two, so the runtime
never imports Activity. Importing ``invana.activity.managers`` registers them;
every front-end does that already.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.approvals import ApprovalManager
from invana.activity.managers.ledger import LedgerManager
from invana.activity.schemas import APPROVAL_LIST
from invana.apps.graphs.models import Graph
from invana.apps.graphs.querysets.member import GraphMemberQuerySet
from invana.core.auth.querysets import UserQuerySet
from invana.core.ledger.schemas import LEDGER_LIST
from invana.core.lists import ListParams
from invana.runtime.managers.board_open import Board, register_board


async def _count_approvals(db: AsyncSession, graph: Graph, actor_id: str, params: ListParams) -> int:
    reader = await UserQuerySet().get(db, actor_id)
    if reader is None:
        return 0
    return (await ApprovalManager().page(db, graph=graph, params=params, reader=reader, applied=[])).total


async def _count_ledger(db: AsyncSession, graph: Graph, actor_id: str, params: ListParams) -> int:
    member = await GraphMemberQuerySet().get(db, graph_id=graph.id, user_id=actor_id)
    if member is None:
        return 0
    return (await LedgerManager().page(db, graph=graph, member=member, params=params, applied=[])).total


register_board(Board("approvals", "Approvals", "/agents/approvals", ("ask", "asks"), APPROVAL_LIST, _count_approvals))
register_board(Board("ledger", "Ledger", "/agents/ledger", ("row", "rows"), LEDGER_LIST, _count_ledger))
