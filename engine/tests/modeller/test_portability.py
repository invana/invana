"""Portability — one file out, a draft back in, and an upgrade that is not an import.

The rules under test come from share-a-model.md: identity is the package plus the
content hash, not the name (SM2); a name already in use is named, never merged
(C6); an artefact of a different package is not an upgrade.
"""

import pytest

from invana.apps.modeller.portability import (
    ImportRefused,
    build_artefact,
    compute_content_hash,
    import_artefact,
    unsupported_property_types,
    upgrade_model,
)
from invana.apps.modeller.versioner import Versioner


async def _published(session, store, *, name: str, graph_id=None, extra_type: str | None = None):
    model = await store.create_graph_model(session, name=name, graph_id=graph_id)
    draft = await store.create_version(session, model_id=model.id)
    await store.create_property_key(session, version_id=draft.id, name="symbol", type="string")
    await store.create_node_type(session, version_id=draft.id, name="Stock")
    if extra_type:
        await store.create_node_type(session, version_id=draft.id, name=extra_type)
    await session.commit()
    active = await Versioner(store).activate(session, version_id=draft.id)
    await session.commit()
    return model, await store.get_version(session, active.id)


@pytest.mark.asyncio
class TestArtefact:
    async def test_the_same_shape_hashes_the_same_under_another_name(self, session, store):
        model_a, version_a = await _published(session, store, name="MarketData")
        model_b, version_b = await _published(session, store, name="Marktdaten")

        assert build_artefact(model_a, version_a).content_hash == build_artefact(model_b, version_b).content_hash

    async def test_a_different_shape_hashes_differently(self, session, store):
        model_a, version_a = await _published(session, store, name="Thin")
        model_b, version_b = await _published(session, store, name="Fat", extra_type="Sector")

        assert build_artefact(model_a, version_a).content_hash != build_artefact(model_b, version_b).content_hash

    async def test_an_unsupported_type_is_named_not_dropped(self, session, store):
        model, version = await _published(session, store, name="Typed")
        artefact = build_artefact(model, version)

        offenders = unsupported_property_types(artefact.model, {"int", "float"})
        assert offenders == [{"property_key": "symbol", "type": "string"}]
        # An empty capability set means "unknown backend" — nothing is refused.
        assert unsupported_property_types(artefact.model, set()) == []


@pytest.mark.asyncio
class TestImport:
    async def test_an_artefact_lands_as_a_draft_under_its_own_package(self, session, store):
        source, version = await _published(session, store, name="MarketData")
        artefact = build_artefact(source, version)

        imported, draft_id = await import_artefact(
            session, store, graph_id=None, artefact=artefact, name="MarketDataCopy"
        )
        await session.commit()

        draft = await store.get_version(session, draft_id)
        assert draft.status == "draft"
        assert imported.name == "MarketDataCopy"
        assert imported.package_id == source.package_id
        assert imported.import_source == "file"
        assert {nt.name for nt in draft.node_types} == {"Stock"}

    async def test_a_name_already_in_use_is_refused_by_name(self, session, store):
        source, version = await _published(session, store, name="Fundamentals", graph_id=None)
        artefact = build_artefact(source, version)

        with pytest.raises(ImportRefused) as exc:
            await import_artefact(session, store, graph_id=None, artefact=artefact)
        assert exc.value.error == "model_name_taken"
        assert exc.value.detail["same_package"] is True

    async def test_upgrading_from_another_package_is_refused(self, session, store):
        mine, _ = await _published(session, store, name="Mine")
        theirs, version = await _published(session, store, name="Theirs")
        artefact = build_artefact(theirs, version)

        with pytest.raises(ImportRefused) as exc:
            await upgrade_model(session, store, model=mine, artefact=artefact)
        assert exc.value.error == "package_mismatch"

    async def test_an_upgrade_of_the_same_package_lands_as_a_draft(self, session, store):
        model, version = await _published(session, store, name="Upgradeable")
        artefact = build_artefact(model, version)
        artefact.model.node_types.append(artefact.model.node_types[0].model_copy(update={"name": "Sector"}))
        artefact.content_hash = compute_content_hash(artefact.model)

        draft_id = await upgrade_model(session, store, model=model, artefact=artefact)
        await session.commit()

        draft = await store.get_version(session, draft_id)
        assert draft.status == "draft"
        assert {nt.name for nt in draft.node_types} == {"Stock", "Sector"}
