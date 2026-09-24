"""Solving a stitch — the edges a declared rule implies (stitch-models.md ST44-ST49).

A stitch is a rule about two published models. Committing it says the rule belongs in
the union, and a union the graph does not reflect is a claim nothing can traverse — so
the commit **solves** it: one MERGE joining the key on each side (ST44).

What each kind writes (ST45): a keyed relationship writes its own ``edge_type``, an
anchor writes ``SAME_AS`` — both nodes stay, nothing merges (ST2) — and a
model-sourced relationship writes nothing at all, because its rows are its own fact
and arrive with the records.

Every edge carries the marks in ``ORIGIN`` (ST46): nobody loaded these, a rule derived
them, and a withdrawal has to be able to find exactly its own. The write is a MERGE, so
solving twice writes nothing twice (ST49) — which is what makes it safe to run again at
the end of every import (ST47).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from invana.apps.modeller.models import ModelLink
    from invana.graph.connectors.base.connector import BaseConnector

#: The edge an anchor writes. Both nodes stay; this is the link queries traverse (ST45).
ANCHOR_EDGE = "SAME_AS"

#: What marks an edge as derived rather than loaded (ST46).
ORIGIN = "stitch"
ORIGIN_KEY = "_inv_origin"
STITCH_ID_KEY = "_inv_stitch_id"
RULE_KEY = "_inv_rule"
SOLVED_AT_KEY = "_inv_at"

#: The provenance the importer stamps on everything it writes (load-data.md LD4), used
#: to scope an import-time solve to the records that load just wrote (ST47).
#:
#: **Named for the run, because the run is what survives.** This was
#: `_inv_job_id` while an import's record of itself was an `import_jobs` row;
#: that table goes, the TaskRun stays, and the element points at the record a
#: reader can still open (task-model-migration § 6.6).
RUN_KEY = "_inv_run_id"


@dataclass
class Solved:
    """One stitch, run. ``written`` counts the MERGEs the database reported."""

    link_id: str
    edge_type: str
    rule: str
    written: int = 0
    #: Set when there was nothing to run: a model-sourced relationship (ST45).
    skipped: str = ""


def rule_of(link: ModelLink) -> str:
    """The rule in the words the row states it in — `City.code = airport.code`."""
    return f"{link.source_type}.{link.source_property} = {link.target_type}.{link.target_property}"


def edge_of(link: ModelLink) -> str:
    return ANCHOR_EDGE if link.kind == "anchor" else (link.edge_type or "")


def solvable(link: ModelLink) -> bool:
    """A rule with a key on each side. A source model supplies its own rows (ST45)."""
    return bool(link.source_property and link.target_property) and not link.source_model_id


def _label(name: str) -> str:
    return f"`{name.replace('`', '')}`"


def solve_query(link: ModelLink, *, scoped: bool = False) -> str:
    """The MERGE that writes what the rule implies.

    ``scoped`` narrows the join to records carrying one run's provenance — an
    import solving the Graph's standing stitches over what it has just written
    (ST47), rather than over the whole database again.
    """
    fold = link.identity_match == "case_insensitive"

    def key(var: str, prop: str) -> str:
        raw = f"{var}.{_label(prop)}"
        return f"toLower(toString({raw}))" if fold else raw

    where = [f"a.{_label(link.source_property or '')} IS NOT NULL"]
    if scoped:
        # Either side being new is enough: a tweet landing today has to reach an
        # airport loaded last month, and an airport landing today has to be
        # reachable from every tweet already here.
        where.append(f"(a.{_label(RUN_KEY)} = $run_id OR b.{_label(RUN_KEY)} = $run_id)")

    return (
        f"MATCH (a:{_label(link.source_type)}) WHERE {where[0]} "
        f"MATCH (b:{_label(link.target_type)}) "
        f"WHERE b.{_label(link.target_property or '')} IS NOT NULL "
        f"AND {key('b', link.target_property or '')} = {key('a', link.source_property or '')}"
        + (f" AND {where[1]}" if scoped else "")
        + f" MERGE (a)-[r:{_label(edge_of(link))}]->(b) "
        "SET r += $prov "
        "RETURN count(r) AS written"
    )


def stamp(link: ModelLink) -> dict[str, Any]:
    """What every stitch-made edge carries (ST46)."""
    return {
        ORIGIN_KEY: ORIGIN,
        STITCH_ID_KEY: link.id,
        RULE_KEY: rule_of(link),
        SOLVED_AT_KEY: datetime.now(UTC).isoformat(),
    }


def withdraw_query() -> str:
    """Delete the edges one stitch wrote, and nothing else (ST48)."""
    return (
        f"MATCH ()-[r]->() WHERE r.{_label(STITCH_ID_KEY)} = $stitch_id "
        "WITH r LIMIT 100000 DELETE r RETURN count(r) AS removed"
    )


def written_query() -> str:
    """How many edges one stitch has written — what `resolve` reports beside the count."""
    return f"MATCH ()-[r]->() WHERE r.{_label(STITCH_ID_KEY)} = $stitch_id RETURN count(r) AS written"


def _count(result: Any, field: str) -> int:
    rows = getattr(result, "records", None) or getattr(result, "rows", None) or []
    if not rows:
        return 0
    row = rows[0]
    value = row.get(field) if isinstance(row, dict) else getattr(row, field, 0)
    return int(value or 0)


async def solve_link(
    connector: BaseConnector,
    link: ModelLink,
    *,
    run_id: str | None = None,
) -> Solved:
    """Run one stitch against the bound database. The connector is already open.

    ``run_id`` scopes the join to one load's records (ST47); without it the rule
    runs over everything the graph holds, which is what a commit wants.
    """
    solved = Solved(link_id=link.id, edge_type=edge_of(link), rule=rule_of(link))
    if not solvable(link):
        solved.skipped = "its rows arrive with its records" if link.source_model_id else "no key on each side"
        return solved

    params: dict[str, Any] = {"prov": stamp(link)}
    if run_id:
        params["run_id"] = run_id
    result = await connector.execute(solve_query(link, scoped=bool(run_id)), params)
    solved.written = _count(result, "written")
    return solved


async def solve_links(
    connector: BaseConnector,
    links: list[ModelLink],
    *,
    run_id: str | None = None,
) -> list[Solved]:
    """Run a set of stitches in the order they were declared."""
    return [await solve_link(connector, link, run_id=run_id) for link in links]


async def withdraw_link(connector: BaseConnector, link: ModelLink) -> int:
    """Delete what one stitch wrote. Returns how many edges went (ST48)."""
    if not solvable(link):
        return 0
    result = await connector.execute(withdraw_query(), {"stitch_id": link.id})
    return _count(result, "removed")
