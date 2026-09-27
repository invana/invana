"""Count every type, after an act that wrote data (the-model-page.md MP14 · MP30 · MP31).

Introspection, the end of an import run and a stitch commit call ``take``. It
counts once through ``count-types``, adds each node label's degree where the
act asked for it, and writes one row per type — all at the same moment, so a
mark on the Growth line is one point, not a smear.

It never raises. The act it follows has already happened; a count that fails
is logged and dropped, because a missing point is truer than a failed import.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Literal

from invana.apps.modeller.models import TypeCountSnapshot
from invana.apps.modeller.querysets.type_count_snapshot import TypeCountSnapshotQuerySet

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.graph.connectors.base.connector import BaseConnector

logger = logging.getLogger(__name__)

Source = Literal["introspect", "import", "stitch_commit"]


def degree_stats(histogram: dict[int, int]) -> tuple[int | None, int | None]:
    """``(max, median)`` of a ``{degree: nodes}`` histogram (MP31)."""
    total = sum(histogram.values())
    if not total:
        return None, None
    seen, median = 0, None
    for degree in sorted(histogram):
        seen += histogram[degree]
        if seen * 2 >= total:
            median = degree
            break
    return max(histogram), median


class CountSnapshotManager:
    def __init__(self) -> None:
        self._snapshots = TypeCountSnapshotQuerySet()

    async def take(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        connector: BaseConnector,
        source: Source,
        source_id: str | None,
        degrees: bool,
    ) -> int:
        """Snapshot every type; returns how many rows were written, 0 when it could not count."""
        try:
            nodes, edges = await connector.schema_reader.count_types()
            if nodes is None and edges is None:
                return 0
            at = datetime.now(UTC)
            rows: list[TypeCountSnapshot] = []
            for name, count in (nodes or {}).items():
                max_degree = median_degree = None
                if degrees:
                    histogram = await connector.schema_reader.get_degree_histogram(name)
                    if histogram is not None:
                        max_degree, median_degree = degree_stats(histogram)
                rows.append(
                    TypeCountSnapshot(
                        graph_id=graph_id,
                        at=at,
                        source=source,
                        source_id=source_id,
                        kind="node",
                        type_name=name,
                        count=count,
                        max_degree=max_degree,
                        median_degree=median_degree,
                    )
                )
            for name, count in (edges or {}).items():
                rows.append(
                    TypeCountSnapshot(
                        graph_id=graph_id,
                        at=at,
                        source=source,
                        source_id=source_id,
                        kind="edge",
                        type_name=name,
                        count=count,
                    )
                )
            # A savepoint, so a failed write never poisons the act's own transaction.
            async with session.begin_nested():
                await self._snapshots.add_many(session, rows)
            return len(rows)
        except Exception:
            logger.warning("Count snapshot after %s %s was not taken", source, source_id, exc_info=True)
            return 0
