"""The rules the Overview, Usage and Performance tabs read off the query log.

Everything here is computed at read time over the window's rows (MP16 · MP40):
percentiles in the engine, signals by the fixed rules of MP10, stitches crossed
by MP41, and advice candidates by MP39. Nothing is stored as a flag, so a rule
that changes re-reads every window.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import TYPE_CHECKING, Literal

from invana.apps.modeller.schemas import (
    Attention,
    CallerDay,
    DayValue,
    Overview,
    OverviewRow,
    Performance,
    PropertyUse,
    ShapeRow,
    Signal,
    StitchUse,
    Usage,
    UsageRow,
)
from invana.core.utils import percentile

if TYPE_CHECKING:
    from invana.apps.modeller.models import GraphQueryLog, ModelLink

TypeKey = tuple[str, str]  # (kind, type name)
CALLERS = ("agent", "plan", "explorer", "api")

#: Below this many queries on the Graph, nothing is called unused or hot (MP10).
TOO_FEW = 50
HOT_SHARE = 0.25
SUPERNODE_RATIO = 100
SUPERNODE_MIN = 1_000
_SHAPES_SHOWN = 50

nf = "{:,}".format


@dataclass
class Line:
    """One row of a tab: a model at All models, a type at one."""

    key: str
    name: str
    kind: Literal["model", "node", "edge"]
    types: list[TypeKey]


@dataclass
class Facts:
    rows: list[GraphQueryLog]
    days: list[date]
    lines: list[Line]
    one: bool
    #: Every type in scope, and the model that declares it.
    scope_types: dict[TypeKey, str]
    #: Declared properties per node type, for the per-property table.
    properties: dict[str, list[str]]
    #: Latest count per type; absent where it was never counted.
    records: dict[TypeKey, int]
    #: Latest ``(max, median)`` degree per node label.
    degrees: dict[str, tuple[int, int]]
    stitches: list[tuple[ModelLink, str, str]] = field(default_factory=list)
    #: ``(label, property)`` the database has an index on, or ``None`` when it cannot say.
    indexes: set[tuple[str, str]] | None = None


def touched(row: GraphQueryLog, key: TypeKey) -> bool:
    kind, name = key
    return name in (row.types_touched or {}).get("nodes" if kind == "node" else "edges", [])


def _ms(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value / 1000:.1f}s" if value >= 1000 else f"{round(value)}ms"


def _p(rows: list[GraphQueryLog], q: float) -> float | None:
    value = percentile([r.duration_ms for r in rows], q)
    return round(value, 1) if value is not None else None


class QueryInsights:
    def __init__(self, facts: Facts) -> None:
        self.f = facts
        self.total = len(facts.rows)
        self.graph_p95 = _p(facts.rows, 0.95)
        in_scope = list(facts.scope_types)
        self.scope_rows = [r for r in facts.rows if any(touched(r, k) for k in in_scope)] if facts.one else facts.rows
        self.hits: dict[TypeKey, list[GraphQueryLog]] = {k: [r for r in facts.rows if touched(r, k)] for k in in_scope}
        self.signals = {k: self._type_signals(k) for k in in_scope}

    # ── signals (MP10) ───────────────────────────────────────────────────────

    def _type_signals(self, key: TypeKey) -> list[Signal]:
        if self.total < TOO_FEW:
            return []
        kind, name = key
        subject = name if self.f.one else f"{self.f.scope_types[key]}.{name}"
        hits = self.hits[key]
        records = self.f.records.get(key)
        out: list[Signal] = []
        if records == 0:
            out.append(Signal(signal="empty", subject=subject, why="published · no records"))
        elif records and not hits:
            out.append(Signal(signal="unused", subject=subject, why=f"{nf(records)} records · no query"))
        share = len(hits) / self.total
        if share >= HOT_SHARE:
            p95 = _p(hits, 0.95)
            slow = p95 is not None and self.graph_p95 is not None and p95 >= self.graph_p95
            out.append(
                Signal(
                    signal="hot_and_slow" if slow else "hot",
                    subject=subject,
                    why=f"{round(share * 100)}% of queries" + (f" · p95 {_ms(p95)}" if slow else ""),
                )
            )
        degree = self.f.degrees.get(name) if kind == "node" else None
        if degree is not None:
            top, median = degree
            if top >= SUPERNODE_MIN and top >= SUPERNODE_RATIO * max(median, 1):
                out.append(
                    Signal(signal="supernode", subject=subject, why=f"max degree {nf(top)} · median {nf(median)}")
                )
        return out

    def _line_rows(self, line: Line) -> list[GraphQueryLog]:
        return [r for r in self.f.rows if any(touched(r, k) for k in line.types)]

    def _line_signals(self, line: Line) -> list[Signal]:
        return [s for k in line.types for s in self.signals.get(k, [])]

    # ── by day ───────────────────────────────────────────────────────────────

    def _by_day(self, rows: list[GraphQueryLog]) -> dict[date, list[GraphQueryLog]]:
        out: dict[date, list[GraphQueryLog]] = defaultdict(list)
        for r in rows:
            out[r.at.date()].append(r)
        return out

    def _p95_by_day(self) -> list[DayValue]:
        by_day = self._by_day(self.scope_rows)
        return [DayValue(label=d.isoformat(), value=_p(by_day.get(d, []), 0.95)) for d in self.f.days]

    # ── advice candidates (MP39) ─────────────────────────────────────────────

    def scanned_without_index(self, rows: list[GraphQueryLog]) -> Counter[str]:
        """``label.property`` filtered after a label scan, with no index on it — and how often."""
        out: Counter[str] = Counter()
        for r in rows:
            for item in (r.properties_touched or {}).get("scanned", []):
                label, _, prop = item.partition(".")
                if self.f.indexes is None or (label, prop) not in self.f.indexes:
                    out[item] += 1
        return out

    # ── the slices ───────────────────────────────────────────────────────────

    def overview(self) -> Overview:
        rows = []
        for line in self.f.lines:
            hits = self._line_rows(line)
            rows.append(
                OverviewRow(
                    key=line.key,
                    share=round(len(hits) / self.total, 4) if self.total else 0.0,
                    p95=_p(hits, 0.95),
                    signals=self._line_signals(line),
                )
            )
        by_day = self._by_day(self.scope_rows)
        attention = [
            Attention(
                signal=s.signal,
                subject=s.subject,
                why=s.why,
                tab="performance" if s.signal == "hot_and_slow" else "growth" if s.signal == "empty" else "usage",
            )
            for k in self.f.scope_types
            for s in self.signals[k]
            if s.signal != "hot"
        ]
        if self.total >= TOO_FEW:
            for item, calls in self.scanned_without_index(self.scope_rows).most_common(5):
                attention.append(
                    Attention(
                        signal="advice", subject=item, why=f"filtered {nf(calls)} times, no index", tab="performance"
                    )
                )
        return Overview(
            queries_a_day=round(len(self.scope_rows) / len(self.f.days), 1),
            p50=_p(self.scope_rows, 0.5),
            p95=_p(self.scope_rows, 0.95),
            graph_p95=self.graph_p95,
            by_caller_by_day=[
                CallerDay(
                    label=d.isoformat(),
                    counts={c: sum(1 for r in by_day.get(d, []) if r.caller_kind == c) for c in CALLERS},
                )
                for d in self.f.days
            ],
            p95_by_day=self._p95_by_day(),
            rows=rows,
            attention=attention,
        )

    def usage(self) -> Usage:
        explains = any(r.touched_from == "plan" for r in self.f.rows)
        rows = []
        for line in self.f.lines:
            hits = self._line_rows(line)
            rows.append(
                UsageRow(
                    key=line.key,
                    name=line.name,
                    kind=line.kind,
                    queries=len(hits),
                    share=round(len(hits) / self.total, 4) if self.total else 0.0,
                    by_caller={c: sum(1 for r in hits if r.caller_kind == c) for c in CALLERS},
                    last_touched=max((r.at for r in hits), default=None),
                    signals=self._line_signals(line),
                )
            )
        return Usage(
            total=len(self.scope_rows),
            too_few=self.total < TOO_FEW,
            callers={c: sum(1 for r in self.scope_rows if r.caller_kind == c) for c in CALLERS},
            rows=rows,
            stitches=[] if self.f.one else self._stitches(),
            properties=self._properties() if self.f.one and explains else [],
            explains=explains,
        )

    def _stitches(self) -> list[StitchUse]:
        """A query crossed a stitch when it touched its edge type and both end types (MP41)."""
        out = []
        for link, source, target in self.f.stitches:
            edge = link.edge_type or "SAME_AS"
            crossed = [
                r
                for r in self.f.rows
                if touched(r, ("edge", edge))
                and touched(r, ("node", link.source_type))
                and touched(r, ("node", link.target_type))
            ]
            pair = (
                f"{source}.{link.source_type} ≡ {target}.{link.target_type}"
                if link.kind == "anchor"
                else f"{source}.{link.source_type} -[{edge}]-> {link.target_type}"
            )
            out.append(
                StitchUse(
                    id=link.id,
                    pair=pair,
                    kind=link.kind,
                    queries=len(crossed),
                    share=round(len(crossed) / self.total, 4) if self.total else 0.0,
                    last_crossed=max((r.at for r in crossed), default=None),
                )
            )
        return sorted(out, key=lambda s: -s.queries)

    def _properties(self) -> list[PropertyUse]:
        counts: dict[str, Counter[str]] = {k: Counter() for k in ("filtered", "returned", "ordered")}
        for r in self.scope_rows:
            touched_props = r.properties_touched or {}
            for k, counter in counts.items():
                counter.update(touched_props.get(k, []))
        out = []
        for type_name, props in self.f.properties.items():
            for prop in props:
                key = f"{type_name}.{prop}"
                f_, r_, o_ = counts["filtered"][key], counts["returned"][key], counts["ordered"][key]
                out.append(
                    PropertyUse(
                        type=type_name,
                        property=prop,
                        filtered=f_,
                        returned=r_,
                        ordered=o_,
                        cold=self.total >= TOO_FEW and not (f_ or r_ or o_),
                    )
                )
        return sorted(out, key=lambda p: (p.type, -(p.filtered + p.returned + p.ordered), p.property))

    def performance(self) -> Performance:
        by_shape: dict[str, list[GraphQueryLog]] = defaultdict(list)
        for r in self.scope_rows:
            by_shape[r.shape_hash].append(r)
        shapes = []
        for shape_hash, calls in by_shape.items():
            p95 = _p(calls, 0.95)
            callers = Counter(r.caller_kind for r in calls)
            types = sorted(
                {t for r in calls for t in (r.types_touched or {}).get("nodes", [])}
                | {t for r in calls for t in (r.types_touched or {}).get("edges", [])}
            )
            shapes.append(
                (
                    sum(r.duration_ms for r in calls),
                    ShapeRow(
                        hash=shape_hash,
                        text=calls[-1].shape_text,
                        callers=[c for c, _ in callers.most_common()],
                        calls=len(calls),
                        p50=_p(calls, 0.5),
                        p95=p95,
                        rows=percentile([float(r.rows) for r in calls], 0.5),
                        types=types,
                        touched_from="plan" if any(r.touched_from == "plan" for r in calls) else "results",
                        has_advice=bool(self.scanned_without_index(calls)),
                    ),
                )
            )
        shapes.sort(key=lambda s: -s[0])
        slow = sum(1 for _, s in shapes if s.p95 is not None and self.graph_p95 is not None and s.p95 >= self.graph_p95)
        return Performance(
            total=len(self.scope_rows),
            p50=_p(self.scope_rows, 0.5),
            p95=_p(self.scope_rows, 0.95),
            errors=sum(1 for r in self.scope_rows if not r.ok),
            slow_shapes=slow,
            p95_by_day=self._p95_by_day(),
            shapes=[s for _, s in shapes[:_SHAPES_SHOWN]],
        )
