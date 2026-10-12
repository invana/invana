"""One name search over everything a reader may open.

docs/for-developers/modules/platform/features/search.md. Access is decided here
and nowhere else, before anything is matched:

- Graph records come only from the Graphs the reader is a member of — every
  member reads every record, so a Graph role narrows nothing;
- datasets come through the dataset reading rule (install-visible, the reader's
  own, or every one for an install Admin);
- ``graph_ref`` narrows to one Graph, and one the reader is not in is absent.

Ranking is the name alone: exact, then prefix, then contains, then the name::

    response = await SearchManager().search(session, reader=user, text="ara", graph_ref="ada/arabidopsis")
    [(hit.kind, hit.name, hit.match) for hit in response.hits]
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.querysets import SearchQuerySet
from invana.activity.querysets.search import KINDS
from invana.activity.schemas import SearchHit, SearchResponse
from invana.apps.datasets.managers import DatasetManager
from invana.apps.graphs.querysets import GraphMemberQuerySet, GraphQuerySet
from invana.core.auth.models import User
from invana.core.errors import NotFoundError, ValidationError

DEFAULT_LIMIT = 20
MAX_LIMIT = 50
MAX_TEXT = 200

_PRODUCT = {
    "model": "modeller",
    "world": "modeller",
    "guardrail": "modeller",
    "agent": "agents",
    "skill": "agents",
    "project": "projects",
    "dataset": "datasets",
}
_RANK = {"exact": 0, "prefix": 1, "contains": 2}


def match_of(name: str, needle: str) -> str | None:
    """How ``name`` matches the lower-cased ``needle``, or ``None``."""
    lowered = name.lower()
    if lowered == needle:
        return "exact"
    if lowered.startswith(needle):
        return "prefix"
    if needle in lowered:
        return "contains"
    return None


class SearchManager:
    search_qs = SearchQuerySet()
    graphs_qs = GraphQuerySet()
    members_qs = GraphMemberQuerySet()

    async def search(
        self,
        session: AsyncSession,
        *,
        reader: User,
        text: str,
        graph_ref: str | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> SearchResponse:
        query = text.strip()
        if not query:
            raise ValidationError("Type something to search for.")
        if len(query) > MAX_TEXT:
            raise ValidationError(f"Search text is at most {MAX_TEXT} characters.")
        limit = max(1, min(limit, MAX_LIMIT))
        needle = query.lower()

        graph_ids = await self.members_qs.graph_ids_for_user(session, user_id=reader.id)
        if graph_ref is not None:
            graph_ids = [await self._one_graph(session, graph_ref=graph_ref, member_of=graph_ids)]
        refs = await self.search_qs.graph_refs(session, graph_ids=graph_ids)

        hits: list[SearchHit] = []
        if graph_ref is None:
            for graph_id, (name, ref) in refs.items():
                match = match_of(name, needle) or match_of(ref.partition("/")[2], needle)
                if match:
                    hits.append(SearchHit(kind="graph", id=graph_id, name=name, graph=ref, match=match))
        for kind in KINDS:
            rows = await self.search_qs.named(session, kind=kind, graph_ids=graph_ids, needle=needle, limit=limit)
            for row_id, name, graph_id in rows:
                hits.append(
                    SearchHit(
                        kind=kind,
                        id=row_id,
                        name=name,
                        graph=refs[graph_id][1],
                        product=_PRODUCT[kind],
                        match=match_of(name, needle) or "contains",
                    )
                )
        if graph_ref is None:
            hits.extend(await self._datasets(session, reader=reader, needle=needle))

        hits.sort(key=lambda hit: (_RANK[hit.match], hit.name.lower(), hit.kind))
        return SearchResponse(query=query, hits=hits[:limit])

    async def _one_graph(self, session: AsyncSession, *, graph_ref: str, member_of: list[str]) -> str:
        username, _, slug = graph_ref.strip().lower().partition("/")
        graph = (
            await self.graphs_qs.get_by_owner_username_and_slug(session, owner_username=username, slug=slug)
            if slug
            else None
        )
        if graph is None or graph.id not in member_of:
            raise NotFoundError(f"Graph {graph_ref!r} not found.")
        return graph.id

    async def _datasets(self, session: AsyncSession, *, reader: User, needle: str) -> list[SearchHit]:
        hits = []
        for dataset in await DatasetManager().catalogue(session, reader=reader, text=needle):
            address = f"{dataset.publisher}/{dataset.name}"
            match = match_of(dataset.name, needle) or match_of(address, needle) or match_of(dataset.title or "", needle)
            if match:
                hits.append(SearchHit(kind="dataset", id=dataset.id, name=address, product="datasets", match=match))
        return hits
