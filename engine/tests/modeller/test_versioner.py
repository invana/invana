"""Tests for the Versioner — lifecycle and diffing."""

import pytest

from invana.apps.modeller.versioner import Versioner, _parse_semver, compute_diff, mark_types, next_semver


class TestSemVer:
    def test_parse_semver(self):
        assert _parse_semver("1.2.3") == (1, 2, 3)

    def test_parse_semver_invalid(self):
        with pytest.raises(ValueError, match="Invalid SemVer"):
            _parse_semver("1.2")

    def testnext_semver_major(self):
        assert next_semver("1.2.3", "major") == "2.0.0"

    def testnext_semver_minor(self):
        assert next_semver("1.2.3", "minor") == "1.3.0"

    def testnext_semver_patch(self):
        assert next_semver("1.2.3", "patch") == "1.2.4"

    def testnext_semver_from_none(self):
        assert next_semver(None, "minor") == "1.0.0"


@pytest.mark.asyncio
class TestVersioner:
    async def test_activate_first_version(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Activate Test")
        await session.commit()
        draft = await store.create_version(session, model_id=schema.id)
        await session.commit()

        activated = await versioner.activate(session, version_id=draft.id)
        assert activated.status == "active"
        assert activated.version == "1.0.0"
        assert activated.activated_at is not None

    async def test_activate_with_override(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Override Test")
        await session.commit()
        draft = await store.create_version(session, model_id=schema.id)
        await session.commit()

        activated = await versioner.activate(
            session,
            version_id=draft.id,
            override_version="3.0.0",
        )
        assert activated.version == "3.0.0"

    async def test_activate_archives_previous(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Archive Test")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        v1_refreshed = await store.get_version(session, v1.id)
        assert v1_refreshed.status == "archived"

    async def test_activate_non_draft_fails(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Non-draft")
        await session.commit()
        draft = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=draft.id)
        await session.commit()

        with pytest.raises(ValueError, match="not a draft"):
            await versioner.activate(session, version_id=draft.id)

    async def test_auto_versionnext_semver_minor(self, session, store):
        """Adding a node type is a minor change."""
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Minor Bump")
        await session.commit()

        # v1: empty
        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        # v2: add a node type → minor
        v2 = await store.create_version(session, model_id=schema.id, based_on="1.0.0")
        await session.commit()
        await store.create_property_key(session, version_id=v2.id, name="name", type="string")
        await session.commit()
        await store.create_node_type(
            session,
            version_id=v2.id,
            name="Person",
            property_mappings=[{"property_key": "name"}],
        )
        await session.commit()

        activated = await versioner.activate(session, version_id=v2.id)
        assert activated.version == "1.1.0"

    async def test_auto_versionnext_semver_major(self, session, store):
        """Removing a node type is a major change."""
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Major Bump")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v1.id, name="Person")
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        # v2: remove the node type → major
        v2 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        activated = await versioner.activate(session, version_id=v2.id)
        assert activated.version == "2.0.0"


@pytest.mark.asyncio
class TestDiff:
    async def test_diff_added_node_type(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Diff Test")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v2.id, name="Person")
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, model_id=schema.id, from_version="1.0.0", to_version="1.1.0")
        assert "Person" in diff.added_node_types
        assert diff.classification == "minor"

    async def test_diff_removed_node_type(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Diff Remove")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v1.id, name="Legacy")
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, model_id=schema.id, from_version="1.0.0", to_version="2.0.0")
        assert "Legacy" in diff.removed_node_types
        assert diff.classification == "major"

    async def test_diff_modified_property_key(self, session, store):
        """Changing a property key's type is a major change."""
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Diff Prop")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await session.commit()
        await store.create_property_key(session, version_id=v1.id, name="val", type="string")
        await session.commit()
        await store.create_node_type(
            session,
            version_id=v1.id,
            name="Thing",
            property_mappings=[{"property_key": "val"}],
        )
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, model_id=schema.id, based_on="1.0.0")
        await session.commit()
        # Change the property key type → major
        pks = await store.list_property_keys(session, v2.id)
        val_pk = next(pk for pk in pks if pk.name == "val")
        val_pk.type = "integer"
        await session.flush()
        await session.commit()

        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, model_id=schema.id, from_version="1.0.0", to_version="2.0.0")
        assert len(diff.modified_property_keys) == 1
        assert diff.modified_property_keys[0].name == "val"
        assert "type" in diff.modified_property_keys[0].changes
        assert diff.classification == "major"


@pytest.mark.asyncio
class TestMarks:
    async def test_added_property_marks_its_type(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_graph_model(session, name="Marks")
        await session.commit()

        v1 = await store.create_version(session, model_id=schema.id)
        await store.create_property_key(session, version_id=v1.id, name="name", type="string")
        await store.create_node_type(
            session, version_id=v1.id, name="Person", property_mappings=[{"property_key": "name"}]
        )
        await store.create_node_type(session, version_id=v1.id, name="Place")
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, model_id=schema.id, based_on="1.0.0")
        await store.create_property_key(session, version_id=v2.id, name="age", type="integer")
        await session.commit()
        person = next(nt for nt in await store.list_node_types(session, v2.id) if nt.name == "Person")
        await store.update_node_type(
            session, person.id, property_mappings=[{"property_key": "name"}, {"property_key": "age"}]
        )
        await session.commit()

        old = await store.get_version(session, v1.id)
        new = await store.get_version(session, v2.id)
        marked = mark_types(old, new, compute_diff(old, new))

        assert [(m.type, m.mark) for m in marked.marks] == [("Person", "changed")]
        assert any(line.sign == "+" and "age" in line.text for line in marked.marks[0].lines)

    async def test_unchanged_version_marks_nothing(self, session, store):
        schema = await store.create_graph_model(session, name="No marks")
        await session.commit()
        v1 = await store.create_version(session, model_id=schema.id)
        await store.create_node_type(session, version_id=v1.id, name="Person")
        await session.commit()

        version = await store.get_version(session, v1.id)
        assert mark_types(version, version, compute_diff(version, version)).marks == []
