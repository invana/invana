"""Ontology import — an RDFS / OWL ontology becomes a draft model in a Graph
(docs/for-developers/modules/connect-and-model/features/ontology-import.md).

Reading and mapping run off the event loop; writing is the share-a-model import
path — a new model with one draft version, ``import_source = ontology`` and a
fresh ``package_id``. A taken name raises ``ImportRefused`` (``model_name_taken``)
for the caller to turn into a 409. A dry run maps and writes nothing. Emitting
the event and committing are the caller's.

Usage::

    imported = await OntologyImportManager().import_ontology(
        session, graph_id=graph.id, payload=OntologyImportRequest(content=ttl, types=["Person"])
    )
    imported.export, imported.report, imported.model, imported.version_id
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.modeller.models import GraphModel
from invana.apps.modeller.portability import ModelArtefact, compute_content_hash, import_artefact
from invana.apps.modeller.schemas import SchemaExport
from invana.apps.modeller.store import ModelStore
from invana.apps.semantic.ontology import map_ontology
from invana.apps.semantic.reader import read_rdf
from invana.apps.semantic.schemas import OntologyImportRequest, OntologyReport

IMPORT_SOURCE = "ontology"


@dataclass
class OntologyImport:
    export: SchemaExport
    report: OntologyReport
    artefact: ModelArtefact
    #: Absent on a dry run.
    model: GraphModel | None = None
    version_id: str | None = None


def _read(payload: OntologyImportRequest) -> tuple[SchemaExport, OntologyReport]:
    graph, fmt = read_rdf(payload.content, payload.format)
    return map_ontology(graph, fmt, types=payload.types, lang=payload.lang, name=payload.name)


class OntologyImportManager:
    """Stateless. The session is the first argument of every method."""

    store = ModelStore()

    async def import_ontology(
        self, session: AsyncSession, *, graph_id: str, payload: OntologyImportRequest
    ) -> OntologyImport:
        export, report = await asyncio.to_thread(_read, payload)
        artefact = ModelArtefact(
            package_id=str(uuid.uuid4()),
            content_hash=compute_content_hash(export),
            name=export.schema_name,
            description=export.schema_description,
            model=export,
        )
        imported = OntologyImport(export=export, report=report, artefact=artefact)
        if payload.dry_run:
            return imported
        imported.model, imported.version_id = await import_artefact(
            session, self.store, graph_id=graph_id, artefact=artefact, import_source=IMPORT_SOURCE
        )
        return imported
