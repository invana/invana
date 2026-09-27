"""The model page's measured tabs, in one read (the-model-page.md MP33).

``read`` answers each slice it can measure and ``None`` for one it cannot, so a
tab that waits on a slice says *Not measured yet* and the read's shape is final.

**Growth** (MP14 · MP32) is drawn by day from count snapshots, stepped: a day's
value is the last count at or before that day's end, and the window opens on
each type's last count at or before its start. A model's line is the sum of
its active version's types, so a label two models declare counts toward both.

**Overview, Usage and Performance** read the query log over the window
(``query_insights``); the **shape card** reads one shape's calls and the plan
it was explained with, and advises against the indexes the database reports
now (MP39).
"""

from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import TYPE_CHECKING, Literal

from invana.apps.modeller.managers.query_insights import Facts, Line, QueryInsights
from invana.apps.modeller.querysets.graph_model import GraphModelQuerySet
from invana.apps.modeller.querysets.graph_query_log import GraphQueryLogQuerySet
from invana.apps.modeller.querysets.graph_version import GraphVersionQuerySet
from invana.apps.modeller.querysets.type_count_snapshot import TypeCountSnapshotQuerySet
from invana.apps.modeller.schemas import (
    Advice,
    Growth,
    GrowthMark,
    GrowthRow,
    GrowthSeries,
    GrowthWrites,
    Insights,
    ShapeCard,
    SlowCall,
    WrittenBy,
)
from invana.core.errors import NotFoundError
from invana.core.utils import percentile
from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.base.exceptions import ConnectorError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import GraphVersion, TypeCountSnapshot

Window = Literal["7d", "30d", "90d"]
DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90}

TypeKey = tuple[str, str]  # (kind, type name)


@dataclass
class _Scope:
    """What the page reads: every published model, or one — each with its types."""

    models: list[tuple[str, str, list[TypeKey]]]  # (id, name, types)
    one: bool
    versions: dict[str, GraphVersion]


