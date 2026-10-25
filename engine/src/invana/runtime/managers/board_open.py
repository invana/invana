"""Opening a list for an ask (docs/for-developers/modules/ask/features/the-assistant-opens-boards.md).

An ``open_list`` intent names a list and its filters **in the person's words**
— *Route Auditor*, *failed*, *this month*. :class:`BoardOpenManager` turns
those words into the list contract's own filters, under the asker's rights,
counts the rows with the list's own query, and writes the ``link`` emission
Studio opens.

Three rules live here:

- **The link is the list contract.** Every filter becomes the same
  ``f.<field>`` param a person sets, checked against the list's
  :class:`~invana.core.lists.ListSpec`, so a list the assistant opened reads,
  reloads and clears like any other.
- **Names resolve in the engine.** An agent's name becomes its id inside the
  Graph only; Studio never matches a name.
- **What does not resolve is said, not dropped.** It comes back in
  ``unresolved`` with the words that failed, and the link carries the rest.

Usage::

    link = await BoardOpenManager().open(db, graph=graph, actor_id=user_id, list_key="runs",
                                         words={"agent": "Route Auditor", "status": "failed"})
    link.path, link.params, link.total, link.unresolved

A list is a :class:`Board`. Runs and Agents are registered here; a list owned
by a higher band (Approvals, the ledger) registers itself with
:func:`register_board` and is counted by its own manager.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.agents.schemas import AGENT_LIST
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.core.auth.querysets import UserQuerySet
from invana.core.errors import NotFoundError
from invana.core.lists import ListParams, ListSpec, applied_filters
from invana.runtime import emissions, services
from invana.runtime.models import Emission
from invana.runtime.schemas import RUN_LIST

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.graphs.models import Graph

#: Counts one list's rows for a reader: ``(db, graph, actor_id, params) → total``.
Counter = Callable[["AsyncSession", "Graph", str, ListParams], Awaitable[int]]


@dataclass(frozen=True, slots=True)
class Board:
    """One list the assistant can open."""

    key: str
    #: The list's name on the card — ``Runs``.
    label: str
    #: Where Studio opens it, under the Graph.
    path: str
    #: What one row is called, singular then plural.
    noun: tuple[str, str]
    spec: ListSpec
    count: Counter


@dataclass(slots=True)
class Link:
    """A list, filtered: what the ``link`` emission carries."""

    board: Board
    params: dict[str, str]
    chips: list[dict]
    total: int
    unresolved: list[dict] = field(default_factory=list)

    @property
    def path(self) -> str:
        return self.board.path

    @property
    def sentence(self) -> str:
        """The reply: what opened, and what did not resolve."""
        n = len(self.chips)
        one, many = self.board.noun
        head = (
            f"Opened {self.board.label} · {n} filter{'' if n == 1 else 's'} · "
            f"{self.total} {one if self.total == 1 else many}."
        )
        return " ".join([head, *(u["reason"] for u in self.unresolved)])

    def payload(self) -> dict:
        return {
            "list": self.board.key,
            "label": self.board.label,
            "noun": list(self.board.noun),
            "path": self.board.path,
            "params": self.params,
            "chips": self.chips,
            "total": self.total,
            "unresolved": self.unresolved,
        }


BOARDS: dict[str, Board] = {}


def register_board(board: Board) -> None:
    """Make a list openable by the assistant. Registering a key again replaces it."""
    BOARDS[board.key] = board


# ── The words → values table ─────────────────────────────────────────────────
#
# One table, read for every list: a list takes a value only when its spec does,
# so *failed* opens Runs on ``status=failed`` and is refused by the ledger.

SINCE_WORDS = {
    "today": "24h",
    "24h": "24h",
    "24 hours": "24h",
    "last 24 hours": "24h",
    "this week": "7d",
    "7 days": "7d",
    "last 7 days": "7d",
    "last week": "7d",
    "this month": "30d",
    "30 days": "30d",
    "last 30 days": "30d",
    "last month": "30d",
    "90 days": "90d",
    "last 90 days": "90d",
    "this quarter": "90d",
}

#: Status words that are not the value itself. A word that *is* a value
#: (``failed``, ``paused``, ``pending``) needs no row here.
STATUS_WORDS = {
    "failing": ("status", "failed"),
    "successful": ("status", "succeeded"),
    "succeeded": ("status", "succeeded"),
    "cancelled": ("status", "cancelled"),
    "canceled": ("status", "cancelled"),
    "live": ("state", "live"),
    "in flight": ("state", "live"),
    "waiting": ("state", "waiting"),
    "waiting on a person": ("state", "waiting"),
    "ended": ("state", "ended"),
    "finished": ("state", "ended"),
    "didn't serve": ("exit_reason", "not_served"),
    "did not serve": ("exit_reason", "not_served"),
    "not served": ("exit_reason", "not_served"),
    "unserved": ("exit_reason", "not_served"),
    "served": ("exit_reason", "served"),
    "denied": ("verdict", "refused"),
    "refused": ("verdict", "refused"),
    "waiting on me": ("mine", "true"),
    "for me": ("mine", "true"),
    "mine": ("mine", "true"),
    "decided": ("view", "answered"),
    "answered": ("view", "answered"),
}

ORIGIN_WORDS = {
    "scheduled": "schedule",
    "on a schedule": "schedule",
    "delegated": "delegation",
    "by people": "user",
    "people": "user",
    "person": "user",
    "asked": "user",
    "tasks": "task",
}

VERDICT_WORDS = {"denied": "refused", "blocked": "refused", "approved": "allowed", "waiting": "approval"}


def _norm(words: str) -> str:
    return " ".join(words.lower().replace("\u2019", "'").split())


def _value(word: str) -> str:
    return _norm(word).replace(" ", "_")


class BoardOpenManager:
    """Words → a list's filters, its count, and the link to it."""

    def __init__(self) -> None:
        self.agents = AgentQuerySet()
        self.members = GraphMemberQuerySet()
        self.users = UserQuerySet()

    async def open(
        self,
        db: AsyncSession,
        *,
        graph: Graph,
        actor_id: str,
        list_key: str,
        words: dict[str, str],
    ) -> Link:
        """Resolve ``words`` against one list. Raises ``NotFoundError`` for a list nobody registered."""
        board = BOARDS.get(_value(list_key))
        if board is None:
            raise NotFoundError(f"There is no list called {list_key!r} to open.")
        filters: dict[str, str] = {}
        labels: dict[str, dict[str, str]] = {}
        unresolved: list[dict] = []

        def take(name: str, value: str, word: str, what: str) -> None:
            rule = board.spec.filters.get(name)
            if rule is None or (rule.values is not None and value not in rule.values):
                unresolved.append(
                    {"field": what, "word": word, "reason": f'{board.label} cannot be filtered by "{word}".'}
                )
                return
            filters[name] = value

        for key, word in words.items():
            if key == "list" or not word.strip():
                continue
            if key == "agent":
                agent = await self._agent(db, graph=graph, name=word)
                if agent is None or "agent_id" not in board.spec.filters:
                    unresolved.append({"field": "agent", "word": word, "reason": f'No agent named "{word}".'})
                    continue
                filters["agent_id"] = agent.id
                labels["agent_id"] = {agent.id: agent.name}
            elif key == "started_by":
                user_id, name = await self._person(db, graph=graph, actor_id=actor_id, word=word)
                if user_id is None or "started_by" not in board.spec.filters:
                    unresolved.append({"field": "started_by", "word": word, "reason": f'No member named "{word}".'})
                    continue
                filters["started_by"] = user_id
                labels["started_by"] = {user_id: name}
            elif key == "since":
                take("since", SINCE_WORDS.get(_norm(word), _value(word)), word, "since")
            elif key == "origin":
                take("origin", ORIGIN_WORDS.get(_norm(word), _value(word)), word, "origin")
            elif key == "verdict":
                take("verdict", VERDICT_WORDS.get(_norm(word), _value(word)), word, "verdict")
            elif key == "status":
                name, value = STATUS_WORDS.get(_norm(word), ("status", _value(word)))
                if name == "status" and "status" not in board.spec.filters and "verdict" in board.spec.filters:
                    name, value = "verdict", VERDICT_WORDS.get(_norm(word), value)
                take(name, value, word, "status")

        params = ListParams(filters={k: (v,) for k, v in filters.items()}, sort=board.spec.default_sort, limit=1)
        total = await board.count(db, graph, actor_id, params)
        chips = [a.model_dump() for a in applied_filters(params, board.spec, labels)]
        return Link(
            board=board,
            params={f"f.{k}": v for k, v in filters.items()},
            chips=chips,
            total=total,
            unresolved=unresolved,
        )

    async def write(
        self, db: AsyncSession, *, link: Link, run_id: str, message_id: str | None, step_id: str
    ) -> Emission:
        """The ``link`` emission, cited by the count the list's own query returned."""
        emission = Emission(
            run_id=run_id,
            message_id=message_id,
            step_run_id=step_id,
            seq=await emissions.next_seq(db, run_id),
            kind="link",
            payload=link.payload(),
            template_id=None,
            citation={"query": None, "query_language": None, "record_count": link.total},
        )
        db.add(emission)
        await db.flush()
        return emission

    async def _agent(self, db: AsyncSession, *, graph: Graph, name: str):
        """The Graph's agent this name means — its name or key, any case; retired ones included."""
        wanted = _norm(name)
        rows = await self.agents.list_for_graph(db, graph.id, include_ephemeral=True, include_retired=True)
        for agent in rows:
            if _norm(agent.name) == wanted or _norm(agent.key or "") == wanted:
                return agent
        return None

    async def _person(self, db: AsyncSession, *, graph: Graph, actor_id: str, word: str) -> tuple[str | None, str]:
        """A member of the Graph by username; *me* is the asker."""
        if _norm(word) in {"me", "i", "myself", "my"}:
            member = await self.members.get(db, graph_id=graph.id, user_id=actor_id)
        else:
            member = await self.members.get_by_username(db, graph_id=graph.id, username=word.strip().lstrip("@"))
        if member is None:
            return None, word
        names = await self.users.usernames_by_ids(db, [member.user_id])
        return member.user_id, names.get(member.user_id, word)


async def _count_runs(db: AsyncSession, graph: Graph, _actor_id: str, params: ListParams) -> int:
    _, info = await services.list_runs(db, graph_id=graph.id, params=params)
    return info.total


async def _count_agents(db: AsyncSession, graph: Graph, _actor_id: str, params: ListParams) -> int:
    _, info = await AgentQuerySet().page_for_graph(db, graph.id, params=params)
    return info.total


register_board(Board("runs", "Runs", "/agents/runs", ("run", "runs"), RUN_LIST, _count_runs))
register_board(Board("agents", "Agents", "/agents/agents", ("agent", "agents"), AGENT_LIST, _count_agents))
