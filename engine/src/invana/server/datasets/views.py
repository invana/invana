"""HTTP handlers for datasets — install-wide, so no Graph in the path.

Parse, call ``DatasetManager``, serialise. Who may read and who may write is
the manager's: a private dataset of someone else reads as absent, a write on
one you can only read is 403. A dataset's history and compare are the change
log's, read by ``ChangeLogManager`` once ``DatasetManager`` has let the caller
read the dataset.

A binding is the one Graph-scoped act: ``bind`` opens the load in the request's
transaction, commits, and submits the run to the runtime.

Sharing and binding read the checked rules (``RuleCheckManager``); a rule that
warns comes back in the response's ``warnings``, and so does a standard the
dataset claims with ``warn`` when a new version breaks it.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ChangeLogManager
from invana.activity.schemas import ChangeCompare, RecordHistory
from invana.apps.datasets.managers import ClaimsManager, ConformanceManager, DatasetManager
from invana.apps.datasets.schemas import (
    ConformanceListResponse,
    DatasetBindingCreate,
    DatasetBindingListResponse,
    DatasetBindingRead,
    DatasetClaimListResponse,
    DatasetCreate,
    DatasetListResponse,
    DatasetRead,
    DatasetRecordPage,
    DatasetRecordRead,
    DatasetRetract,
    DatasetStandardCreate,
    DatasetStandardListResponse,
    DatasetStandardRead,
    DatasetUpdate,
    DatasetVersionCreate,
    DatasetVersionListResponse,
    DatasetVersionRead,
    DatasetVersionUsage,
    RecordChangeLog,
    ValidationQueue,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.managers import DatasetBindManager, RuleCheckManager
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

datasets = DatasetManager()
changes = ChangeLogManager()
binds = DatasetBindManager()
claims = ConformanceManager()
install_claims = ClaimsManager()
checks = RuleCheckManager()


async def list_datasets(
    origin: str | None = Query(default=None),
    publisher: str | None = Query(default=None),
    bound_in: str | None = Query(default=None, description="A Graph as <username>/<slug>."),
    q: str | None = Query(default=None, description="Text in the name, title or description."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetListResponse:
    """The catalogue: every dataset the caller may read, newest first."""
    rows = await datasets.catalogue(session, reader=user, origin=origin, publisher=publisher, bound_in=bound_in, text=q)
    items = [await datasets.read(session, d) for d in rows]
    return DatasetListResponse(items=items, total=len(items))


async def list_claims(
    standard: str | None = Query(default=None, description="A standard as <publisher>/<name>."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetClaimListResponse:
    """Every standard every readable dataset claims, with the claims per standard."""
    return await install_claims.claims(session, reader=user, standard=standard)


async def validation_queue(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ValidationQueue:
    """Every violation on the current version of every readable dataset, with the totals."""
    return await install_claims.validation(session, reader=user)


async def create_dataset(
    payload: DatasetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetRead:
    """A private dataset with no version yet."""
    return await datasets.read(session, await datasets.create(session, payload=payload, actor=user))


async def get_dataset(
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetRead:
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await datasets.read(session, dataset)


async def update_dataset(
    payload: DatasetUpdate,
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetRead:
    """Title, description, sharing, labels and the refresh schedule — never a version.

    Sharing it with the install reads the install's checked rules first.
    """
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    dataset, warnings = await checks.share(session, dataset=dataset, payload=payload, actor=user)
    read = await datasets.read(session, dataset)
    read.warnings = warnings
    return read


async def list_versions(
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetVersionListResponse:
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    rows = await datasets.list_versions(session, dataset=dataset)
    items = [await datasets.read_version(session, dataset=dataset, version=v) for v in rows]
    return DatasetVersionListResponse(items=items, total=len(items))


async def publish_version(
    payload: DatasetVersionCreate,
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetVersionRead:
    """The next immutable version, from the records in the body — refused by a
    standard the dataset claims with ``block``, warned of by one claimed with ``warn``."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    version = await datasets.publish_version(session, dataset=dataset, payload=payload, actor=user)
    read = await datasets.read_version(session, dataset=dataset, version=version)
    read.warnings = await claims.warnings(session, dataset=dataset, version=version)
    return read