class InsightsManager:
    def __init__(self) -> None:
        self._models = GraphModelQuerySet()
        self._versions = GraphVersionQuerySet()
        self._snapshots = TypeCountSnapshotQuerySet()
        self._log = GraphQueryLogQuerySet()

    async def read(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        model_id: str | None,
        window: Window,
        connector: BaseConnector | None = None,
        today: date | None = None,
    ) -> Insights:
        scope = await self._scope(session, graph_id, model_id)
        today = today or datetime.now(UTC).date()
        days = DAYS[window]
        queries = await self._queries(session, graph_id, scope, days, today, connector)
        return Insights(
            window=window,
            growth=await self._growth(session, graph_id, scope, days, today),
            overview=queries.overview(),
            usage=queries.usage(),
            performance=queries.performance(),
        )

    async def _scope(self, session: AsyncSession, graph_id: str, model_id: str | None) -> _Scope:
        authored = [
            m
            for m in await self._models.list_graph_models(session, graph_id)
            if m.origin != "introspected" and m.status != "archived"
        ]
        if model_id is not None:
            authored = [m for m in authored if m.id == model_id]
            if not authored:
                raise NotFoundError("Model not found.")
        models, versions = [], {}
        for m in authored:
            version = await self._versions.get_active_version(session, m.id)
            if version is not None:
                types = [("node", t.name) for t in version.node_types] + [("edge", t.name) for t in version.edge_types]
                models.append((m.id, m.name, types))
                versions[m.id] = version
        return _Scope(models=models, one=model_id is not None, versions=versions)

    # ── Overview · Usage · Performance ────────────────────────────────────────

    async def _queries(
        self,
        session: AsyncSession,
        graph_id: str,
        scope: _Scope,
        days: int,
        today: date,
        connector: BaseConnector | None,
    ) -> QueryInsights:
        first = today - timedelta(days=days - 1)
        start = datetime.combine(first, time.min, tzinfo=UTC)
        latest = await self._snapshots.openers(session, graph_id, datetime.now(UTC))
        counted = {(s.kind, s.type_name): s.count for s in latest}
        scope_types = {k: name for _, name, types in scope.models for k in types}
        # A type the Graph was counted without is a count of zero; before any
        # count at all, nothing is known and nothing is called empty (MP10).
        records = {k: counted.get(k, 0) for k in scope_types} if latest else {}
        properties: dict[str, list[str]] = {}
        if scope.one:
            for version in scope.versions.values():
                for t in version.node_types:
                    properties[t.name] = [m.property_key.name for m in t.property_mappings if m.property_key]
        lines = (
            [Line(f"{kind}:{name}", name, kind, [(kind, name)]) for _, _, types in scope.models for kind, name in types]
            if scope.one
            else [Line(mid, name, "model", types) for mid, name, types in scope.models]
        )
        return QueryInsights(
            Facts(
                rows=await self._log.since(session, graph_id, start),
                days=[first + timedelta(days=i) for i in range(days)],
                lines=lines,
                one=scope.one,
                scope_types=scope_types,
                properties=properties,
                records=records,
                degrees=await self._snapshots.latest_degrees(session, graph_id),
                stitches=[] if scope.one else await self._models.active_stitches(session, graph_id),
                indexes=await _indexes(connector),
            )
        )

    # ── The shape card (MP12 · MP13 · MP39) ───────────────────────────────────

    async def shape(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        shape_hash: str,
        window: Window,
        connector: BaseConnector | None,
        today: date | None = None,
    ) -> ShapeCard:
        today = today or datetime.now(UTC).date()
        start = datetime.combine(today - timedelta(days=DAYS[window] - 1), time.min, tzinfo=UTC)
        calls = await self._log.of_shape(session, graph_id, shape_hash, start)
        if not calls:
            raise NotFoundError("No query of this shape in the window.")
        explained = await self._log.explained(session, graph_id, shape_hash)
        explains = explained is not None or (
            connector is not None and type(connector).explain is not BaseConnector.explain
        )
        advice: list[Advice] = []
        if explains:
            indexes = await _indexes(connector)
            scanned = {
                item
                for r in [*calls, *([explained] if explained else [])]
                for item in (r.properties_touched or {}).get("scanned", [])
            }
            owners = await self._owners(session, graph_id)
            for item in sorted(scanned):
                label, _, prop = item.partition(".")
                if indexes is not None and (label, prop) in indexes:
                    continue
                owner = owners.get(label)
                advice.append(
                    Advice(
                        kind="missing_index",
                        label=label,
                        property=prop,
                        model_id=owner[0] if owner else None,
                        model_name=owner[1] if owner else None,
                        calls=sum(1 for r in calls if item in (r.properties_touched or {}).get("filtered", [])),
                    )
                )
        durations = [r.duration_ms for r in calls]
        types = sorted(
            {t for r in calls for t in (r.types_touched or {}).get("nodes", [])}
            | {t for r in calls for t in (r.types_touched or {}).get("edges", [])}
        )
        callers: dict[str, int] = {}
        for r in calls:
            callers[r.caller_kind] = callers.get(r.caller_kind, 0) + 1
        return ShapeCard(
            hash=shape_hash,
            text=calls[-1].shape_text,
            language=calls[-1].language,
            calls=len(calls),
            p50=_round(percentile(durations, 0.5)),
            p95=_round(percentile(durations, 0.95)),
            callers=callers,
            types=types,
            touched_from="plan" if any(r.touched_from == "plan" for r in calls) else "results",
            plan=list((explained.properties_touched or {}).get("plan", [])) if explained else [],
            slowest=[
                SlowCall(
                    at=r.at,
                    duration_ms=r.duration_ms,
                    caller_kind=r.caller_kind,
                    caller_id=r.caller_id,
                    task_run_id=r.task_run_id,
                )
                for r in sorted(calls, key=lambda r: -r.duration_ms)[:5]
            ],
            advice=advice,
            explains=explains,
        )

    async def _owners(self, session: AsyncSession, graph_id: str) -> dict[str, tuple[str, str]]:
        """Each node label → the first published model that declares it — where its index is staged."""
        scope = await self._scope(session, graph_id, None)
        owners: dict[str, tuple[str, str]] = {}
        for mid, name, types in scope.models:
            for kind, label in types:
                if kind == "node":
                    owners.setdefault(label, (mid, name))
        return owners

    # ── Growth ────────────────────────────────────────────────────────────────

    async def _growth(self, session: AsyncSession, graph_id: str, scope: _Scope, days: int, today: date) -> Growth:
        first = today - timedelta(days=days - 1)
        start = datetime.combine(first, time.min, tzinfo=UTC)
        ends = [datetime.combine(first + timedelta(days=i), time.max, tzinfo=UTC) for i in range(days)]

        openers = await self._snapshots.openers(session, graph_id, start)
        recent = await self._snapshots.since(session, graph_id, start)

        # Each type's counts in time order: the opener, then every write in the window.
        timeline: dict[TypeKey, list[TypeCountSnapshot]] = {}
        for snap in [*sorted(openers, key=lambda s: s.at), *recent]:
            timeline.setdefault((snap.kind, snap.type_name), []).append(snap)
        stamps = {key: [s.at for s in snaps] for key, snaps in timeline.items()}

        def value_at(key: TypeKey, moment: datetime) -> int | None:
            i = bisect_right(stamps.get(key, []), moment)
            return timeline[key][i - 1].count if i else None

        def total(keys: list[TypeKey], moment: datetime) -> int | None:
            values = [value_at(k, moment) for k in keys]
            known = [v for v in values if v is not None]
            return sum(known) if known else None

        def last_write(keys: list[TypeKey]) -> WrittenBy | None:
            snaps = [s for k in keys for s in timeline.get(k, []) if s.source != "introspect"]
            if not snaps:
                return None
            s = max(snaps, key=lambda s: s.at)
            return WrittenBy(source=s.source, source_id=s.source_id, at=s.at)

        # At All models a line per model; at one model, a line per type.
        lines: list[tuple[str, str, Literal["model", "node", "edge"], list[TypeKey]]] = (
            [(f"{kind}:{name}", name, kind, [(kind, name)]) for _, _, types in scope.models for kind, name in types]
            if scope.one
            else [(mid, name, "model", types) for mid, name, types in scope.models]
        )
        now = datetime.now(UTC)
        series = [
            GrowthSeries(key=key, name=name, kind=kind, values=[total(keys, end) for end in ends])
            for key, name, kind, keys in lines
        ]
        rows = []
        for key, name, kind, keys in lines:
            opening, current = total(keys, start), total(keys, now)
            rows.append(
                GrowthRow(
                    key=key,
                    name=name,
                    kind=kind,
                    start=opening,
                    now=current,
                    change=current - opening if current is not None and opening is not None else None,
                    last=last_write(keys),
                )
            )

        acts: dict[tuple[str, str | None], datetime] = {}
        for snap in recent:
            if snap.source != "introspect":
                acts.setdefault((snap.source, snap.source_id), snap.at)
        marks = [
            GrowthMark(index=(at.date() - first).days, source=source, source_id=source_id, at=at)
            for (source, source_id), at in sorted(acts.items(), key=lambda a: a[1])
        ]
        in_scope = {k for _, _, types in scope.models for k in types}
        return Growth(
            labels=[(first + timedelta(days=i)).isoformat() for i in range(days)],
            series=series,
            marks=marks,
            rows=rows,
            writes=GrowthWrites(
                imports=sum(1 for m in marks if m.source == "import"),
                stitch_commits=sum(1 for m in marks if m.source == "stitch_commit"),
            ),
            counted=any(k in timeline for k in in_scope),
        )


def _round(value: float | None) -> float | None:
    return round(value, 1) if value is not None else None


async def _indexes(connector: BaseConnector | None) -> set[tuple[str, str]] | None:
    """``(label, property)`` the database has an index on now; ``None`` when it cannot say (MP26 · MP39)."""
    if connector is None or not connector.schema_reader.lists_schema:
        return None
    try:
        found = await connector.schema_reader.get_indexes()
    except ConnectorError:
        return None
    return {(i.label, p) for i in found for p in i.properties[:1]}
