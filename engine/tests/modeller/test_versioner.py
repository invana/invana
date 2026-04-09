"""Tests for the Versioner — lifecycle and diffing."""

import pytest

from invana.modeller.versioner import Versioner, _bump, _parse_semver


class TestSemVer:
    def test_parse_semver(self):
        assert _parse_semver("1.2.3") == (1, 2, 3)

    def test_parse_semver_invalid(self):
        with pytest.raises(ValueError, match="Invalid SemVer"):
            _parse_semver("1.2")

    def test_bump_major(self):
        assert _bump("1.2.3", "major") == "2.0.0"

    def test_bump_minor(self):
        assert _bump("1.2.3", "minor") == "1.3.0"

    def test_bump_patch(self):
        assert _bump("1.2.3", "patch") == "1.2.4"

    def test_bump_from_none(self):
        assert _bump(None, "minor") == "1.0.0"


@pytest.mark.asyncio
class TestVersioner:
    async def test_activate_first_version(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Activate Test")
        await session.commit()
        draft = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        activated = await versioner.activate(session, version_id=draft.id)
        assert activated.status == "active"
        assert activated.version == "1.0.0"
        assert activated.activated_at is not None

    async def test_activate_with_override(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Override Test")
        await session.commit()
        draft = await store.create_version(session, schema_id=schema.id)
        await session.commit()

        activated = await versioner.activate(
            session,
            version_id=draft.id,
            override_version="3.0.0",
        )
        assert activated.version == "3.0.0"

    async def test_activate_archives_previous(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Archive Test")
        await session.commit()

        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        v1_refreshed = await store.get_version(session, v1.id)
        assert v1_refreshed.status == "archived"

    async def test_activate_non_draft_fails(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Non-draft")
        await session.commit()
        draft = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=draft.id)
        await session.commit()

        with pytest.raises(ValueError, match="not a draft"):
            await versioner.activate(session, version_id=draft.id)

    async def test_auto_version_bump_minor(self, session, store):
        """Adding a node type is a minor change."""
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Minor Bump")
        await session.commit()

        # v1: empty
        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        # v2: add a node type → minor
        v2 = await store.create_version(session, schema_id=schema.id, based_on="1.0.0")
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

    async def test_auto_version_bump_major(self, session, store):
        """Removing a node type is a major change."""
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Major Bump")
        await session.commit()

        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v1.id, name="Person")
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        # v2: remove the node type → major
        v2 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        activated = await versioner.activate(session, version_id=v2.id)
        assert activated.version == "2.0.0"


@pytest.mark.asyncio
class TestDiff:
    async def test_diff_added_node_type(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Diff Test")
        await session.commit()

        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v2.id, name="Person")
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, schema_id=schema.id, from_version="1.0.0", to_version="1.1.0")
        assert "Person" in diff.added_node_types
        assert diff.classification == "minor"

    async def test_diff_removed_node_type(self, session, store):
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Diff Remove")
        await session.commit()

        v1 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await store.create_node_type(session, version_id=v1.id, name="Legacy")
        await session.commit()
        await versioner.activate(session, version_id=v1.id)
        await session.commit()

        v2 = await store.create_version(session, schema_id=schema.id)
        await session.commit()
        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, schema_id=schema.id, from_version="1.0.0", to_version="2.0.0")
        assert "Legacy" in diff.removed_node_types
        assert diff.classification == "major"

    async def test_diff_modified_property_key(self, session, store):
        """Changing a property key's type is a major change."""
        versioner = Versioner(store)
        schema = await store.create_schema(session, name="Diff Prop")
        await session.commit()

        v1 = await store.create_version(session, schema_id=schema.id)
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

        v2 = await store.create_version(session, schema_id=schema.id, based_on="1.0.0")
        await session.commit()
        # Change the property key type → major
        pks = await store.list_property_keys(session, v2.id)
        val_pk = next(pk for pk in pks if pk.name == "val")
        val_pk.type = "integer"
        await session.flush()
        await session.commit()

        await versioner.activate(session, version_id=v2.id)
        await session.commit()

        diff = await versioner.diff(session, schema_id=schema.id, from_version="1.0.0", to_version="2.0.0")
        assert len(diff.modified_property_keys) == 1
        assert diff.modified_property_keys[0].name == "val"
        assert "type" in diff.modified_property_keys[0].changes
        assert diff.classification == "major"
