"""Queries against ``datasets``, ``dataset_versions``, ``dataset_records``, ``dataset_bindings``,
``dataset_standards`` and ``dataset_conformance``.

A queryset answers *which rows*, never *whether* — visibility is passed in as
the caller's id, and what a caller may do with a row is the manager's rule.
"""

from __future__ import annotations

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.models import (
    Dataset,
    DatasetBinding,
    DatasetConformance,
    DatasetRecord,
    DatasetStandard,
    DatasetVersion,
    Visibility,
)


class DatasetQuerySet:
    async def get(self, session: AsyncSession, dataset_id: str) -> Dataset | None:
        return await session.get(Dataset, dataset_id)

    async def get_by_address(self, session: AsyncSession, *, publisher: str, name: str) -> Dataset | None:
        stmt = select(Dataset).where(Dataset.publisher == publisher, Dataset.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def readable(
        self,
        session: AsyncSession,
        *,
        reader_id: str | None,
        everything: bool = False,
        origin: str | None = None,
        publisher: str | None = None,
        bound_in_graph_id: str | None = None,
        text: str | None = None,
    ) -> list[Dataset]:
        """Install datasets and the reader's own, newest first. ``everything`` drops the visibility filter."""
        stmt = select(Dataset)
        if not everything:
            stmt = stmt.where(or_(Dataset.visibility == Visibility.install.value, Dataset.created_by_id == reader_id))
        if origin:
            stmt = stmt.where(Dataset.origin == origin)
        if publisher:
            stmt = stmt.where(Dataset.publisher == publisher)
        if text:
            like = f"%{text.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Dataset.name).like(like),
                    func.lower(Dataset.title).like(like),
                    func.lower(Dataset.description).like(like),
                )
            )
        if bound_in_graph_id:
            bound = select(DatasetBinding.dataset_id).where(DatasetBinding.graph_id == bound_in_graph_id)
            stmt = stmt.where(Dataset.id.in_(bound))
        stmt = stmt.order_by(Dataset.updated_at.desc(), Dataset.id)
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, dataset: Dataset) -> Dataset:
        session.add(dataset)
        await session.flush()
        return dataset


class DatasetVersionQuerySet:
    async def get(self, session: AsyncSession, version_id: str) -> DatasetVersion | None:
        return await session.get(DatasetVersion, version_id)

    async def by_ids(self, session: AsyncSession, version_ids: list[str]) -> list[DatasetVersion]:
        if not version_ids:
            return []
        stmt = select(DatasetVersion).where(DatasetVersion.id.in_(version_ids))
        return list((await session.execute(stmt)).scalars().all())

    async def get_by_number(self, session: AsyncSession, dataset_id: str, version: int) -> DatasetVersion | None:
        stmt = select(DatasetVersion).where(DatasetVersion.dataset_id == dataset_id, DatasetVersion.version == version)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_for_dataset(self, session: AsyncSession, dataset_id: str) -> list[DatasetVersion]:
        """Newest first."""
        stmt = (
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.version.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def highest_version(self, session: AsyncSession, dataset_id: str) -> int:
        stmt = select(func.max(DatasetVersion.version)).where(DatasetVersion.dataset_id == dataset_id)
        return (await session.execute(stmt)).scalar_one_or_none() or 0

    async def with_inputs(self, session: AsyncSession) -> list[DatasetVersion]:
        """Every version that names an input — few, and read whole because JSON
        containment is not portable across the two databases; ``json_array_length``
        is, on both."""
        stmt = select(DatasetVersion).where(func.json_array_length(DatasetVersion.derived_from) > 0)
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, version: DatasetVersion) -> DatasetVersion:
        session.add(version)
        await session.flush()
        return version


