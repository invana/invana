"""What a rule's check would have broken — the last 30 days read back through it
(docs/for-developers/modules/skills/features/rules.md).

A blocked act writes nothing, so what a rule *would* have stopped cannot be
counted from ``rule.check`` events; it is a **replay**. Each act a check kind is
read at is found again in the record, and the check is run against it as the
act saw it:

=====================  =====================================================  =================================
act                    found as                                               read against
=====================  =====================================================  =================================
``dataset.share``      a ``dataset.update`` event moving visibility to install  the version current at that moment
``dataset.bind``       a ``dataset.bind`` event                               the version it bound
``project.decide``     a ``project_decisions`` row                            its cited findings as they stood
=====================  =====================================================  =================================

A share has no Graph, so it is read for an install check only. A Graph's read
covers that Graph's binds and decisions; with no Graph it covers every Graph.

Usage::

    impact = RuleImpactManager()
    read = await impact.of_check(session, check={"kind": "evidence.reviewed"}, scope="graph", graph_id=g.id)
    counts = await impact.broken_counts(session, rules=rules, graph_id=g.id)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.models import Dataset, DatasetVersion, Visibility
from invana.apps.datasets.querysets import DatasetQuerySet, DatasetVersionQuerySet
from invana.apps.skills.checks import (
    ACT_DATASET_BIND,
    ACT_DATASET_SHARE,
    ACT_PROJECT_DECIDE,
    acts_of,
    normalise_check,
)
from invana.apps.skills.models import Rule
from invana.apps.skills.schemas import RuleImpact, RuleImpactItem
from invana.apps.work.managers import DecisionManager
from invana.core.events import actions
from invana.core.events.querysets import EventQuerySet
from invana.runtime.managers.rule_checks import RuleCheckManager

#: The window a rule's impact is read over.
WINDOW_DAYS = 30
#: The newest broken acts an impact names.
NAMED = 5


class _Acts:
    """The acts of one window, loaded once and read by every check."""

    def __init__(self) -> None:
        self.shares: list[tuple[datetime, Dataset, DatasetVersion]] = []
        self.binds: list[tuple[datetime, Dataset, DatasetVersion]] = []
        self.decisions: list[tuple[datetime, str, list, str | None]] = []


class RuleImpactManager:
    """Stateless. The session is the first argument of every method."""

    events_qs = EventQuerySet()
    datasets_qs = DatasetQuerySet()
    versions_qs = DatasetVersionQuerySet()
    decisions = DecisionManager()
    checks = RuleCheckManager()

    async def _load(self, session: AsyncSession, *, graph_id: str | None, shares: bool) -> _Acts:
        since = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)
        acts = _Acts()
        datasets: dict[str, Dataset | None] = {}

        async def dataset(dataset_id: str | None) -> Dataset | None:
            if not dataset_id:
                return None
            if dataset_id not in datasets:
                datasets[dataset_id] = await self.datasets_qs.get(session, dataset_id)
            return datasets[dataset_id]

        for event in await self.events_qs.since(
            session, actions=frozenset({actions.DATASET_BIND}), since=since, graph_id=graph_id
        ):
            ds = await dataset(event.target_id)
            version = await self.versions_qs.get(session, (event.details or {}).get("version_id") or "")
            if ds is not None and version is not None:
                acts.binds.append((event.created_at, ds, version))

        if shares:
            for event in await self.events_qs.since(session, actions=frozenset({actions.DATASET_UPDATE}), since=since):
                moved = ((event.details or {}).get("diff") or {}).get("visibility") or {}
                if moved.get("after") != Visibility.install.value:
                    continue
                ds = await dataset(event.target_id)
                if ds is None:
                    continue
                published = [
                    v
                    for v in await self.versions_qs.list_for_dataset(session, ds.id)
                    if v.state != "draft" and v.published_at <= event.created_at
                ]
                if published:
                    acts.shares.append((event.created_at, ds, max(published, key=lambda v: v.version)))

        for decision, project, cited in await self.decisions.decided_since(session, since=since, graph_id=graph_id):
            key = project.key if project is not None else "?"
            acts.decisions.append(
                (decision.created_at, f"{key}/d{decision.number}", cited, project.id if project else None)
            )
        return acts

    async def _read(
        self, session: AsyncSession, *, check: dict, acts: _Acts, shares: bool, project_id: str | None = None
    ) -> RuleImpact:
        """Run *check* over every act it is read at, newest broken first. ``shares`` reads the shares too."""
        read = 0
        broken: list[RuleImpactItem] = []
        named = acts_of(check.get("kind") or "")
        for act, rows in ((ACT_DATASET_SHARE, acts.shares), (ACT_DATASET_BIND, acts.binds)):
            if act not in named or (act == ACT_DATASET_SHARE and not shares):
                continue
            for at, ds, version in rows:
                read += 1
                reason = await self.checks.failure(session, check=check, dataset=ds, version=version)
                if reason is not None:
                    subject = f"{ds.address}@{version.version}"
                    broken.append(RuleImpactItem(act=act, subject=subject, at=at, reason=reason))
        if ACT_PROJECT_DECIDE in named:
            for at, subject, cited, decided_in in acts.decisions:
                if project_id is not None and decided_in != project_id:
                    continue
                read += 1
                reason = await self.decisions.failure(session, check=check, cited=cited, at=at)
                if reason is not None:
                    broken.append(RuleImpactItem(act=ACT_PROJECT_DECIDE, subject=subject, at=at, reason=reason))
        broken.sort(key=lambda i: i.at, reverse=True)
        return RuleImpact(days=WINDOW_DAYS, read=read, broken=len(broken), items=broken[:NAMED])

    async def of_check(
        self,
        session: AsyncSession,
        *,
        check: dict,
        scope: str,
        graph_id: str | None,
        project_id: str | None = None,
    ) -> RuleImpact:
        """What *check* would have broken at *scope* over the window — 422 when no act at *scope* reads it.

        ``graph_id`` ``None`` reads every Graph. A share is read for an install
        check only; a project check reads its project's decisions only.
        """
        check = normalise_check(check, scope=scope)
        shares = scope == "install"
        acts = await self._load(session, graph_id=graph_id, shares=shares)
        return await self._read(session, check=check, acts=acts, shares=shares, project_id=project_id)

    async def broken_counts(self, session: AsyncSession, *, rules: list[Rule], graph_id: str) -> dict[str, int]:
        """Each checked rule's broken count over the window, read in one Graph."""
        checked = [r for r in rules if r.check]
        if not checked:
            return {}
        acts = await self._load(session, graph_id=graph_id, shares=any(r.scope == "install" for r in checked))
        out: dict[str, int] = {}
        for rule in checked:
            impact = await self._read(
                session, check=rule.check or {}, acts=acts, shares=rule.scope == "install", project_id=rule.project_id
            )
            out[rule.id] = impact.broken
        return out