async def get_version(
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetVersionRead:
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    row = await datasets.get_version(session, dataset=dataset, version=version)
    return await datasets.read_version(session, dataset=dataset, version=row)


async def retract_version(
    payload: DatasetRetract,
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetVersionRead:
    """Mark one version withdrawn — an install Admin's act. It stays readable."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    row = await datasets.get_version(session, dataset=dataset, version=version)
    await datasets.retract(session, dataset=dataset, version=row, reason=payload.reason, actor=user)
    return await datasets.read_version(session, dataset=dataset, version=row)


async def version_used(
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetVersionUsage:
    """The bindings and derived versions that cite one version."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    row = await datasets.get_version(session, dataset=dataset, version=version)
    return await datasets.used(session, dataset=dataset, version=row, reader=user)


async def list_records(
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    provenance: bool = Query(default=False, description="Only the records with their own provenance."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetRecordPage:
    """One version's records, ordered by key; ``total`` counts what the filter keeps."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    row = await datasets.get_version(session, dataset=dataset, version=version)
    return await datasets.records_page(
        session, dataset=dataset, version=row, offset=offset, limit=limit, provenance=provenance
    )


async def get_record(
    publisher: str = Path(...),
    name: str = Path(...),
    key: str = Path(...),
    version: int | None = Query(default=None, ge=1, description="Omitted is the current version."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetRecordRead:
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await datasets.record(session, dataset=dataset, key=key, version=version)


async def record_history(
    publisher: str = Path(...),
    name: str = Path(...),
    key: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecordChangeLog:
    """Every version that added, changed or removed one record, newest first."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await datasets.record_history(session, dataset=dataset, key=key)


async def dataset_history(
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecordHistory:
    """Every version of the dataset, newest first: who, when, why, what changed
    against the one before, and the loads that bound it."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await changes.history(session, graph_id=None, record_kind="dataset", record_id=dataset.id)


async def compare_dataset_versions(
    publisher: str = Path(...),
    name: str = Path(...),
    b: str = Query(..., description="The version to read to."),
    a: str | None = Query(default=None, description="The version to read from; omitted is the one before b."),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChangeCompare:
    """Two versions of the dataset: licence, author chain, columns and the records summary."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await changes.compare(session, graph_id=None, record_kind="dataset", record_id=dataset.id, a=a, b=b)


async def list_standards(
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetStandardListResponse:
    """The standards the dataset claims, each with the current version's score."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    return await claims.list_attachments(session, dataset=dataset)


async def attach_standard(
    payload: DatasetStandardCreate,
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetStandardRead:
    """Claim a standard version with a mapping and a mode, or move an existing claim."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    claim = await claims.attach(session, dataset=dataset, payload=payload, actor=user)
    return await claims.read_attachment(session, dataset=dataset, claim=claim)


async def detach_standard(
    publisher: str = Path(...),
    name: str = Path(...),
    standard_publisher: str = Path(...),
    standard_name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Stop claiming a standard. Past conformance rows stay with their versions."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    await claims.detach(session, dataset=dataset, ref=f"{standard_publisher}/{standard_name}", actor=user)


async def version_conformance(
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ConformanceListResponse:
    """One version scored against each standard the dataset claims."""
    dataset = await datasets.get(session, publisher=publisher, name=name, reader=user)
    row = await datasets.get_version(session, dataset=dataset, version=version)
    items = await claims.conformance(session, dataset=dataset, version=row)
    return ConformanceListResponse(items=items, total=len(items))


async def list_bindings(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> DatasetBindingListResponse:
    """The Graph's dataset bindings, each with its version, run, retraction and newer version."""
    items = await binds.list(session, graph=graph)
    return DatasetBindingListResponse(items=items, total=len(items))


async def bind_dataset(
    payload: DatasetBindingCreate,
    request: Request,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DatasetBindingRead:
    """Bind one dataset version into a model as a node type — 201, then follow the load run."""
    binding, run, warnings = await binds.bind(
        session, graph=graph, ref=payload.dataset, model_id=payload.model, type_name=payload.type, actor=user
    )
    read = await datasets.read_binding(session, binding)
    read.warnings = warnings
    await session.commit()
    request.app.state.task_runtime.submit(run.id)
    return read
