"""Standards, a dataset's claims, and checked rules at the acts they name.

One positive path for standards (a standard → a dataset claims it as warn → a
breaking version goes through with a warning and is scored → the standard's
next version leaves the claim pinned), one negative case for their refusals
(block over a breaking version, an unknown term, a pack by a non-Admin, a term
named twice, an unchanged version), and one case for checked rules: an install
rule that warns on share and one that blocks a bind, the refusals of a rule
that cannot be saved, and a rule offered everywhere once it is install-wide.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import ClaimsManager, ConformanceManager, DatasetManager
from invana.apps.datasets.schemas import (
    AuthorStep,
    DatasetCreate,
    DatasetStandardCreate,
    DatasetUpdate,
    DatasetVersionCreate,
)
from invana.apps.graphs.models import Graph
from invana.apps.modeller.models import GraphModel
from invana.apps.skills.checks import normalise_check
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCheck, RuleCreate, RuleUpdate
from invana.apps.standards.managers import StandardManager
from invana.apps.standards.schemas import StandardCreate, StandardTerm
from invana.core.auth.models import User
from invana.core.errors import ConflictError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import Event
from invana.core.settings import settings
from invana.runtime.managers import DatasetBindManager, RuleCheckManager

datasets = DatasetManager()
claims = ConformanceManager()
install = ClaimsManager()
standards = StandardManager()
rules = RuleManager()
checks = RuleCheckManager()
binds = DatasetBindManager()

LAB = [AuthorStep(role="original", kind="organisation", name="Field lab")]
TERMS = [
    StandardTerm(name="accession", required=True),
    StandardTerm(name="country", required=True, values=[{"code": "DE", "label": "Germany"}, {"code": "SE"}]),
    StandardTerm(name="year", type="integer"),
]
GOOD = [
    {"accession": "CS1", "country": "DE", "year": 2001},
    {"accession": "CS2", "country": "SE", "year": "2004"},
]
BAD = [
    {"accession": "CS1", "country": "DE", "year": 2001},
    {"accession": "CS2", "country": "XX", "year": "old"},
]


async def _admin(session: AsyncSession) -> User:
    row = User(email="admin@example.com", username="admin", password_hash="x", first_name="Admin", is_superuser=True)
    session.add(row)
    await session.flush()
    return row


async def _passport(session: AsyncSession, admin: User):
    return await standards.create(
        session, payload=StandardCreate(name="passport", origin="pack", terms=TERMS), actor=admin
    )


async def _dataset(session: AsyncSession, user: User, records: list[dict], licence: str = "CC-BY-4.0"):
    dataset = await datasets.create(
        session, payload=DatasetCreate(name="accessions", origin="official", key_column="accession"), actor=user
    )
    await datasets.publish_version(
        session,
        dataset=dataset,
        payload=DatasetVersionCreate(licence=licence, author_chain=LAB, records=records),
        actor=user,
    )
    return dataset


async def test_a_claimed_standard_scores_every_version_and_stays_pinned(session: AsyncSession, user: User) -> None:
    admin = await _admin(session)
    standard = await _passport(session, admin)
    assert (await standards.read(session, standard)).current_version == 1
    dataset = await _dataset(session, user, GOOD)

    claim = await claims.attach(
        session, dataset=dataset, payload=DatasetStandardCreate(standard="admin/passport"), actor=user
    )
    read = await claims.read_attachment(session, dataset=dataset, claim=claim)
    assert (read.standard, read.mode, read.conformance.score) == ("admin/passport@1", "warn", 1.0)

    # warn lets a breaking version through, and says so.
    v2 = await datasets.publish_version(
        session,
        dataset=dataset,
        payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=LAB, records=BAD),
        actor=user,
    )
    warnings = await claims.warnings(session, dataset=dataset, version=v2)
    assert len(warnings) == 1 and "admin/passport@1 scores 0.5" in warnings[0]
    [scored] = await claims.conformance(session, dataset=dataset, version=v2)
    assert (scored.conforming, scored.record_count, scored.conforms) == (1, 2, False)
    assert {(v.key, v.term, v.kind) for v in scored.violations} == {
        ("CS2", "country", "not_allowed"),
        ("CS2", "year", "wrong_type"),
    }

    # Applying the same file again is unchanged; a new term mints v2 and the claim stays on v1.
    _, unchanged = await standards.apply(
        session, payload=StandardCreate(name="passport", origin="pack", terms=TERMS), actor=admin
    )
    assert unchanged is None
    _, next_version = await standards.apply(
        session,
        payload=StandardCreate(name="passport", origin="pack", terms=[*TERMS, StandardTerm(name="site")]),
        actor=admin,
    )
    assert next_version.version == 2
    read = await claims.read_attachment(session, dataset=dataset, claim=claim)
    assert (read.version, read.newer_version) == (1, 2)


async def test_claims_and_the_validation_queue_are_counted_by_the_engine(session: AsyncSession, user: User) -> None:
    admin = await _admin(session)
    await _passport(session, admin)
    dataset = await _dataset(session, user, BAD)
    await claims.attach(session, dataset=dataset, payload=DatasetStandardCreate(standard="admin/passport"), actor=user)

    listed = await claims.list_attachments(session, dataset=dataset)
    assert (listed.total, listed.lowest_score) == (1, 0.5)
    mine = await install.claims(session, reader=user)
    assert (mine.total, mine.by_standard, mine.unreadable) == (1, {"admin/passport": 1}, 0)
    queue = await install.validation(session, reader=user)
    assert queue.total == 2 and [(d.address, d.total) for d in queue.datasets] == [(dataset.address, 2)]
    assert {(i.violation.key, i.column, i.standard) for i in queue.items} == {
        ("CS2", "country", "admin/passport@1"),
        ("CS2", "year", "admin/passport@1"),
    }

    # A private dataset is no one else's to count, and a standard nobody claims has no claims.
    other = User(email="other@example.com", username="other", password_hash="x", first_name="Other")
    session.add(other)
    await session.flush()
    assert (await install.claims(session, reader=other)).total == 0
    assert (await install.validation(session, reader=other)).total == 0
    assert (await install.claims(session, reader=user, standard="admin/unclaimed")).items == []


async def test_standards_refuse_a_breaking_block_an_unknown_term_and_a_pack_by_a_non_admin(
    session: AsyncSession, user: User
) -> None:
    admin = await _admin(session)
    await _passport(session, admin)
    dataset = await _dataset(session, user, BAD)

    with pytest.raises(ConflictError, match="Attach as warn"):
        await claims.attach(
            session, dataset=dataset, payload=DatasetStandardCreate(standard="admin/passport", mode="block"), actor=user
        )
    with pytest.raises(ValidationError, match="has no term colour"):
        await claims.attach(
            session,
            dataset=dataset,
            payload=DatasetStandardCreate(standard="admin/passport", mapping={"colour": "c"}),
            actor=user,
        )
    # Fixed, then claimed as block: the next breaking version is refused and nothing is written.
    await datasets.publish_version(
        session,
        dataset=dataset,
        payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=LAB, records=GOOD),
        actor=user,
    )
    await claims.attach(
        session, dataset=dataset, payload=DatasetStandardCreate(standard="admin/passport", mode="block"), actor=user
    )
    with pytest.raises(ConflictError, match="blocked — admin/passport@1"):
        await datasets.publish_version(
            session,
            dataset=dataset,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=LAB, records=BAD),
            actor=user,
        )
    assert (await datasets.current(session, dataset)).version == 2

    with pytest.raises(PermissionDeniedError, match="install Admin"):
        await standards.create(session, payload=StandardCreate(name="mine", origin="pack", terms=TERMS), actor=user)
    with pytest.raises(ValidationError, match="named twice"):
        await standards.create(session, payload=StandardCreate(name="twice", terms=[TERMS[0], TERMS[0]]), actor=user)
    with pytest.raises(ConflictError, match="unchanged"):
        await standards.publish_version(
            session,
            standard=await standards.get(session, publisher="admin", name="passport"),
            terms=TERMS,
            why=None,
            actor=admin,
        )


async def test_checked_rules_warn_on_share_block_a_bind_and_refuse_what_cannot_be_checked(
    session: AsyncSession, user: User, graph: Graph, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "dataset_dir", str(tmp_path))
    admin = await _admin(session)
    await _passport(session, admin)
    dataset = await _dataset(session, user, GOOD, licence="Proprietary")

    with pytest.raises(PermissionDeniedError, match="install Admin"):
        await rules.create_install(session, payload=RuleCreate(statement="Open data only."), actor=user)
    with pytest.raises(ValidationError, match="no check"):
        await rules.create_install(session, payload=RuleCreate(statement="x", mode="block"), actor=admin)
    with pytest.raises(ValidationError, match="No project act"):
        normalise_check({"kind": "dataset.licence", "allowed": ["CC0"]}, scope="project")
    with pytest.raises(Exception, match="not found"):
        await rules.create_install(
            session,
            payload=RuleCreate(statement="x", check=RuleCheck(kind="dataset.conforms", standard="nobody/none")),
            actor=admin,
        )

    licence = await rules.create_install(
        session,
        payload=RuleCreate(
            statement="Shared data is openly licensed.", check=RuleCheck(kind="dataset.licence", allowed=["CC-BY-4.0"])
        ),
        actor=admin,
    )
    assert (licence.scope, licence.graph_id, licence.mode) == ("install", None, "warn")
    _, warnings = await checks.share(session, dataset=dataset, payload=DatasetUpdate(visibility="install"), actor=user)
    assert dataset.visibility == "install"
    assert warnings == ["Rule \"Shared data is openly licensed.\": licence 'Proprietary' is not one of CC-BY-4.0."]
    events = (await session.execute(select(Event).where(Event.action == actions.RULE_CHECK))).scalars().all()
    assert [(e.target_id, e.graph_id, e.details["act"]) for e in events] == [(licence.id, None, "dataset.share")]

    # A Graph's invariant that blocks a bind: the dataset claims no passport.
    await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(
            statement="Bound accessions follow the passport.",
            check=RuleCheck(kind="dataset.conforms", standard="admin/passport"),
            mode="block",
        ),
        actor_id=user.id,
    )
    model = GraphModel(graph_id=graph.id, name="Germplasm")
    session.add(model)
    await session.flush()
    with pytest.raises(ConflictError, match="does not claim admin/passport"):
        await binds.bind(
            session, graph=graph, ref="owner/accessions@1", model_id=model.id, type_name="Accession", actor=user
        )
    assert not list(tmp_path.iterdir())

    # Rewording or re-moding mints a version; the install rule is offered in every Graph.
    await rules.update(session, rule=licence, payload=RuleUpdate(mode="report"), actor_id=admin.id)
    assert (licence.version, licence.mode) == (2, "report")
    assert [r.id for r in await rules.install(session, active_only=True)] == [licence.id]
