"""A dataset's standards — claim one, score every version against it, enforce the mode.

The Python API for a dataset's side of
docs/for-developers/modules/bring-data-in/features/standards.md. A dataset
**claims** a standard by attaching one pinned version with a ``term → column``
mapping and a mode; every version of the dataset is then scored against it,
and the score is stored — derived, so it is recomputed in place when the
mapping moves, never versioned.

**The mode is the attachment's.** ``gate`` scores a version's records before it
is written: a ``block`` claim it breaks refuses the version (409, naming the
standard and the first violations); ``warn`` and ``report`` let it through and
``record`` stores their scores. ``warnings`` reads back what a ``warn`` claim
says about a version, which is what the act that minted it returns.

Who attaches: the dataset's owner or an install Admin — the same who mints its
versions.

Usage::

    claims = ConformanceManager()
    await claims.attach(session, dataset=ds, payload=DatasetStandardCreate(standard="admin/iso-3166"), actor=user)
    await claims.conformance(session, dataset=ds, version=v2)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.content import Row
from invana.apps.datasets.models import Dataset, DatasetConformance, DatasetStandard, DatasetVersion
from invana.apps.datasets.querysets import (
    DatasetConformanceQuerySet,
    DatasetRecordQuerySet,
    DatasetStandardQuerySet,
    DatasetVersionQuerySet,
)
from invana.apps.datasets.schemas import (
    ConformanceRead,
    DatasetStandardCreate,
    DatasetStandardRead,
    Violation,
)
from invana.apps.standards.managers import StandardManager
from invana.apps.standards.models import Enforcement, Standard, StandardVersion
from invana.apps.standards.terms import Score, first_violations, score
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event


class ConformanceManager:
    """Stateless. The session is the first argument of every method."""

    claims_qs = DatasetStandardQuerySet()
    scores_qs = DatasetConformanceQuerySet()
    versions_qs = DatasetVersionQuerySet()
    records_qs = DatasetRecordQuerySet()
    standards = StandardManager()

    # ── reading ──────────────────────────────────────────────────────────────

    async def attachments(self, session: AsyncSession, *, dataset: Dataset) -> list[DatasetStandard]:
        return await self.claims_qs.for_dataset(session, dataset.id)

    async def _pinned(self, session: AsyncSession, claim: DatasetStandard) -> tuple[Standard, StandardVersion]:
        found = await self.standards.by_version_id(session, claim.standard_version_id)
        if found is None:
            raise NotFoundError("The claimed standard version is gone.")
        return found

    async def read_attachment(
        self, session: AsyncSession, *, dataset: Dataset, claim: DatasetStandard
    ) -> DatasetStandardRead:
        standard, pinned = await self._pinned(session, claim)
        current = await self.standards.current(session, standard)
        version = await self._current_version(session, dataset)
        conformance = None
        if version is not None:
            row = await self.score_version(session, version=version, claim=claim, pinned=pinned)
            conformance = self._read(dataset, version, standard, pinned, claim, row)
        return DatasetStandardRead(
            standard=f"{standard.address}@{pinned.version}",
            version=pinned.version,
            newer_version=current.version if current is not None and current.version > pinned.version else None,
            mode=claim.mode,
            mapping=dict(claim.mapping or {}),
            attached_by_id=claim.attached_by_id,
            attached_at=claim.attached_at,
            conformance=conformance,
        )

    async def conformance(
        self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion
    ) -> list[ConformanceRead]:
        """One score per standard the dataset claims, for one of its versions."""
        out: list[ConformanceRead] = []
        for claim in await self.attachments(session, dataset=dataset):
            standard, pinned = await self._pinned(session, claim)
            row = await self.score_version(session, version=version, claim=claim, pinned=pinned)
            out.append(self._read(dataset, version, standard, pinned, claim, row))
        return out

    async def claim_of(self, session: AsyncSession, *, dataset: Dataset, standard_id: str) -> DatasetStandard | None:
        return await self.claims_qs.get_pair(session, dataset_id=dataset.id, standard_id=standard_id)

    async def score_version(
        self,
        session: AsyncSession,
        *,
        version: DatasetVersion,
        claim: DatasetStandard,
        pinned: StandardVersion | None = None,
    ) -> DatasetConformance:
        """The stored score, computed now when missing or scored under another mapping."""
        if pinned is None:
            _, pinned = await self._pinned(session, claim)
        row = await self.scores_qs.get_pair(session, dataset_version_id=version.id, standard_version_id=pinned.id)
        mapping = dict(claim.mapping or {})
        if row is not None and dict(row.mapping or {}) == mapping:
            return row
        rows = [(r.key, r.values) for r in await self.records_qs.all_for_version(session, version.id)]
        return await self._store(
            session,
            version_id=version.id,
            pinned=pinned,
            mapping=mapping,
            result=score(pinned.terms, mapping, rows),
            row=row,
        )

    async def warnings(self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion) -> list[str]:
        """What each ``warn`` claim says about *version* — empty when it conforms."""
        out: list[str] = []
        for claim in await self.attachments(session, dataset=dataset):
            if claim.mode != Enforcement.warn:
                continue
            standard, pinned = await self._pinned(session, claim)
            row = await self.score_version(session, version=version, claim=claim, pinned=pinned)
            if row.violation_count:
                out.append(_line(standard, pinned, row.score, row.violation_count, row.violations))
        return out

    # ── the gate a new version passes ────────────────────────────────────────

    async def gate(
        self, session: AsyncSession, *, dataset: Dataset, rows: list[Row]
    ) -> list[tuple[StandardVersion, dict[str, str], Score]]:
        """Score records about to become a version; refuse them if a ``block`` claim breaks."""
        scored: list[tuple[StandardVersion, dict[str, str], Score]] = []
        blocked: list[str] = []
        pairs = [(r.key, r.values) for r in rows]
        for claim in await self.attachments(session, dataset=dataset):
            standard, pinned = await self._pinned(session, claim)
            mapping = dict(claim.mapping or {})
            result = score(pinned.terms, mapping, pairs)
            if claim.mode == Enforcement.block and not result.conforms:
                blocked.append(_line(standard, pinned, result.score, result.violation_count, result.violations))
            scored.append((pinned, mapping, result))
        if blocked:
            raise ConflictError("blocked — " + "; ".join(blocked))
        return scored

    async def record(
        self,
        session: AsyncSession,
        *,
        version: DatasetVersion,
        scored: list[tuple[StandardVersion, dict[str, str], Score]],
    ) -> None:
        for pinned, mapping, result in scored:
            await self._store(session, version_id=version.id, pinned=pinned, mapping=mapping, result=result, row=None)

    # ── writing ──────────────────────────────────────────────────────────────

    async def attach(
        self, session: AsyncSession, *, dataset: Dataset, payload: DatasetStandardCreate, actor: User
    ) -> DatasetStandard:
        """Claim a standard version — or move the claim's version, mapping or mode."""
        _require_owner(dataset, actor)
        standard, pinned = await self.standards.get_by_ref(session, ref=payload.standard)
        names = [t["name"] for t in pinned.terms]
        unknown = sorted(set(payload.mapping or {}) - set(names))
        if unknown:
            raise ValidationError(f"{standard.address}@{pinned.version} has no term {', '.join(unknown)}.")
        mapping = {name: name for name in names} | dict(payload.mapping or {})

        version = await self._current_version(session, dataset)
        row: DatasetConformance | None = None
        if version is not None:
            rows = [(r.key, r.values) for r in await self.records_qs.all_for_version(session, version.id)]
            result = score(pinned.terms, mapping, rows)
            if payload.mode == Enforcement.block and not result.conforms:
                raise ConflictError(
                    f"{dataset.address}@{version.version} does not conform — "
                    f"{_line(standard, pinned, result.score, result.violation_count, result.violations)}. "
                    "Attach as warn, fix it, then block."
                )
            existing = await self.scores_qs.get_pair(
                session, dataset_version_id=version.id, standard_version_id=pinned.id
            )
            row = await self._store(
                session, version_id=version.id, pinned=pinned, mapping=mapping, result=result, row=existing
            )

        claim = await self.claims_qs.get_pair(session, dataset_id=dataset.id, standard_id=standard.id)
        fields = {
            "standard_version_id": pinned.id,
            "mode": payload.mode.value,
            "mapping": mapping,
            "attached_by_id": actor.id,
            "attached_at": datetime.now(UTC),
        }
        if claim is None:
            claim = await self.claims_qs.add(
                session, DatasetStandard(dataset_id=dataset.id, standard_id=standard.id, **fields)
            )
        else:
            for name, value in fields.items():
                setattr(claim, name, value)
            await session.flush()
        await emit_event(
            session,
            action=actions.DATASET_STANDARD_ATTACH,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={
                "address": dataset.address,
                "standard": f"{standard.address}@{pinned.version}",
                "mode": claim.mode,
                "score": row.score if row is not None else None,
            },
        )
        return claim

    async def detach(self, session: AsyncSession, *, dataset: Dataset, ref: str, actor: User) -> None:
        _require_owner(dataset, actor)
        standard, _ = await self.standards.get_by_ref(session, ref=ref.split("@", 1)[0])
        claim = await self.claims_qs.get_pair(session, dataset_id=dataset.id, standard_id=standard.id)
        if claim is None:
            raise NotFoundError(f"{dataset.address} does not claim {standard.address}.")
        await self.claims_qs.delete(session, claim)
        await emit_event(
            session,
            action=actions.DATASET_STANDARD_DETACH,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={"address": dataset.address, "standard": standard.address},
        )

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _current_version(self, session: AsyncSession, dataset: Dataset) -> DatasetVersion | None:
        if dataset.current_version_id is None:
            return None
        return await self.versions_qs.get(session, dataset.current_version_id)

    async def _store(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        pinned: StandardVersion,
        mapping: dict[str, str],
        result: Score,
        row: DatasetConformance | None,
    ) -> DatasetConformance:
        if row is None:
            row = await self.scores_qs.get_pair(session, dataset_version_id=version_id, standard_version_id=pinned.id)
        if row is None:
            row = await self.scores_qs.add(
                session, DatasetConformance(dataset_version_id=version_id, standard_version_id=pinned.id)
            )
        row.mapping = mapping
        row.record_count = result.record_count
        row.conforming = result.conforming
        row.score = result.score
        row.violation_count = result.violation_count
        row.violations = result.violations
        row.checked_at = datetime.now(UTC)
        await session.flush()
        return row

    @staticmethod
    def _read(
        dataset: Dataset,
        version: DatasetVersion,
        standard: Standard,
        pinned: StandardVersion,
        claim: DatasetStandard,
        row: DatasetConformance,
    ) -> ConformanceRead:
        return ConformanceRead(
            dataset=f"{dataset.address}@{version.version}",
            standard=f"{standard.address}@{pinned.version}",
            mode=claim.mode,
            record_count=row.record_count,
            conforming=row.conforming,
            score=row.score,
            conforms=row.violation_count == 0,
            violation_count=row.violation_count,
            violations=[Violation(**v) for v in row.violations or []],
            checked_at=row.checked_at,
        )


def _require_owner(dataset: Dataset, actor: User) -> None:
    if actor.is_superuser or dataset.created_by_id == actor.id:
        return
    raise PermissionDeniedError(f"Only the owner of {dataset.address} may change the standards it claims.")


def _line(standard: Standard, pinned: StandardVersion, value: float, count: int, violations: list[dict]) -> str:
    return (
        f"{standard.address}@{pinned.version} scores {value:.4g} with {count} violation(s): "
        f"{first_violations(violations)}"
    )
