"""Annotation rules against a real Postgres schema (4.8 — AN3 · AN7 · AN8)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError as SchemaError

from invana.apps.annotations.managers import AnnotationManager
from invana.apps.annotations.schemas import AnnotationCreate, AnnotationUpdate
from invana.apps.graphs.roles import GRAPH_PREFIX, GraphRole, area_for
from invana.core.errors import NotFoundError, PermissionDeniedError

manager = AnnotationManager()


def _note(record: str, text: str = "Leads every route out of LHR", **kw) -> AnnotationCreate:
    return AnnotationCreate(kind="note", records=[{"id": record, "kind": "node", "label": record}], text=text, **kw)


@pytest.mark.asyncio
async def test_a_member_sees_what_is_on_the_records_loaded(session, graph, user, other_user):
    await manager.create(session, graph_id=graph.id, user_id=user.id, payload=_note("n:DXB"))
    group = AnnotationCreate(kind="group", records=[{"id": "n:DXB"}, {"id": "n:BOM"}], label="Gulf")
    await manager.create(session, graph_id=graph.id, user_id=user.id, payload=group)
    await manager.create(session, graph_id=graph.id, user_id=user.id, payload=_note("n:AUH", "Elsewhere"))

    items, total = await manager.list(session, graph_id=graph.id, user_id=other_user.id, records=["n:BOM", "n:DXB"])

    assert total == 2
    assert [a.kind for a in items] == ["note", "group"]
    assert items[1].color == "blue" and items[1].author.name == "Test"


@pytest.mark.asyncio
async def test_a_value_annotation_keeps_the_value_and_its_writer_changes_it(session, graph, user):
    payload = AnnotationCreate(
        kind="value", records=[{"id": "n:DXB"}], prop="on_time", value_then="71%", text="Slipping"
    )
    a = await manager.create(session, graph_id=graph.id, user_id=user.id, payload=payload)
    await manager.update(session, annotation=a, user_id=user.id, payload=AnnotationUpdate(text="Slipping since summer"))

    (detail,), _ = await manager.list(session, graph_id=graph.id, user_id=user.id, records=["n:DXB"])
    assert (detail.prop, detail.value_then, detail.text) == ("on_time", "71%", "Slipping since summer")


@pytest.mark.asyncio
async def test_a_session_only_annotation_is_absent_to_anyone_else(session, graph, user, other_user, graph_session):
    a = await manager.create(
        session, graph_id=graph.id, user_id=user.id, payload=_note("n:DXB", session_id=graph_session.id)
    )
    a.reach = "session"
    await session.flush()

    mine, _ = await manager.list(session, graph_id=graph.id, user_id=user.id, scope="all")
    theirs, _ = await manager.list(session, graph_id=graph.id, user_id=other_user.id, scope="all")
    assert [x.id for x in mine] == [a.id] and theirs == []
    with pytest.raises(NotFoundError):
        await manager.get(session, annotation_id=a.id, graph_id=graph.id, user_id=other_user.id)


@pytest.mark.asyncio
async def test_only_the_writer_deletes_and_writing_needs_a_contributor(session, graph, user, other_user):
    a = await manager.create(session, graph_id=graph.id, user_id=user.id, payload=_note("n:DXB"))
    with pytest.raises(PermissionDeniedError):
        await manager.delete(session, annotation=a, user_id=other_user.id)
    assert area_for("POST", f"{GRAPH_PREFIX}/annotations").role == GraphRole.contributor


def test_a_group_needs_two_records_and_a_note_needs_words():
    with pytest.raises(SchemaError):
        AnnotationCreate(kind="group", records=[{"id": "n:DXB"}])
    with pytest.raises(SchemaError):
        AnnotationCreate(kind="note", records=[{"id": "n:DXB"}], text="  ")
