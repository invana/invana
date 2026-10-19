"""Datasets — a record above Graphs with immutable, hashed versions.

One positive path (create → v1 → v2 → the dataset's change log and a record's
→ share, read and derived from by someone else → retracted by an Admin and
flagged where it is used → refreshed) and one negative case covering the
refusals: an identical version, a duplicate key, a private dataset read by
another, a write on a dataset someone else owns, sharing before a version
exists, a column labelled looser than its dataset, a dataset's history asked
for under a Graph, and a retraction by a non-Admin or of a retracted version.
A third case covers a bind's refusals; a bind that loads needs a graph database.
"""

from __future__ import annotations

import json

import pytest
from click.testing import CliRunner
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ChangeLogManager
from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetUpdate, DatasetVersionCreate
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel
from invana.cli.commands.datasets import datasets_cmd, read_records
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import Event
from invana.core.settings import settings
from invana.runtime.managers import DatasetBindManager

datasets = DatasetManager()
changes = ChangeLogManager()
binds = DatasetBindManager()

STOCK_CENTRE = [AuthorStep(role="original", kind="organisation", name="Arabidopsis stock centre")]
V1 = [
    {"accession": "CS76778", "name": "Col-0", "flowering_days": 28},
    {"accession": "CS76779", "name": "Ler-1", "flowering_days": 31},
    {
        "accession": "CS76780",
        "name": "Ws-2",
        "flowering_days": 30,
        "_provenance": {"origin": "observed", "note": "measured in our growth room"},
    },
]


async def _other(session: AsyncSession) -> User:
    row = User(email="reader@example.com", username="reader", password_hash="x", first_name="Reader")
    session.add(row)
    await session.flush()
    return row


async def _admin(session: AsyncSession) -> User:
    row = User(email="admin@example.com", username="admin", password_hash="x", first_name="Admin", is_superuser=True)
    session.add(row)
    await session.flush()
    return row


async def _accessions(session: AsyncSession, user: User):
    dataset = await datasets.create(
        session,
        payload=DatasetCreate(publisher="abrc", name="accessions", origin="official", key_column="accession"),
        actor=user,
    )
    payload = DatasetVersionCreate(licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=V1, source="v1.csv")
    v1 = await datasets.publish_version(session, dataset=dataset, payload=payload, actor=user)
    return dataset, v1


