"""SKOS import — a concept scheme becomes a standard.

One positive path (a hierarchical scheme previewed, imported as v1 with codes,
labels, hierarchy and source IRIs, then re-imported unchanged — and the same
vocabulary in RDF/XML maps to the same terms) and one negative case for its
refusals (several schemes with none named, a remote JSON-LD context, someone
else's standard).
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.semantic.reader import read_rdf
from invana.apps.semantic.skos import map_skos
from invana.apps.standards.managers import SkosImportManager, StandardManager
from invana.apps.standards.schemas import SkosImportRequest
from invana.apps.standards.terms import normalise_terms, terms_hash
from invana.core.auth.models import User
from invana.core.errors import PermissionDeniedError, ValidationError

skos = SkosImportManager()
standards = StandardManager()

STAGES = """
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex: <http://example.org/stages#> .
ex:scheme a skos:ConceptScheme ; skos:prefLabel "Growth stages"@en ; skos:hasTopConcept ex:veg, ex:rep .
ex:veg a skos:Concept ; skos:prefLabel "Vegetative"@en ; skos:notation "V" ; skos:inScheme ex:scheme .
ex:rep a skos:Concept ; skos:prefLabel "Reproductive"@en ; skos:inScheme ex:scheme ; skos:narrower ex:flower .
ex:flower a skos:Concept ; skos:prefLabel "Flowering"@en ; skos:notation "R1" ; skos:inScheme ex:scheme .
ex:pod a skos:Concept ; skos:prefLabel "Pod"@en ; skos:notation "R2" ; skos:broader ex:flower ;
  skos:inScheme ex:scheme ; skos:related ex:veg .
"""

STAGES_XML = """<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
  <skos:ConceptScheme rdf:about="http://example.org/stages#scheme">
    <skos:prefLabel xml:lang="en">Growth stages</skos:prefLabel>
    <skos:hasTopConcept rdf:resource="http://example.org/stages#veg"/>
    <skos:hasTopConcept rdf:resource="http://example.org/stages#rep"/>
  </skos:ConceptScheme>
  <skos:Concept rdf:about="http://example.org/stages#veg">
    <skos:prefLabel xml:lang="en">Vegetative</skos:prefLabel><skos:notation>V</skos:notation>
    <skos:inScheme rdf:resource="http://example.org/stages#scheme"/>
  </skos:Concept>
  <skos:Concept rdf:about="http://example.org/stages#rep">
    <skos:prefLabel xml:lang="en">Reproductive</skos:prefLabel>
    <skos:inScheme rdf:resource="http://example.org/stages#scheme"/>
    <skos:narrower rdf:resource="http://example.org/stages#flower"/>
  </skos:Concept>
  <skos:Concept rdf:about="http://example.org/stages#flower">
    <skos:prefLabel xml:lang="en">Flowering</skos:prefLabel><skos:notation>R1</skos:notation>
    <skos:inScheme rdf:resource="http://example.org/stages#scheme"/>
  </skos:Concept>
  <skos:Concept rdf:about="http://example.org/stages#pod">
    <skos:prefLabel xml:lang="en">Pod</skos:prefLabel><skos:notation>R2</skos:notation>
    <skos:broader rdf:resource="http://example.org/stages#flower"/>
    <skos:inScheme rdf:resource="http://example.org/stages#scheme"/>
  </skos:Concept>
</rdf:RDF>
"""


@pytest.mark.asyncio
async def test_a_scheme_previews_imports_and_reimports_unchanged(session: AsyncSession, user: User):
    preview = await skos.import_skos(session, payload=SkosImportRequest(content=STAGES, dry_run=True), actor=user)
    assert preview.address == "owner/growth-stages"
    assert preview.standard is None
    assert await standards.standards_qs.get_by_address(session, publisher="owner", name="growth-stages") is None

    result = await skos.import_skos(session, payload=SkosImportRequest(content=STAGES), actor=user)
    assert result.version is not None and result.version.version == 1
    scheme_term, stages = result.terms
    assert scheme_term.name == "Growth stages" and [v.code for v in scheme_term.values] == ["V"]
    assert stages.name == "Reproductive" and stages.iri == "http://example.org/stages#rep"
    assert [(v.code, v.label, v.broader) for v in stages.values] == [("R1", "Flowering", None), ("R2", "Pod", "R1")]
    assert result.report.mapped == {"terms": 2, "values": 3}
    assert [n.subject for n in result.report.skipped] == ["skos:related"]

    again = await skos.import_skos(session, payload=SkosImportRequest(content=STAGES), actor=user)
    assert again.unchanged and again.version is None

    graph, fmt = read_rdf(STAGES_XML)
    assert fmt == "rdf-xml"
    from_xml = map_skos(graph, fmt, scheme=None, lang="en")
    assert terms_hash(normalise_terms(from_xml.terms)) == result.version.content_hash


@pytest.mark.asyncio
async def test_the_refusals(session: AsyncSession, user: User):
    two = STAGES + "\n<http://example.org/other> a skos:ConceptScheme .\n"
    with pytest.raises(ValidationError, match="2 concept schemes"):
        await skos.import_skos(session, payload=SkosImportRequest(content=two), actor=user)

    remote = '{"@context": "https://www.w3.org/2009/08/skos-reference/context.jsonld", "@id": "x"}'
    with pytest.raises(ValidationError, match="remote @context"):
        await skos.import_skos(session, payload=SkosImportRequest(content=remote), actor=user)

    await skos.import_skos(session, payload=SkosImportRequest(content=STAGES), actor=user)
    other = User(email="other@example.com", username="other", password_hash="x", first_name="Other")
    session.add(other)
    await session.flush()
    changed = STAGES.replace('"Pod"@en', '"Pod set"@en')
    with pytest.raises(PermissionDeniedError):
        await skos.import_skos(session, payload=SkosImportRequest(content=changed, publisher="owner"), actor=other)
