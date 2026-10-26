"""Every rule in force in one Graph, as one list
(docs/for-developers/modules/skills/features/rules.md).

The Modeller's Rules page reads the install's rules, the Graph's own and every project's
the reader can see — in assembly order, so the page reads in the order a step is
given them. Each row carries its citation count, the acts its check is read at,
its project's name on a working rule, and how many acts of the last 30 days its
check breaks (``RuleImpactManager``). The list is the list contract: ``scope``
and ``act`` are named filters, ``q`` matches the statement.

Usage::

    pages = RulePageManager()
    items, info = await pages.in_force(session, graph=g, reader_id=u.id, params=params)
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.models import Rule
from invana.apps.skills.schemas import RuleRead
from invana.apps.work.managers import ProjectManager
from invana.core.lists import ListParams, PageInfo, page_of_rows
from invana.runtime.managers.rule_citations import RuleCitationManager
from invana.runtime.managers.rule_impact import RuleImpactManager

_SCOPE_RANK = {"install": 0, "graph": 1, "project": 2}


class RulePageManager:
    """Stateless. The session is the first argument of every method."""

    rules = RuleManager()
    projects = ProjectManager()
    citations = RuleCitationManager()
    impact = RuleImpactManager()

    async def in_force(
        self, session: AsyncSession, *, graph: Graph, reader_id: str, params: ListParams
    ) -> tuple[list[RuleRead], PageInfo]:
        """One page of the Graph's rules in force, every scope, in assembly order."""
        projects = await self.projects.list_for_graph(session, graph_id=graph.id, reader_id=reader_id)
        rank = {p.id: i for i, p in enumerate(projects)}
        rows: list[Rule] = [
            *await self.rules.install(session),
            *await self.rules.invariants(session, graph_id=graph.id),
        ]
        for project in projects:
            rows += await self.rules.working(session, project_id=project.id)
        unfiltered = len(rows)

        scopes = set(params.values("scope"))
        acts = set(params.values("act"))
        q = (params.q or "").strip().lower()
        reads: list[RuleRead] = []
        for rule in rows:
            read = RuleRead.model_validate(rule)
            if scopes and read.scope not in scopes:
                continue
            if acts and not acts & set(read.acts):
                continue
            if q and q not in read.statement.lower():
                continue
            reads.append(read)

        kept = {r.id for r in reads}
        by_id = {r.id: r for r in rows if r.id in kept}
        counts = await self.citations.counts_for(session, graph_id=graph.id, rules=list(by_id.values()))
        broken = await self.impact.broken_counts(session, rules=list(by_id.values()), graph_id=graph.id)
        names = {p.id: p for p in projects}
        for read in reads:
            read.citations = counts.get(read.id, 0)
            read.broken_30d = broken.get(read.id) if read.check is not None else None
            if read.graph_id is not None:
                read.graph_name = graph.name
            if read.project_id in names:
                read.project_key = names[read.project_id].key
                read.project_name = names[read.project_id].name

        # Assembly order as one integer, so a cursor can carry it.
        assembled = sorted(
            reads,
            key=lambda r: (_SCOPE_RANK[r.scope], rank.get(r.project_id or "", -1), r.order, r.created_at),
        )
        position = {r.id: i for i, r in enumerate(assembled)}
        return page_of_rows(
            reads,
            params,
            unfiltered_total=unfiltered,
            sorts={"order": lambda r: position[r.id]},
            id_of=lambda r: r.id,
        )
