"""Model portability — one file per published version, and the paths back in.

A domain model belongs to a domain, not to the Graph that first held it
(docs/for-developers/modules/connect-and-model/features/share-a-model.md). It leaves
as a single self-contained artefact and comes back through import or upgrade.

Identity is ``package_id`` + ``content_hash`` (SM2), never the name — the name is
local, so two Graphs may call the same package different things and an upgrade
still resolves. The hash is taken over a canonical body with the local parts left
out, so exporting the same version twice, from two Graphs, yields the same hash.

Nothing here talks to a graph database. Import produces a **draft**; a person
publishes it (SM4).
"""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, Field

from invana.apps.modeller.json_io import SchemaExporter, SchemaImporter
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.apps.modeller.schemas import SchemaExport

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.store import ModelStore

ARTEFACT_FORMAT = "invana.model/1"


# ---------------------------------------------------------------------------
# The artefact
# ---------------------------------------------------------------------------


class ArtefactLink(BaseModel):
    """A declared link, carried only when both endpoints are in the bundle (SM3)."""

    kind: str
    source_package_id: str
    source_type: str
    target_package_id: str
    target_type: str
    source_property: str | None = None
    target_property: str | None = None
    identity_match: str = "exact"
    edge_type: str | None = None
    description: str = ""


class ModelArtefact(BaseModel):
    """One published version, self-contained. This is the file."""

    format: str = ARTEFACT_FORMAT
    package_id: str
    content_hash: str = ""
    name: str
    description: str = ""
    version: str | None = None
    model: SchemaExport
    # Present only in a bundle. A link whose endpoints are not both here is
    # dropped on import, with the missing endpoint named (SM3).
    links: list[ArtefactLink] = Field(default_factory=list)


class ModelBundle(BaseModel):
    """Several models and the links between them, as one file."""

    format: str = "invana.bundle/1"
    models: list[ModelArtefact]
    links: list[ArtefactLink] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------


def canonical_body(export: SchemaExport) -> dict[str, Any]:
    """The part of an artefact the hash is taken over.

    Local things are excluded on purpose: the model's name and description, and
    the semver, which is a Graph's own counting. What is left is the shape.
    """
    body = export.model_dump(mode="json", exclude={"schema_name", "schema_description", "version"})
    return _sorted(body)


def _sorted(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _sorted(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        items = [_sorted(v) for v in value]
        # Type lists are sets in meaning; order is authoring accident.
        if items and all(isinstance(i, dict) and "name" in i for i in items):
            return sorted(items, key=lambda i: str(i["name"]))
        if items and all(isinstance(i, str) for i in items):
            return sorted(items)
        return items
    return value


def compute_content_hash(export: SchemaExport) -> str:
    """SHA-256 over the canonical body. Stable across Graphs and exports."""
    payload = json.dumps(canonical_body(export), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def build_artefact(model: GraphModel, version: GraphVersion) -> ModelArtefact:
    """Serialise one version of *model* into its artefact."""
    export = SchemaExporter.export(
        version,
        schema_name=model.name,
        schema_description=model.description,
        validation_mode=model.validation_mode,
    )
    export.version = version.version
    return ModelArtefact(
        package_id=model.package_id,
        content_hash=compute_content_hash(export),
        name=model.name,
        description=model.description,
        version=version.version,
        model=export,
    )


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


class ImportRefused(ValueError):
    """The artefact cannot land at all — a collision the caller must resolve."""

    def __init__(self, error: str, detail: dict[str, Any]) -> None:
        super().__init__(error)
        self.error = error
        self.detail = detail


def unsupported_property_types(export: SchemaExport, supported: set[str]) -> list[dict[str, str]]:
    """Property types the target database cannot hold.

    They do not refuse the import (SM4). They come back so the draft can say why
    it cannot publish yet.
    """
    if not supported:
        return []
    offenders: list[dict[str, str]] = []
    for key in export.property_keys:
        base = key.type.split("[", 1)[0].strip().lower()
        if base not in supported:
            offenders.append({"property_key": key.name, "type": key.type})
    return offenders


async def import_artefact(
    session: AsyncSession,
    store: ModelStore,
    *,
    graph_id: str,
    artefact: ModelArtefact,
    name: str | None = None,
    import_source: str = "file",
) -> tuple[GraphModel, str]:
    """Land *artefact* in a Graph as a new model with a draft version.

    Returns the model and the new draft version id. The caller decides what to do
    about unsupported types — the draft exists either way.
    """
    local_name = name or artefact.name
    existing = await store.list_graph_models(session, graph_id)
    clash = next((m for m in existing if m.name.lower() == local_name.lower()), None)
    if clash is not None:
        raise ImportRefused(
            "model_name_taken",
            {
                "name": local_name,
                "model_id": clash.id,
                "package_id": clash.package_id,
                "same_package": clash.package_id == artefact.package_id,
            },
        )

    model = await store.create_graph_model(
        session,
        name=local_name,
        description=artefact.description,
        graph_id=graph_id,
        validation_mode=artefact.model.validation_mode,
    )
    model.package_id = artefact.package_id
    model.import_source = import_source
    await session.flush()

    # No empty draft is opened first: the artefact *is* the draft.
    version_id = await SchemaImporter(store).import_schema(session, model_id=model.id, data=artefact.model)
    return model, version_id


async def upgrade_model(
    session: AsyncSession,
    store: ModelStore,
    *,
    model: GraphModel,
    artefact: ModelArtefact,
) -> str:
    """Bring a newer version of the same package in as a draft on *model*.

    Refuses a different package outright: an upgrade is the same domain moving
    forward, and anything else is an import under a new name.
    """
    if model.package_id != artefact.package_id:
        raise ImportRefused(
            "package_mismatch",
            {"model_package_id": model.package_id, "artefact_package_id": artefact.package_id},
        )
    return await SchemaImporter(store).import_schema(session, model_id=model.id, data=artefact.model)