class DatasetRecordQuerySet:
    async def add_all(self, session: AsyncSession, records: list[DatasetRecord]) -> None:
        session.add_all(records)
        await session.flush()

    @staticmethod
    def _where(version_id: str, provenance: bool):
        clauses = [DatasetRecord.version_id == version_id]
        if provenance:
            # A record that inherits holds SQL NULL or JSON ``null``; text is portable across both databases.
            clauses.append(func.coalesce(cast(DatasetRecord.provenance, String), "null") != "null")
        return clauses

    async def page(
        self, session: AsyncSession, *, version_id: str, offset: int, limit: int, provenance: bool = False
    ) -> list[DatasetRecord]:
        """Ordered by key; *provenance* keeps only records with their own provenance."""
        stmt = (
            select(DatasetRecord)
            .where(*self._where(version_id, provenance))
            .order_by(DatasetRecord.key)
            .offset(offset)
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def count_with_provenance(self, session: AsyncSession, *, version_id: str) -> int:
        stmt = select(func.count()).select_from(DatasetRecord).where(*self._where(version_id, True))
        return (await session.execute(stmt)).scalar_one()

    async def all_for_version(self, session: AsyncSession, version_id: str) -> list[DatasetRecord]:
        stmt = select(DatasetRecord).where(DatasetRecord.version_id == version_id).order_by(DatasetRecord.key)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, *, version_id: str, key: str) -> DatasetRecord | None:
        stmt = select(DatasetRecord).where(DatasetRecord.version_id == version_id, DatasetRecord.key == key)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def by_version_for_key(self, session: AsyncSession, *, version_ids: list[str], key: str) -> dict:
        """``version_id`` → the record with *key* in it, for the versions that have one."""
        if not version_ids:
            return {}
        stmt = select(DatasetRecord).where(DatasetRecord.version_id.in_(version_ids), DatasetRecord.key == key)
        return {r.version_id: r for r in (await session.execute(stmt)).scalars().all()}


class DatasetBindingQuerySet:
    async def for_version(self, session: AsyncSession, version_id: str) -> list[DatasetBinding]:
        stmt = (
            select(DatasetBinding)
            .where(DatasetBinding.dataset_version_id == version_id)
            .order_by(DatasetBinding.bound_at.desc(), DatasetBinding.id)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def for_graph(self, session: AsyncSession, graph_id: str) -> list[DatasetBinding]:
        stmt = (
            select(DatasetBinding)
            .where(DatasetBinding.graph_id == graph_id)
            .order_by(DatasetBinding.bound_at.desc(), DatasetBinding.id)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get_target(
        self, session: AsyncSession, *, graph_id: str, model_id: str, dataset_id: str, type_name: str
    ) -> DatasetBinding | None:
        stmt = select(DatasetBinding).where(
            DatasetBinding.graph_id == graph_id,
            DatasetBinding.model_id == model_id,
            DatasetBinding.dataset_id == dataset_id,
            DatasetBinding.type_name == type_name,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, binding: DatasetBinding) -> DatasetBinding:
        session.add(binding)
        await session.flush()
        return binding


class DatasetStandardQuerySet:
    async def for_dataset(self, session: AsyncSession, dataset_id: str) -> list[DatasetStandard]:
        stmt = (
            select(DatasetStandard)
            .where(DatasetStandard.dataset_id == dataset_id)
            .order_by(DatasetStandard.attached_at, DatasetStandard.id)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get_pair(self, session: AsyncSession, *, dataset_id: str, standard_id: str) -> DatasetStandard | None:
        stmt = select(DatasetStandard).where(
            DatasetStandard.dataset_id == dataset_id, DatasetStandard.standard_id == standard_id
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, row: DatasetStandard) -> DatasetStandard:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: DatasetStandard) -> None:
        await session.delete(row)
        await session.flush()


class DatasetConformanceQuerySet:
    async def get_pair(
        self, session: AsyncSession, *, dataset_version_id: str, standard_version_id: str
    ) -> DatasetConformance | None:
        stmt = select(DatasetConformance).where(
            DatasetConformance.dataset_version_id == dataset_version_id,
            DatasetConformance.standard_version_id == standard_version_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, row: DatasetConformance) -> DatasetConformance:
        session.add(row)
        await session.flush()
        return row