async def test_versions_are_hashed_shared_and_a_record_keeps_its_change_log(session: AsyncSession, user: User) -> None:
    dataset, v1 = await _accessions(session, user)
    assert dataset.address == "abrc/accessions"
    assert v1.version == 1 and v1.record_count == 3 and v1.content_hash.startswith("sha256:")
    assert v1.columns == ["accession", "name", "flowering_days"]

    # The provenance exception is lifted out of the values, and only that record carries one.
    ws2 = await datasets.record(session, dataset=dataset, key="CS76780")
    assert ws2.provenance == {"origin": "observed", "note": "measured in our growth room"}
    assert "_provenance" not in ws2.values
    assert (await datasets.record(session, dataset=dataset, key="CS76778")).provenance is None
    exceptions = await datasets.records_page(session, dataset=dataset, version=v1, offset=0, limit=50, provenance=True)
    assert (exceptions.total, [r.key for r in exceptions.items]) == (1, ["CS76780"])

    # v2: Ler-1 corrected, Ws-2 dropped, a new accession added.
    v2_records = [
        V1[0],
        {"accession": "CS76779", "name": "Ler-1", "flowering_days": 33},
        {"accession": "CS76781", "name": "Cvi-0", "flowering_days": 40},
    ]
    v2 = await datasets.publish_version(
        session,
        dataset=dataset,
        payload=DatasetVersionCreate(
            licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=v2_records, why="re-measured Ler-1"
        ),
        actor=user,
    )
    assert v2.version == 2 and v2.content_hash != v1.content_hash
    none = await datasets.records_page(session, dataset=dataset, version=v2, offset=0, limit=50, provenance=True)
    assert (none.total, none.items) == (0, [])
    assert dataset.current_version_id == v2.id

    history = await changes.history(session, graph_id=None, record_kind="dataset", record_id=dataset.id)
    assert history.name == "abrc/accessions"
    assert [(i.version, i.action, i.why) for i in history.items] == [
        ("2", actions.DATASET_VERSION, "re-measured Ler-1"),
        ("1", actions.DATASET_VERSION, None),
    ]
    assert history.items[0].summary == "1 added · 1 removed · 1 changed"
    assert history.items[0].effect.basis == "bound" and history.items[0].effect.runs == 0
    compare = await changes.compare(session, graph_id=None, record_kind="dataset", record_id=dataset.id, a=None, b="2")
    assert compare.records.model_dump() == {"added": 1, "removed": 1, "changed": 1} and compare.fields == []

    ler = await datasets.record_history(session, dataset=dataset, key="CS76779")
    assert [(c.version, c.kind) for c in ler.items] == [(2, "changed"), (1, "added")]
    assert ler.items[0].why == "re-measured Ler-1"
    assert [(p.property, p.before, p.after) for p in ler.items[0].properties] == [("flowering_days", 31, 33)]
    ws = await datasets.record_history(session, dataset=dataset, key="CS76780")
    assert [c.kind for c in ws.items] == ["removed", "added"]
    # An earlier version still reads the record it held.
    assert (await datasets.record(session, dataset=dataset, key="CS76780", version=1)).values["name"] == "Ws-2"

    await datasets.update(session, dataset=dataset, payload=DatasetUpdate(visibility="install"), actor=user)
    reader = await _other(session)
    seen = await datasets.get(session, publisher="abrc", name="accessions", reader=reader)
    read = await datasets.read(session, seen)
    assert read.current_version == 2 and read.licence == "CC-BY-4.0" and read.record_count == 3
    assert [d.address for d in await datasets.catalogue(session, reader=reader, origin="official")] == [
        "abrc/accessions"
    ]

    minted = (
        (
            await session.execute(
                select(Event).where(Event.target_id == dataset.id, Event.action == actions.DATASET_VERSION)
            )
        )
        .scalars()
        .all()
    )
    assert sorted(e.details["version"] for e in minted) == [1, 2]
    assert all(e.graph_id is None for e in minted)

    # Someone else derives from v2; then an Admin retracts v2.
    selection = await datasets.create(
        session, payload=DatasetCreate(name="early", origin="derived", key_column="accession"), actor=reader
    )
    picked = await datasets.publish_version(
        session,
        dataset=selection,
        payload=DatasetVersionCreate(
            licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=[V1[0]], derived_from=["abrc/accessions@2"]
        ),
        actor=reader,
    )
    await datasets.retract(
        session, dataset=dataset, version=v2, reason="contaminated seed batch", actor=await _admin(session)
    )
    assert dataset.current_version_id == v2.id  # retracting is not a move
    assert (
        await datasets.read_version(session, dataset=dataset, version=v2)
    ).retracted.reason == "contaminated seed batch"
    assert (await datasets.read_version(session, dataset=selection, version=picked)).retracted_inputs == [
        "abrc/accessions@2"
    ]
    used = await datasets.used(session, dataset=dataset, version=v2, reader=reader)
    assert used.bindings == [] and [d.address for d in used.derived] == ["reader/early@1"]

    # A firing of the refresh: unchanged content mints nothing; new content mints v3.
    assert await datasets.refresh(session, dataset=dataset, records=v2_records, actor=user) is None
    v3 = await datasets.refresh(session, dataset=dataset, records=[*v2_records, V1[2]], actor=user)
    assert v3.version == 3 and v3.why == "scheduled refresh" and v3.licence == "CC-BY-4.0"


