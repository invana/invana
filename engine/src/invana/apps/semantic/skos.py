"""A SKOS concept scheme → a standard's terms.

Pure: an rdflib graph in, the terms and an import report out
(docs/for-developers/modules/bring-data-in/features/skos-import.md). A top
concept with narrower ones is a **term** whose **values** are all its
descendants; leaf top concepts are the values of one term named after the
scheme. ``skos:notation`` is a value's code (the IRI's local name when there is
none), ``skos:prefLabel`` its label, and its ``broader`` names the code of the
value above it. Every term and value keeps its source IRI.

Usage::

    graph, fmt = read_rdf(text)
    mapped = map_skos(graph, fmt, scheme=None, lang="en")
    mapped.terms, mapped.report, mapped.slug
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, SKOS

from invana.apps.semantic.reader import RdfFormat, comment, label, local_name, pick_literal, slug, uris
from invana.apps.semantic.schemas import NoteList, SkosReport
from invana.core.errors import ValidationError

SKOSXL = Namespace("http://www.w3.org/2008/05/skos-xl#")

#: Read and listed in the report, never imported — a standard has no links or synonyms.
_NOT_IMPORTED = {
    SKOS.related: "skos:related",
    SKOS.exactMatch: "skos:exactMatch",
    SKOS.closeMatch: "skos:closeMatch",
    SKOS.broadMatch: "skos:broadMatch",
    SKOS.narrowMatch: "skos:narrowMatch",
    SKOS.relatedMatch: "skos:relatedMatch",
    SKOS.altLabel: "skos:altLabel",
    SKOS.hiddenLabel: "skos:hiddenLabel",
    SKOSXL.prefLabel: "skosxl:prefLabel",
    SKOSXL.altLabel: "skosxl:altLabel",
}


@dataclass
class SkosMapping:
    scheme_iri: str | None
    title: str
    description: str
    #: The scheme as a standard's ``name``.
    slug: str
    #: The stored form ``normalise_terms`` accepts.
    terms: list[dict[str, Any]]
    report: SkosReport


def map_skos(graph: Graph, fmt: RdfFormat, *, scheme: str | None, lang: str) -> SkosMapping:
    """Map one concept scheme. Raises ``ValidationError`` when there is nothing to map."""
    skipped, notes = NoteList(), NoteList()
    schemes = uris(graph.subjects(RDF.type, SKOS.ConceptScheme))
    concepts = set(uris(graph.subjects(RDF.type, SKOS.Concept)))
    concepts |= set(uris(graph.subjects(SKOS.inScheme, None))) | set(uris(graph.subjects(SKOS.topConceptOf, None)))
    concepts |= set(uris(graph.objects(None, SKOS.hasTopConcept)))
    concepts -= set(schemes)
    if not concepts:
        raise ValidationError("The file holds no SKOS concepts.")

    chosen = _choose_scheme(graph, schemes, scheme)
    members = _members(graph, concepts, chosen, single=len(schemes) <= 1)
    for other in sorted(concepts - members, key=str):
        skipped.add(subject=local_name(other), iri=str(other), kind="other_scheme", message="Not in the chosen scheme.")
    if not members:
        raise ValidationError(f"The scheme {chosen} holds no concepts.")

    title = (label(graph, chosen, lang) if chosen else None) or (local_name(chosen) if chosen else "Vocabulary")
    description = comment(graph, chosen, lang) if chosen else ""
    codes = {c: _code(graph, c) for c in members}

    parents: dict[URIRef, URIRef] = {}
    for concept in sorted(members, key=lambda c: codes[c]):
        above = set(uris(graph.objects(concept, SKOS.broader))) | set(uris(graph.subjects(SKOS.narrower, concept)))
        above = sorted(above & members, key=lambda c: codes[c])
        if not above:
            continue
        parents[concept] = above[0]
        if len(above) > 1:
            notes.add(
                subject=codes[concept],
                iri=str(concept),
                kind="polyhierarchy",
                message=f"Under {', '.join(codes[a] for a in above)}; placed under {codes[above[0]]}.",
            )

    declared = set()
    if chosen is not None:
        declared = set(uris(graph.objects(chosen, SKOS.hasTopConcept))) | set(
            uris(graph.subjects(SKOS.topConceptOf, chosen))
        )
    tops = sorted((declared & members) or {c for c in members if c not in parents}, key=lambda c: codes[c])
    children: dict[URIRef, list[URIRef]] = {}
    for concept, parent in parents.items():
        if concept not in tops:
            children.setdefault(parent, []).append(concept)
    for kids in children.values():
        kids.sort(key=lambda c: codes[c])

    terms: list[dict[str, Any]] = []
    placed: set[URIRef] = set(tops)
    leaves = [t for t in tops if not children.get(t)]
    if leaves:
        leaf_values = [_value(graph, c, codes[c], None, lang) for c in leaves]
        terms.append(_term(title, description, str(chosen) if chosen else None, leaf_values))
    for top in (t for t in tops if children.get(t)):
        values: list[dict[str, Any]] = []
        seen_codes: set[str] = set()
        stack = [(kid, None) for kid in reversed(children[top])]
        while stack:
            concept, parent = stack.pop()
            if concept in placed:
                notes.add(subject=codes[concept], iri=str(concept), kind="cycle", message="Reached twice; kept once.")
                continue
            placed.add(concept)
            code = codes[concept]
            if code in seen_codes:
                skipped.add(
                    subject=code, iri=str(concept), kind="duplicate_code", message="Another value has this code."
                )
            else:
                seen_codes.add(code)
                values.append(_value(graph, concept, code, codes[parent] if parent else None, lang))
            stack.extend((kid, concept) for kid in reversed(children.get(concept, [])))
        name = label(graph, top, lang) or local_name(top)
        terms.append(_term(name, comment(graph, top, lang), str(top), values))

    for concept in sorted(members - placed, key=lambda c: codes[c]):
        skipped.add(subject=codes[concept], iri=str(concept), kind="unreached", message="Not under a top concept.")
    _dedupe_term_names(terms, notes)
    _list_not_imported(graph, members, skipped)

    report = SkosReport(
        format=fmt,
        triples=len(graph),
        mapped={"terms": len(terms), "values": sum(len(t["values"]) for t in terms)},
        skipped=skipped.items,
        skipped_count=skipped.count,
        notes=notes.items,
        notes_count=notes.count,
    )
    return SkosMapping(
        scheme_iri=str(chosen) if chosen else None,
        title=title,
        description=description,
        slug=slug(title),
        terms=terms,
        report=report,
    )


def _choose_scheme(graph: Graph, schemes: list[URIRef], scheme: str | None) -> URIRef | None:
    if scheme:
        wanted = URIRef(scheme.strip())
        known = set(schemes) | set(uris(graph.objects(None, SKOS.inScheme)))
        if wanted not in known:
            listed = ", ".join(str(s) for s in schemes) or "none"
            raise ValidationError(f"No concept scheme {scheme} in the file. Schemes: {listed}.")
        return wanted
    if len(schemes) > 1:
        listed = ", ".join(str(s) for s in schemes)
        raise ValidationError(f"The file holds {len(schemes)} concept schemes; name one with scheme: {listed}.")
    return schemes[0] if schemes else None


def _members(graph: Graph, concepts: set[URIRef], chosen: URIRef | None, *, single: bool) -> set[URIRef]:
    if chosen is None:
        return set(concepts)
    out = set(uris(graph.subjects(SKOS.inScheme, chosen))) | set(uris(graph.subjects(SKOS.topConceptOf, chosen)))
    out |= set(uris(graph.objects(chosen, SKOS.hasTopConcept)))
    if single:
        out |= {c for c in concepts if (c, SKOS.inScheme, None) not in graph}
    return out & concepts


def _code(graph: Graph, concept: URIRef) -> str:
    notation = sorted(str(n).strip() for n in graph.objects(concept, SKOS.notation) if str(n).strip())
    return notation[0] if notation else local_name(concept)


def _value(graph: Graph, concept: URIRef, code: str, broader: str | None, lang: str) -> dict[str, Any]:
    value: dict[str, Any] = {"code": code}
    text = pick_literal(list(graph.objects(concept, SKOS.prefLabel)), lang) or label(graph, concept, lang)
    if text and text != code:
        value["label"] = text
    value["iri"] = str(concept)
    if broader:
        value["broader"] = broader
    return value


def _term(name: str, description: str, iri: str | None, values: list[dict[str, Any]]) -> dict[str, Any]:
    term: dict[str, Any] = {"name": name, "type": "text", "required": False, "values": values}
    if description:
        term["description"] = description
    if iri:
        term["iri"] = iri
    return term


def _dedupe_term_names(terms: list[dict[str, Any]], notes: NoteList) -> None:
    seen: set[str] = set()
    for term in terms:
        name, n = term["name"], 2
        while term["name"] in seen:
            term["name"] = f"{name} ({n})"
            n += 1
        if term["name"] != name:
            notes.add(
                subject=name, iri=term.get("iri"), kind="renamed", message=f"Named twice; this one is {term['name']!r}."
            )
        seen.add(term["name"])


def _list_not_imported(graph: Graph, members: set[URIRef], skipped: NoteList) -> None:
    for predicate, name in _NOT_IMPORTED.items():
        count = sum(1 for s, _, _ in graph.triples((None, predicate, None)) if s in members)
        if count:
            skipped.add(
                subject=name, kind="not_imported", message=f"{count} statement(s) — a standard holds no {name}."
            )
    collections = len(
        set(graph.subjects(RDF.type, SKOS.Collection)) | set(graph.subjects(RDF.type, SKOS.OrderedCollection))
    )
    if collections:
        skipped.add(subject="skos:Collection", kind="not_imported", message=f"{collections} collection(s).")
