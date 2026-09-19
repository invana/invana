"""The staged set — what a draft has changed since the version it replaces.

Few tests, and each one is a rule from model-editor.md rather than a code path:
the draft *is* the staged set, discarding one puts that element back, and a draft
that matches its published version says so instead of offering a commit.
"""

import pytest

from invana.apps.modeller.staging import UnknownChange, collect, discard_all, discard_one
from invana.apps.modeller.versioner import Versioner


async def _published_model(session, store, *, name: str):
    """A model with one published version holding two node types and an edge."""
    model = await store.create_graph_model(session, name=name)
    draft = await store.create_version(session, model_id=model.id)
    await store.create_property_key(session, version_id=draft.id, name="symbol", type="string")
    await store.create_node_type(session, version_id=draft.id, name="Stock")
    await store.create_node_type(session, version_id=draft.id, name="Sector")
    await store.create_edge_type(
        session,
        version_id=draft.id,
        name="IN_SECTOR",
        source_node_types=["Stock"],
        target_node_types=["Sector"],
    )
    await session.commit()
    active = await Versioner(store).activate(session, version_id=draft.id)
    await session.commit()
    return model, await store.get_version(session, active.id)


@pytest.mark.asyncio
class TestStagedSet:
    async def test_a_draft_matching_its_version_stages_nothing(self, session, store):
        model, active = await _published_model(session, store, name="Clean")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await session.commit()

        staged = collect(active, await store.get_version(session, draft.id))
        assert staged.count == 0
        assert staged.can_commit is False
        assert "matches the published version" in staged.reason

    async def test_every_edit_on_the_draft_shows_up_staged(self, session, store):
        model, active = await _published_model(session, store, name="Edited")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await store.create_node_type(session, version_id=draft.id, name="Theme")
        removed = next(nt for nt in (await store.get_version(session, draft.id)).node_types if nt.name == "Sector")
        await store.delete_node_type(session, removed.id)
        await session.commit()

        staged = collect(active, await store.get_version(session, draft.id))
        assert staged.can_commit is True
        assert {(c.op, c.name) for c in staged.changes} >= {("added", "Theme"), ("removed", "Sector")}

    async def test_a_staged_delete_names_its_dependents(self, session, store):
        model, active = await _published_model(session, store, name="Dependents")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        sector = next(nt for nt in (await store.get_version(session, draft.id)).node_types if nt.name == "Sector")
        await store.delete_node_type(session, sector.id)
        await session.commit()

        staged = collect(active, await store.get_version(session, draft.id))
        removal = next(c for c in staged.changes if c.op == "removed" and c.name == "Sector")
        assert "edge type IN_SECTOR" in removal.dependents

    async def test_an_edited_type_stages_what_changed_on_it(self, session, store):
        """A modified node or edge type is a staged row like any other.

        It was not: the diff for a type carries `added_property_mappings` /
        `removed_property_mappings` / `metadata_changes`, never a `changes`
        dict, so collecting one raised `AttributeError` and the whole staged set
        answered 500 — a model with an edited type could not open its panel.
        """
        model, active = await _published_model(session, store, name="Edits")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        loaded = await store.get_version(session, draft.id)
        edge = next(et for et in loaded.edge_types if et.name == "IN_SECTOR")
        await store.update_edge_type(session, edge.id, description="Where a stock trades")
        node = next(nt for nt in loaded.node_types if nt.name == "Stock")
        await store.update_node_type(session, node.id, description="A listed company")
        await session.commit()

        staged = collect(active, await store.get_version(session, draft.id))
        edited = {(c.kind, c.name): c for c in staged.changes if c.op == "modified"}
        assert ("edge_type", "IN_SECTOR") in edited
        assert ("node_type", "Stock") in edited
        assert edited[("edge_type", "IN_SECTOR")].changes["description"][-1] == "Where a stock trades"

    async def test_discarding_one_puts_that_element_back(self, session, store):
        model, active = await _published_model(session, store, name="DiscardOne")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await store.create_node_type(session, version_id=draft.id, name="Theme")
        sector = next(nt for nt in (await store.get_version(session, draft.id)).node_types if nt.name == "Sector")
        await store.delete_node_type(session, sector.id)
        await session.commit()

        loaded = await store.get_version(session, draft.id)
        await discard_one(session, store, active=active, draft=loaded, change_id="node_type:removed:Sector")
        await session.commit()

        staged = collect(active, await store.get_version(session, draft.id))
        assert {(c.op, c.name) for c in staged.changes} == {("added", "Theme")}

    async def test_discarding_an_unknown_change_is_refused(self, session, store):
        model, active = await _published_model(session, store, name="Unknown")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await session.commit()

        with pytest.raises(UnknownChange):
            await discard_one(
                session,
                store,
                active=active,
                draft=await store.get_version(session, draft.id),
                change_id="node_type:added:Nope",
            )

    async def test_discarding_everything_returns_the_draft_to_its_version(self, session, store):
        model, active = await _published_model(session, store, name="DiscardAll")
        draft = await store.create_version(session, model_id=model.id, based_on=active.version)
        await store.create_node_type(session, version_id=draft.id, name="Theme")
        await session.commit()

        await discard_all(session, store, active=active, draft=await store.get_version(session, draft.id))
        await session.commit()

        assert collect(active, await store.get_version(session, draft.id)).count == 0
