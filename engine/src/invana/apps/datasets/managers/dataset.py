"""Datasets — create, version, share, label, read, retract, and a record's change log.

The Python API for the dataset record
(docs/for-developers/modules/bring-data-in/features/datasets.md). A dataset
belongs to no Graph, so every rule here is about **who may read** (an
``install`` dataset, or your own) and **who may write** (its creator, or an
install Admin until roles land). A private dataset someone else made reads as
absent, never forbidden; an install dataset you can already see answers a write
with 403.

**A version is immutable and is the content.** Creating a dataset mints
nothing; ``publish_version`` normalises the records, hashes them, refuses an
identical hash, and writes the version with its records in one act. Labels,
visibility and the refresh schedule are metadata — ``dataset.update``, never a
version.

**Retraction marks, never deletes, and flags are read.** Only an install Admin
retracts. ``used`` lists the bindings and derived versions that cite a version;
a version read names its retracted inputs and a binding read says whether its
version is retracted — nothing stores the flag twice. Bindings are listed only
in Graphs the reader belongs to: a dataset is install-wide, the Graphs that
bound it are not.

**A record's change log is read, not stored.** ``record_history`` walks the
versions oldest first and reports each one that changed the record, the same
way the change log reads versions rather than keeping a copy.

Usage::

    datasets = DatasetManager()
    ds = await datasets.create(session, payload=DatasetCreate(name="accessions", origin="official"), actor=user)
    v1 = await datasets.publish_version(session, dataset=ds, payload=DatasetVersionCreate(...), actor=user)
    await datasets.update(session, dataset=ds, payload=DatasetUpdate(visibility="install"), actor=user)
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.content import columns_of, content_hash, normalise, property_changes
from invana.apps.datasets.models import (
    AuthorKind,
    AuthorRole,
    Dataset,
    DatasetBinding,
    DatasetRecord,
    DatasetVersion,
    Origin,
    Sensitivity,
    Visibility,
)
from invana.apps.datasets.querysets import (
    DatasetBindingQuerySet,
    DatasetQuerySet,
    DatasetRecordQuerySet,
    DatasetVersionQuerySet,
)
from invana.apps.datasets.schemas import (
    DatasetBindingRead,
    DatasetCreate,
    DatasetRead,
    DatasetRecordPage,
    DatasetRecordRead,
    DatasetUpdate,
    DatasetVersionCreate,
    DatasetVersionRead,
    DatasetVersionRef,
    DatasetVersionUsage,
    PropertyChange,
    RecordChange,
    RecordChangeLog,
    Retraction,
)
from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.modeller.querysets import GraphModelQuerySet
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

_REF = re.compile(r"^(?P<publisher>[a-z0-9][a-z0-9-]{0,62})/(?P<name>[a-z0-9][a-z0-9-]{0,62})(?:@(?P<version>\d+))?$")
_CRON_FIELD = re.compile(r"^[\d*/,\-]+$")


def parse_ref(ref: str) -> tuple[str, str, int | None]:
    """``publisher/name[@v]`` → its parts; anything else is a ValidationError."""
    match = _REF.match(ref.strip())
    if match is None:
        raise ValidationError(f"{ref!r} is not a dataset address — expected publisher/name or publisher/name@v.")
    version = match.group("version")
    return match.group("publisher"), match.group("name"), int(version) if version else None


def _valid_cron(expr: str) -> bool:
    fields = expr.split()
    return len(fields) == 5 and all(_CRON_FIELD.match(f) for f in fields)


class DatasetManager:
    """Stateless. The session is the first argument of every method."""

    datasets_qs = DatasetQuerySet()
    versions_qs = DatasetVersionQuerySet()
    records_qs = DatasetRecordQuerySet()
    bindings_qs = DatasetBindingQuerySet()
    graphs_qs = GraphQuerySet()
    models_qs = GraphModelQuerySet()

    # ── who may ──────────────────────────────────────────────────────────────

    @staticmethod
    def can_read(dataset: Dataset, reader: User | None) -> bool:
        if dataset.visibility == Visibility.install.value:
            return True
        return reader is not None and (reader.is_superuser or dataset.created_by_id == reader.id)

    @staticmethod
    def require_owner(dataset: Dataset, actor: User, act: str) -> None:
        if actor.is_superuser or dataset.created_by_id == actor.id:
            return
        raise PermissionDeniedError(f"Only the owner of {dataset.address} may {act}.")

    # ── reading ──────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, publisher: str, name: str, reader: User | None) -> Dataset:
        """A dataset the reader may not see reads as absent."""
        dataset = await self.datasets_qs.get_by_address(session, publisher=publisher, name=name)
        if dataset is None or not self.can_read(dataset, reader):
            raise NotFoundError(f"Dataset {publisher}/{name} not found.")
        return dataset

    async def get_by_ref(self, session: AsyncSession, *, ref: str, reader: User | None) -> tuple[Dataset, int | None]:
        publisher, name, version = parse_ref(ref)
        return await self.get(session, publisher=publisher, name=name, reader=reader), version

    async def catalogue(
        self,
        session: AsyncSession,
        *,
        reader: User,
        origin: str | None = None,
        publisher: str | None = None,
        bound_in: str | None = None,
        text: str | None = None,
    ) -> list[Dataset]:
        """Every dataset *reader* may read; ``bound_in`` is a Graph as ``<username>/<slug>``."""
        bound_in_graph_id = None
        if bound_in:
            username, _, slug = bound_in.partition("/")
            graph = await self.graphs_qs.get_by_owner_username_and_slug(session, owner_username=username, slug=slug)
            if graph is None:
                return []
            bound_in_graph_id = graph.id
        return await self.datasets_qs.readable(
            session,
            reader_id=reader.id,
            everything=reader.is_superuser,
            origin=origin,
            publisher=publisher,
            bound_in_graph_id=bound_in_graph_id,
            text=text,
        )

    async def current(self, session: AsyncSession, dataset: Dataset) -> DatasetVersion | None:
        if dataset.current_version_id is None:
            return None
        return await self.versions_qs.get(session, dataset.current_version_id)

    async def list_versions(self, session: AsyncSession, *, dataset: Dataset) -> list[DatasetVersion]:
        return await self.versions_qs.list_for_dataset(session, dataset.id)

    async def get_version(self, session: AsyncSession, *, dataset: Dataset, version: int) -> DatasetVersion:
        row = await self.versions_qs.get_by_number(session, dataset.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of {dataset.address} not found.")
        return row

    async def read(self, session: AsyncSession, dataset: Dataset) -> DatasetRead:
        current = await self.current(session, dataset)
        return DatasetRead(
            id=dataset.id,
            address=dataset.address,
            publisher=dataset.publisher,
            name=dataset.name,
            title=dataset.title,
            description=dataset.description,
            origin=dataset.origin,
            key_column=dataset.key_column,
            visibility=dataset.visibility,
            sensitivity=dataset.sensitivity,
            column_sensitivity=dict(dataset.column_sensitivity or {}),
            refresh_schedule=dataset.refresh_schedule,
            refresh_source=dataset.refresh_source,
            created_by_id=dataset.created_by_id,
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            current_version=current.version if current else None,
            licence=current.licence if current else None,
            author_chain=list(current.author_chain) if current else [],
            record_count=current.record_count if current else 0,
            content_hash=current.content_hash if current else None,
        )

    @staticmethod
    def retraction(version: DatasetVersion) -> Retraction | None:
        if version.retracted_at is None:
            return None
        return Retraction(at=version.retracted_at, by_id=version.retracted_by_id, reason=version.retraction_reason)

    async def read_version(self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion):
        """A version with its inputs named by address, not by id, and the retracted ones flagged."""
        inputs = await self.addresses(session, list(version.derived_from or []))
        retracted_inputs = [
            inputs.get(row.id, row.id)
            for row in await self.versions_qs.by_ids(session, list(version.derived_from or []))
            if row.retracted_at is not None
        ]
        return DatasetVersionRead(
            id=version.id,
            dataset_id=dataset.id,
            address=f"{dataset.address}@{version.version}",
            version=version.version,
            content_hash=version.content_hash,
            licence=version.licence,
            author_chain=list(version.author_chain or []),
            columns=list(version.columns or []),
            record_count=version.record_count,
            source=version.source,
            derived_from=[inputs.get(i, i) for i in version.derived_from or []],
            why=version.why,
            published_by_id=version.published_by_id,
            published_at=version.published_at,
            retracted=self.retraction(version),
            retracted_inputs=sorted(retracted_inputs),
        )

    async def addresses(self, session: AsyncSession, version_ids: list[str]) -> dict[str, str]:
        """``version_id`` → ``publisher/name@v``."""
        out: dict[str, str] = {}
        for version in await self.versions_qs.by_ids(session, version_ids):
            dataset = await self.datasets_qs.get(session, version.dataset_id)
            if dataset is not None:
                out[version.id] = f"{dataset.address}@{version.version}"
        return out

    async def read_binding(self, session: AsyncSession, binding: DatasetBinding) -> DatasetBindingRead:
        """A binding with its version's retraction and the dataset's newer version, both read now."""
        version = await self.versions_qs.get(session, binding.dataset_version_id)
        dataset = await self.datasets_qs.get(session, binding.dataset_id)
        model = await self.models_qs.get_graph_model(session, binding.model_id)
        current = await self.current(session, dataset) if dataset is not None else None
        newer = current.version if current is not None and current.version > version.version else None
        return DatasetBindingRead(
            id=binding.id,
            graph_id=binding.graph_id,
            model_id=binding.model_id,
            model_name=model.name if model is not None else None,
            type_name=binding.type_name,
            address=f"{dataset.address}@{version.version}",
            version=version.version,
            run_id=binding.run_id,
            bound_by_id=binding.bound_by_id,
            bound_at=binding.bound_at,
            retracted=self.retraction(version),
            newer_version=newer,
        )

    async def used(
        self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion, reader: User
    ) -> DatasetVersionUsage:
        """The bindings of one version, in Graphs the reader belongs to, and
        the versions derived from it that the reader may read."""
        bindings = await self.bindings_qs.for_version(session, version.id)
        if not reader.is_superuser:
            mine = {g.id for g in await self.graphs_qs.member_of(session, user_id=reader.id, include_archived=True)}
            bindings = [b for b in bindings if b.graph_id in mine]
        derived: list[DatasetVersionRef] = []
        for row in await self.versions_qs.with_inputs(session):
            if version.id not in (row.derived_from or []):
                continue
            source = await self.datasets_qs.get(session, row.dataset_id)
            if source is not None and self.can_read(source, reader):
                derived.append(
                    DatasetVersionRef(
                        address=f"{source.address}@{row.version}", version_id=row.id, dataset_id=source.id
                    )
                )
        return DatasetVersionUsage(
            address=f"{dataset.address}@{version.version}",
            retracted=self.retraction(version),
            bindings=[await self.read_binding(session, b) for b in bindings],
            derived=sorted(derived, key=lambda r: r.address),
        )

    # ── records ──────────────────────────────────────────────────────────────

    async def records_page(
        self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion, offset: int, limit: int
    ) -> DatasetRecordPage:
        rows = await self.records_qs.page(session, version_id=version.id, offset=offset, limit=limit)
        return DatasetRecordPage(
            address=f"{dataset.address}@{version.version}",
            items=[
                DatasetRecordRead(key=r.key, version=version.version, values=r.values, provenance=r.provenance)
                for r in rows
            ],
            total=version.record_count,
            offset=offset,
            limit=limit,
        )

    async def record(
        self, session: AsyncSession, *, dataset: Dataset, key: str, version: int | None = None
    ) -> DatasetRecordRead:
        row_version = (
            await self.get_version(session, dataset=dataset, version=version)
            if version is not None
            else await self.current(session, dataset)
        )
        row = await self.records_qs.get(session, version_id=row_version.id, key=key) if row_version else None
        if row is None:
            raise NotFoundError(f"No record {key!r} in {dataset.address}.")
        return DatasetRecordRead(key=row.key, version=row_version.version, values=row.values, provenance=row.provenance)

    async def record_history(self, session: AsyncSession, *, dataset: Dataset, key: str) -> RecordChangeLog:
        """Every version that added, changed or removed one record, newest first."""
        versions = sorted(await self.list_versions(session, dataset=dataset), key=lambda v: v.version)
        found = await self.records_qs.by_version_for_key(session, version_ids=[v.id for v in versions], key=key)
        if not found:
            raise NotFoundError(f"No record {key!r} in any version of {dataset.address}.")
        items: list[RecordChange] = []
        previous: DatasetRecord | None = None
        for version in versions:
            row = found.get(version.id)
            kind: str | None = None
            changes: list[dict[str, Any]] = []
            if row is not None and previous is None:
                kind, changes = "added", property_changes(None, row.values)
            elif row is None and previous is not None:
                kind, changes = "removed", property_changes(previous.values, None)
            elif row is not None and previous is not None:
                changes = property_changes(previous.values, row.values)
                if row.provenance != previous.provenance:
                    changes.append({"property": "_provenance", "before": previous.provenance, "after": row.provenance})
                kind = "changed" if changes else None
            if kind is not None:
                items.append(
                    RecordChange(
                        version=version.version,
                        at=version.published_at,
                        actor_id=version.published_by_id,
                        why=version.why,
                        kind=kind,
                        properties=[PropertyChange(**c) for c in changes],
                    )
                )
            previous = row
        items.reverse()
        return RecordChangeLog(address=dataset.address, key=key, items=items)

    # ── writing ──────────────────────────────────────────────────────────────

    def _check_columns(self, sensitivity: str, columns: dict[str, Any]) -> dict[str, str]:
        floor = Sensitivity(sensitivity)
        out: dict[str, str] = {}
        for column, raw in columns.items():
            label = Sensitivity(raw)
            if label.rank < floor.rank:
                raise ValidationError(
                    f"Column {column!r} is labelled {label.value}, looser than the dataset's {floor.value}."
                )
            out[column] = label.value
        return out

    async def create(self, session: AsyncSession, *, payload: DatasetCreate, actor: User) -> Dataset:
        """The dataset with no version — the first import is v1."""
        publisher = payload.publisher or actor.username.lower()
        if await self.datasets_qs.get_by_address(session, publisher=publisher, name=payload.name) is not None:
            raise ConflictError(f"{publisher}/{payload.name} already exists.")
        dataset = Dataset(
            publisher=publisher,
            name=payload.name,
            title=payload.title or payload.name,
            description=payload.description,
            origin=payload.origin.value,
            key_column=payload.key_column,
            visibility=Visibility.private.value,
            sensitivity=payload.sensitivity.value,
            column_sensitivity=self._check_columns(payload.sensitivity.value, payload.column_sensitivity),
            created_by_id=actor.id,
        )
        await self.datasets_qs.add(session, dataset)
        await emit_event(
            session,
            action=actions.DATASET_CREATE,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={"address": dataset.address, "origin": dataset.origin},
        )
        return dataset

    async def update(self, session: AsyncSession, *, dataset: Dataset, payload: DatasetUpdate, actor: User) -> Dataset:
        """Metadata only: title, description, sharing, labels, the refresh schedule."""
        self.require_owner(dataset, actor, "change it")
        wanted = payload.model_dump(exclude_unset=True)
        if wanted.get("visibility") == Visibility.install and dataset.current_version_id is None:
            raise ConflictError(f"{dataset.address} has no version yet — share it once a licensed version exists.")
        sensitivity = wanted.get("sensitivity", dataset.sensitivity)
        columns = wanted.get("column_sensitivity", dataset.column_sensitivity or {})
        wanted["column_sensitivity"] = self._check_columns(Sensitivity(sensitivity).value, columns or {})
        if "refresh_schedule" in wanted or "refresh_source" in wanted:
            schedule = (wanted.get("refresh_schedule", dataset.refresh_schedule) or "").strip() or None
            source = (wanted.get("refresh_source", dataset.refresh_source) or "").strip() or None
            if schedule is not None and not _valid_cron(schedule):
                raise ValidationError(f"{schedule!r} is not a 5-field cron.")
            if schedule is not None and source is None:
                raise ValidationError("A refresh schedule needs a source to read.")
            wanted["refresh_schedule"], wanted["refresh_source"] = schedule, source

        diff: dict[str, dict[str, Any]] = {}
        for field, wanted_value in wanted.items():
            value = wanted_value.value if hasattr(wanted_value, "value") else wanted_value
            before = getattr(dataset, field)
            if before != value:
                diff[field] = {"before": before, "after": value}
                setattr(dataset, field, value)
        if not diff:
            return dataset
        await session.flush()
        await emit_event(
            session,
            action=actions.DATASET_UPDATE,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={"address": dataset.address, "changed": sorted(diff), "diff": diff},
        )
        return dataset

    async def _inputs(self, session: AsyncSession, refs: list[str], reader: User) -> list[str]:
        ids: list[str] = []
        for ref in refs:
            source, version = await self.get_by_ref(session, ref=ref, reader=reader)
            if version is None:
                raise ValidationError(f"Input {ref!r} names no version — derive from publisher/name@v.")
            row = await self.get_version(session, dataset=source, version=version)
            if row.retracted_at is not None:
                raise ValidationError(f"Input {ref} is retracted and cannot be derived from.")
            ids.append(row.id)
        return ids

    def _chain(self, dataset: Dataset, payload: DatasetVersionCreate, actor: User) -> list[dict[str, Any]]:
        chain = [step.model_dump(mode="json", exclude_none=True) for step in payload.author_chain]
        if any(step["role"] == AuthorRole.original.value for step in chain):
            return chain
        if dataset.origin == Origin.observed.value:
            person = {"role": AuthorRole.original.value, "kind": AuthorKind.person.value, "name": actor.username}
            return [person, *chain]
        raise ValidationError("The author chain needs at least one original author.")

    async def publish_version(
        self, session: AsyncSession, *, dataset: Dataset, payload: DatasetVersionCreate, actor: User
    ) -> DatasetVersion:
        """Mint the next version from its records — refused when nothing changed."""
        self.require_owner(dataset, actor, "add a version")
        rows = normalise(payload.records, key_column=dataset.key_column)
        digest = content_hash(rows)
        chain = self._chain(dataset, payload, actor)
        inputs = await self._inputs(session, payload.derived_from, actor)
        if dataset.origin == Origin.derived.value and not inputs:
            raise ValidationError("A derived dataset names at least one input version in derived_from.")
        current = await self.current(session, dataset)
        if current is not None and current.content_hash == digest:
            raise ConflictError(f"unchanged — the records match {dataset.address}@{current.version}.")

        number = await self.versions_qs.highest_version(session, dataset.id) + 1
        version = DatasetVersion(
            dataset_id=dataset.id,
            version=number,
            content_hash=digest,
            licence=payload.licence,
            author_chain=chain,
            columns=columns_of(rows),
            record_count=len(rows),
            source=payload.source,
            derived_from=inputs,
            why=payload.why,
            published_by_id=actor.id,
        )
        await self.versions_qs.add(session, version)
        await self.records_qs.add_all(
            session,
            [DatasetRecord(version_id=version.id, key=r.key, values=r.values, provenance=r.provenance) for r in rows],
        )
        dataset.current_version_id = version.id
        await session.flush()
        await emit_event(
            session,
            action=actions.DATASET_VERSION,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={
                "address": dataset.address,
                "version": number,
                "content_hash": digest,
                "record_count": len(rows),
                "why": payload.why,
            },
        )
        return version

    async def retract(
        self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion, reason: str, actor: User
    ) -> DatasetVersion:
        """Mark a version withdrawn — an install Admin's act, never undone.

        Not a version and not a move: the current version stays current until
        its owner mints a newer one.
        """
        if not actor.is_superuser:
            raise PermissionDeniedError("Only an install Admin retracts a dataset version.")
        if version.retracted_at is not None:
            raise ConflictError(f"{dataset.address}@{version.version} is already retracted.")
        reason = reason.strip()
        if not reason:
            raise ValidationError("A retraction needs a reason.")
        version.retracted_at = datetime.now(UTC)
        version.retracted_by_id = actor.id
        version.retraction_reason = reason
        await session.flush()
        await emit_event(
            session,
            action=actions.DATASET_RETRACT,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            actor_id=actor.id,
            details={"address": dataset.address, "version": version.version, "reason": reason},
        )
        return version

    async def refresh(
        self, session: AsyncSession, *, dataset: Dataset, records: list[dict[str, Any]], actor: User
    ) -> DatasetVersion | None:
        """One firing of the refresh schedule, over the records its source held.

        An import like any other — the current version's licence and author
        chain, ``why = "scheduled refresh"`` — and ``None`` when the content is
        unchanged, which is a normal outcome of a firing, not an error.
        """
        current = await self.current(session, dataset)
        if current is None:
            raise ValidationError(f"{dataset.address} has no version to refresh — import its first one.")
        if content_hash(normalise(records, key_column=dataset.key_column)) == current.content_hash:
            return None
        payload = DatasetVersionCreate(
            licence=current.licence,
            author_chain=list(current.author_chain or []),
            records=records,
            source=dataset.refresh_source,
            derived_from=list((await self.addresses(session, list(current.derived_from or []))).values()),
            why="scheduled refresh",
        )
        return await self.publish_version(session, dataset=dataset, payload=payload, actor=actor)