async def test_the_dataset_refuses_what_would_make_a_version_or_a_share_dishonest(
    session: AsyncSession, user: User, graph: Graph
) -> None:
    dataset, _ = await _accessions(session, user)
    # A dataset belongs to no Graph, so a Graph's change log does not know it.
    with pytest.raises(NotFoundError):
        await changes.history(session, graph_id=graph.id, record_kind="dataset", record_id=dataset.id)
    reader = await _other(session)

    with pytest.raises(ConflictError, match="unchanged"):
        await datasets.publish_version(
            session,
            dataset=dataset,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=list(V1)),
            actor=user,
        )
    with pytest.raises(ValidationError, match="duplicate"):
        await datasets.publish_version(
            session,
            dataset=dataset,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=[V1[0], V1[0]]),
            actor=user,
        )
    # Private: absent to anyone else, not forbidden.
    with pytest.raises(NotFoundError):
        await datasets.get(session, publisher="abrc", name="accessions", reader=reader)
    # Shared: readable, but only the owner writes.
    await datasets.update(session, dataset=dataset, payload=DatasetUpdate(visibility="install"), actor=user)
    with pytest.raises(PermissionDeniedError, match="owner"):
        await datasets.update(session, dataset=dataset, payload=DatasetUpdate(title="mine now"), actor=reader)

    empty = await datasets.create(session, payload=DatasetCreate(name="field-notes", origin="observed"), actor=user)
    assert empty.address == "owner/field-notes"
    with pytest.raises(ConflictError, match="no version"):
        await datasets.update(session, dataset=empty, payload=DatasetUpdate(visibility="install"), actor=user)
    with pytest.raises(ValidationError, match="looser"):
        await datasets.update(
            session,
            dataset=empty,
            payload=DatasetUpdate(sensitivity="confidential", column_sensitivity={"plot": "public"}),
            actor=user,
        )
    assert empty.sensitivity == "internal"

    v1 = await datasets.get_version(session, dataset=dataset, version=1)
    with pytest.raises(PermissionDeniedError, match="Admin"):
        await datasets.retract(session, dataset=dataset, version=v1, reason="mine to withdraw", actor=user)
    admin = await _admin(session)
    await datasets.retract(session, dataset=dataset, version=v1, reason="withdrawn", actor=admin)
    with pytest.raises(ConflictError, match="already retracted"):
        await datasets.retract(session, dataset=dataset, version=v1, reason="again", actor=admin)


async def test_a_bind_refuses_a_retracted_version_a_foreign_model_and_an_unpublished_one(
    session: AsyncSession, user: User, graph: Graph, other_graph: Graph, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "dataset_dir", str(tmp_path))
    dataset, v1 = await _accessions(session, user)
    await datasets.publish_version(
        session,
        dataset=dataset,
        payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=STOCK_CENTRE, records=V1[:2]),
        actor=user,
    )
    await datasets.retract(session, dataset=dataset, version=v1, reason="withdrawn", actor=await _admin(session))
    here = GraphModel(graph_id=graph.id, name="Germplasm")
    elsewhere = GraphModel(graph_id=other_graph.id, name="Germplasm")
    session.add_all([here, elsewhere])
    await session.flush()

    with pytest.raises(ConflictError, match="retracted"):
        await binds.bind(
            session, graph=graph, ref="abrc/accessions@1", model_id=here.id, type_name="Accession", actor=user
        )
    with pytest.raises(NotFoundError, match="Model"):
        await binds.bind(
            session, graph=graph, ref="abrc/accessions@2", model_id=elsewhere.id, type_name="Accession", actor=user
        )
    # The load's own prologue refuses a model with no published version; the
    # version was still written as a load folder, keyed as `id`.
    with pytest.raises(ConflictError, match="no published version"):
        await binds.bind(
            session, graph=graph, ref="abrc/accessions@2", model_id=here.id, type_name="Accession", actor=user
        )
    written = list(tmp_path.glob("*/Accession/nodes/Accession.json"))
    assert len(written) == 1
    assert [r["id"] for r in json.loads(written[0].read_text())] == ["CS76778", "CS76779"]
    assert await binds.list(session, graph=graph) == []


def test_the_cli_reads_a_csv_file_and_refuses_a_refresh_that_is_neither_set_nor_fired(tmp_path) -> None:
    source = tmp_path / "accessions.csv"
    source.write_text("accession,name,flowering_days\nCS76778,Col-0,28\nCS76779,,31\n", encoding="utf-8")
    assert read_records(str(source)) == [
        {"accession": "CS76778", "name": "Col-0", "flowering_days": "28"},
        {"accession": "CS76779", "name": None, "flowering_days": "31"},
    ]
    result = CliRunner().invoke(datasets_cmd, ["refresh", "abrc/accessions", "--user", "owner"])
    assert result.exit_code == 2 and "Either --now" in result.output
