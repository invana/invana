"""Ontology import — an RDFS / OWL ontology becomes a draft model.

One positive path for OWL (a picked type, flattened, bringing its ranges, with
restrictions and characteristics skipped, equivalence suggested and every
source IRI kept on the draft), one for schema.org's vocabulary in JSON-LD
(``domainIncludes`` / ``rangeIncludes``, datatypes as properties, a mixed range
as an edge), and one negative case for the refusals.
"""

from __future__ import annotations

import json

import pytest

from invana.apps.modeller.json_io import SchemaExporter
from invana.apps.modeller.portability import ImportRefused, canonical_body
from invana.apps.modeller.schemas import NodeTypeCreate, SchemaExport
from invana.apps.semantic.managers import OntologyImportManager
from invana.apps.semantic.schemas import OntologyImportRequest
from invana.core.errors import ValidationError

ontologies = OntologyImportManager()

PLANTS = """
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/plants#> .
ex: a owl:Ontology ; rdfs:label "Plants" .
ex:Organism a owl:Class .
ex:Plant a owl:Class ; rdfs:subClassOf ex:Organism ; owl:equivalentClass ex:Planta ;
  rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:grownAt ; owl:someValuesFrom ex:Site ] .
ex:Site a owl:Class .
ex:Gene a owl:Class .
ex:name a owl:DatatypeProperty ; rdfs:domain ex:Organism ; rdfs:range xsd:string .
ex:height a owl:DatatypeProperty ; rdfs:domain ex:Plant ; rdfs:range xsd:decimal .
ex:grownAt a owl:ObjectProperty, owl:FunctionalProperty ; rdfs:domain ex:Plant ; rdfs:range ex:Site .
"""

SCHEMA_ORG = json.dumps(
    {
        "@context": {
            "schema": "https://schema.org/",
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "rdfs:subClassOf": {"@type": "@id"},
            "schema:domainIncludes": {"@type": "@id"},
            "schema:rangeIncludes": {"@type": "@id"},
        },
        "@graph": [
            {"@id": "schema:Thing", "@type": "rdfs:Class", "rdfs:label": "Thing"},
            {"@id": "schema:Person", "@type": "rdfs:Class", "rdfs:subClassOf": "schema:Thing"},
            {"@id": "schema:ImageObject", "@type": "rdfs:Class", "rdfs:subClassOf": "schema:Thing"},
            {"@id": "schema:Text", "@type": ["schema:DataType", "rdfs:Class"]},
            {"@id": "schema:Date", "@type": ["schema:DataType", "rdfs:Class"]},
            {"@id": "schema:URL", "@type": "rdfs:Class", "rdfs:subClassOf": "schema:Text"},
            {
                "@id": "schema:name",
                "@type": "rdf:Property",
                "schema:domainIncludes": "schema:Thing",
                "schema:rangeIncludes": "schema:Text",
            },
            {
                "@id": "schema:birthDate",
                "@type": "rdf:Property",
                "schema:domainIncludes": "schema:Person",
                "schema:rangeIncludes": "schema:Date",
            },
            {
                "@id": "schema:image",
                "@type": "rdf:Property",
                "schema:domainIncludes": "schema:Thing",
                "schema:rangeIncludes": ["schema:ImageObject", "schema:URL"],
            },
        ],
    }
)


@pytest.mark.asyncio
async def test_an_owl_ontology_lands_as_a_flattened_draft(session, store):
    payload = OntologyImportRequest(content=PLANTS, types=["Plant"], dry_run=True)
    preview = await ontologies.import_ontology(session, graph_id=None, payload=payload)
    assert preview.model is None

    payload = OntologyImportRequest(content=PLANTS, types=["Plant"])
    imported = await ontologies.import_ontology(session, graph_id=None, payload=payload)
    await session.commit()
    assert imported.model.name == "Plants" and imported.model.import_source == "ontology"

    draft = await store.get_version(session, imported.version_id)
    assert draft.status == "draft"
    assert {nt.name for nt in draft.node_types} == {"Plant", "Site"}
    plant = next(nt for nt in draft.node_types if nt.name == "Plant")
    assert plant.parent_type is None and plant.source_iri == "http://example.org/plants#Plant"
    assert sorted(m.property_key.name for m in plant.property_mappings) == ["height", "name"]
    assert {pk.name: pk.type for pk in draft.property_keys} == {"height": "float", "name": "string"}
    assert {pk.source_iri for pk in draft.property_keys} == {
        "http://example.org/plants#height",
        "http://example.org/plants#name",
    }
    (edge,) = draft.edge_types
    assert (edge.name, edge.source_node_types, edge.target_node_types) == ("grownAt", ["Plant"], ["Site"])

    report = imported.report
    site = next(t for t in report.types if t.name == "Site")
    assert site.came_with == "Plant.grownAt"
    assert [(i.property, i.from_type) for i in next(t for t in report.types if t.name == "Plant").inherited] == [
        ("name", "Organism")
    ]
    assert {n.kind for n in report.skipped} == {"restriction", "characteristic"}
    assert [(s.kind, s.target_iri) for s in report.suggestions] == [
        ("equivalent_class", "http://example.org/plants#Planta")
    ]

    exported = SchemaExporter.export(draft, schema_name="Plants")
    assert next(nt for nt in exported.node_types if nt.name == "Plant").source_iri.endswith("#Plant")
    # A shape that never had an IRI hashes as it did before the column existed.
    plain = SchemaExport(schema_name="x", node_types=[NodeTypeCreate(name="A")])
    assert "source_iri" not in json.dumps(canonical_body(plain))


@pytest.mark.asyncio
async def test_schema_org_reads_includes_datatypes_and_mixed_ranges(session):
    payload = OntologyImportRequest(content=SCHEMA_ORG, types=["Person"], dry_run=True)
    imported = await ontologies.import_ontology(session, graph_id=None, payload=payload)
    export, report = imported.export, imported.report

    assert export.schema_name == "schema.org"
    assert {nt.name for nt in export.node_types} == {"Person", "ImageObject"}
    assert {pk.name: pk.type for pk in export.property_keys} == {"birthDate": "date", "name": "string"}
    (image,) = export.edge_types
    assert image.source_node_types == ["ImageObject", "Person"] and image.target_node_types == ["ImageObject"]
    assert "literal_ranges_dropped" in {n.kind for n in report.notes}
    assert next(t for t in report.types if t.name == "ImageObject").came_with == "Person.image"


@pytest.mark.asyncio
async def test_the_refusals(session):
    with pytest.raises(ValidationError, match="No class named 'Tree'"):
        await ontologies.import_ontology(
            session, graph_id=None, payload=OntologyImportRequest(content=PLANTS, types=["Tree"])
        )
    with pytest.raises(ValidationError, match="as Turtle"):
        await ontologies.import_ontology(
            session, graph_id=None, payload=OntologyImportRequest(content="ex:Plant a owl:Class")
        )

    await ontologies.import_ontology(session, graph_id=None, payload=OntologyImportRequest(content=PLANTS))
    with pytest.raises(ImportRefused) as exc:
        await ontologies.import_ontology(session, graph_id=None, payload=OntologyImportRequest(content=PLANTS))
    assert exc.value.error == "model_name_taken"
