"""An RDFS / OWL ontology — schema.org included — → a draft model's shape.

Pure: an rdflib graph in, a ``SchemaExport`` and an import report out
(docs/for-developers/modules/connect-and-model/features/ontology-import.md).

=================================  ==============================================
ontology                           draft model
=================================  ==============================================
``owl:Class`` · ``rdfs:Class``     node type (a datatype class is not one)
property with literal ranges       property key, mapped on every domain type
property with a class range        edge type, domain → range
``rdfs:subClassOf``                flattened — ancestors' properties are the type's
``owl:sameAs`` · equivalence       a stitch suggestion, never a stitch
restrictions, characteristics …    skipped and listed
=================================  ==============================================

Picked types bring the class ranges of their own properties in, one level deep;
nothing else is pulled. Everything is sorted by IRI or name, so the same file
and the same pick always produce the same draft and the same content hash.

Usage::

    graph, fmt = read_rdf(text)
    export, report = map_ontology(graph, fmt, types=["Person"], lang="en", name=None)
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from rdflib import BNode, Graph, Namespace, URIRef
from rdflib.collection import Collection
from rdflib.namespace import OWL, RDF, RDFS, XSD
from rdflib.term import Node

from invana.apps.modeller.schemas import (
    EdgeTypeCreate,
    NodeTypeCreate,
    PropertyKeyCreate,
    SchemaExport,
    TypePropertyMappingCreate,
)
from invana.apps.semantic.reader import RdfFormat, comment, identifier, label, local_name, uris
from invana.apps.semantic.schemas import (
    InheritedProperty,
    MappedType,
    NoteList,
    OntologyReport,
    StitchSuggestion,
)
from invana.core.errors import ValidationError

#: The most node types one import creates; above it, pick types.
MAX_TYPES = 500

SCHEMA_NS = (Namespace("http://schema.org/"), Namespace("https://schema.org/"))
_BUILTIN = (str(RDF), str(RDFS), str(OWL), str(XSD))

_XSD = {
    **dict.fromkeys(
        ("string", "normalizedString", "token", "language", "anyURI", "Name", "NCName", "NMTOKEN", "QName"), "string"
    ),
    **dict.fromkeys(
        (
            "integer",
            "int",
            "long",
            "short",
            "byte",
            "nonNegativeInteger",
            "positiveInteger",
            "negativeInteger",
            "nonPositiveInteger",
            "unsignedLong",
            "unsignedInt",
            "unsignedShort",
            "unsignedByte",
        ),
        "integer",
    ),
    **dict.fromkeys(("decimal", "float", "double"), "float"),
    "boolean": "boolean",
    "date": "date",
    "dateTime": "datetime",
    "dateTimeStamp": "datetime",
    "time": "time",
    **dict.fromkeys(("duration", "dayTimeDuration", "yearMonthDuration"), "duration"),
}
_SCHEMA_DATATYPES = {
    **dict.fromkeys(("Text", "URL", "CssSelectorType", "XPathType", "PronounceableText", "DataType"), "string"),
    **dict.fromkeys(("Number", "Float"), "float"),
    "Integer": "integer",
    "Boolean": "boolean",
    "Date": "date",
    "DateTime": "datetime",
    "Time": "time",
}
_LITERALS = {RDFS.Literal, RDF.langString, RDF.PlainLiteral, RDF.HTML, RDF.XMLLiteral}

_CHARACTERISTICS = {
    OWL.FunctionalProperty: "functional",
    OWL.InverseFunctionalProperty: "inverse functional",
    OWL.TransitiveProperty: "transitive",
    OWL.SymmetricProperty: "symmetric",
    OWL.AsymmetricProperty: "asymmetric",
    OWL.ReflexiveProperty: "reflexive",
    OWL.IrreflexiveProperty: "irreflexive",
}
_PROPERTY_AXIOMS = {
    OWL.inverseOf: "owl:inverseOf",
    RDFS.subPropertyOf: "rdfs:subPropertyOf",
    OWL.propertyChainAxiom: "owl:propertyChainAxiom",
}
_CLASS_EXPRESSIONS = {
    OWL.intersectionOf: "owl:intersectionOf",
    OWL.unionOf: "owl:unionOf",
    OWL.complementOf: "owl:complementOf",
    OWL.oneOf: "owl:oneOf",
}


def _schema(local: str) -> set[URIRef]:
    return {ns[local] for ns in SCHEMA_NS}


def _builtin(iri: Node) -> bool:
    return str(iri).startswith(_BUILTIN)


@dataclass
class _Property:
    iri: URIRef
    name: str = ""
    domains: list[URIRef] = field(default_factory=list)
    class_ranges: list[URIRef] = field(default_factory=list)
    literal_ranges: list[URIRef] = field(default_factory=list)
    other_ranges: list[URIRef] = field(default_factory=list)
    declared: str = "any"  # "datatype" · "object" · "any"


class _Ontology:
    """The classes and properties of one graph, with the hierarchy precomputed."""

    def __init__(self, graph: Graph, lang: str, skipped: NoteList, notes: NoteList) -> None:
        self.graph, self.lang, self.skipped, self.notes = graph, lang, skipped, notes
        self.datatypes = self._datatypes()
        candidates = set(uris(graph.subjects(RDF.type, OWL.Class))) | set(uris(graph.subjects(RDF.type, RDFS.Class)))
        candidates |= set(uris(graph.subjects(RDFS.subClassOf, None))) | set(uris(graph.objects(None, RDFS.subClassOf)))
        self.classes = sorted((c for c in candidates if not _builtin(c) and c not in self.datatypes), key=str)
        known = set(self.classes)
        self.parents = {
            c: [p for p in uris(graph.objects(c, RDFS.subClassOf)) if p in known and p != c] for c in self.classes
        }
        self.ancestors = {c: self._ancestors(c) for c in self.classes}
        self.names = _unique(
            {c: identifier(label(graph, c, lang) or local_name(c), style="pascal") for c in self.classes}, notes, "type"
        )
        self.properties = self._properties(known)

    def _datatypes(self) -> set[URIRef]:
        graph = self.graph
        out = {iri for local in _SCHEMA_DATATYPES for iri in _schema(local)}
        out |= set(uris(graph.subjects(RDF.type, RDFS.Datatype)))
        for data_type in _schema("DataType"):
            out |= set(uris(graph.subjects(RDF.type, data_type)))
        grew = True
        while grew:
            more = {s for d in out for s in uris(graph.subjects(RDFS.subClassOf, d))} - out
            grew = bool(more)
            out |= more
        return out

    def _ancestors(self, cls: URIRef) -> list[URIRef]:
        """Self first, then ancestors nearest first — breadth first, cycle safe."""
        order, seen, queue = [], {cls}, deque([cls])
        while queue:
            current = queue.popleft()
            order.append(current)
            for parent in self.parents.get(current, []):
                if parent not in seen:
                    seen.add(parent)
                    queue.append(parent)
        return order

    def _expand(self, nodes) -> list[Node]:
        """Read an ``owl:unionOf`` list as its members; anything else as itself."""
        out: list[Node] = []
        for node in nodes:
            union = self.graph.value(node, OWL.unionOf) if isinstance(node, BNode) else None
            if union is not None:
                out.extend(Collection(self.graph, union))
            else:
                out.append(node)
        return out

    def _properties(self, known: set[URIRef]) -> list[_Property]:
        graph = self.graph
        declared_datatype = set(uris(graph.subjects(RDF.type, OWL.DatatypeProperty)))
        declared_object = set(uris(graph.subjects(RDF.type, OWL.ObjectProperty)))
        annotation = set(uris(graph.subjects(RDF.type, OWL.AnnotationProperty)))
        domain_predicates = [RDFS.domain, *(ns.domainIncludes for ns in SCHEMA_NS)]
        range_predicates = [RDFS.range, *(ns.rangeIncludes for ns in SCHEMA_NS)]
        iris = declared_datatype | declared_object | set(uris(graph.subjects(RDF.type, RDF.Property)))
        for predicate in (*domain_predicates, *range_predicates):
            iris |= set(uris(graph.subjects(predicate, None)))
        iris = {p for p in iris if not _builtin(p) and p not in annotation}
        if annotation:
            self.skipped.add(
                subject="owl:AnnotationProperty",
                kind="annotation_property",
                message=f"{len(annotation)} annotation propert(ies) — not part of a model.",
            )

        out: list[_Property] = []
        for iri in sorted(iris, key=str):
            prop = _Property(iri=iri)
            prop.declared = "datatype" if iri in declared_datatype else "object" if iri in declared_object else "any"
            domains = self._expand(o for p in domain_predicates for o in graph.objects(iri, p))
            prop.domains = sorted({d for d in domains if isinstance(d, URIRef) and d in known}, key=str)
            for r in sorted(set(self._expand(o for p in range_predicates for o in graph.objects(iri, p))), key=str):
                if not isinstance(r, URIRef):
                    continue
                if r in known:
                    prop.class_ranges.append(r)
                elif r in self.datatypes or r in _LITERALS or str(r).startswith(str(XSD)):
                    prop.literal_ranges.append(r)
                else:
                    prop.other_ranges.append(r)
            out.append(prop)
        names = _unique(
            {p.iri: identifier(label(graph, p.iri, self.lang) or local_name(p.iri), style="snake") for p in out},
            self.notes,
            "property",
        )
        for prop in out:
            prop.name = names[prop.iri]
        return out

    def applies(self, prop: _Property, cls: URIRef) -> URIRef | None:
        """The domain through which *prop* reaches *cls* — itself or its nearest ancestor."""
        domains = set(prop.domains)
        return next((a for a in self.ancestors[cls] if a in domains), None)


def _unique(names: dict[URIRef, str], notes: NoteList, what: str) -> dict[URIRef, str]:
    """Give a clashing name ``_2``, ``_3`` … in IRI order, and say so."""
    seen: set[str] = set()
    out: dict[URIRef, str] = {}
    for iri in sorted(names, key=str):
        base, name, n = names[iri], names[iri], 2
        while name.lower() in seen:
            name = f"{base}_{n}"
            n += 1
        if name != base:
            notes.add(
                subject=base, iri=str(iri), kind="renamed", message=f"Another {what} is {base!r}; this one is {name!r}."
            )
        seen.add(name.lower())
        out[iri] = name
    return out


def _literal_type(prop: _Property, notes: NoteList) -> str:
    found: set[str] = set()
    for r in prop.literal_ranges:
        text = str(r)
        if text.startswith(str(XSD)):
            found.add(_XSD.get(local_name(r), "string"))
        elif any(text.startswith(str(ns)) for ns in SCHEMA_NS):
            found.add(_SCHEMA_DATATYPES.get(local_name(r), "string"))
        else:
            found.add("string")
    if not found:
        notes.add(subject=prop.name, iri=str(prop.iri), kind="no_range", message="No literal range; read as string.")
        return "string"
    if found == {"integer", "float"}:
        return "float"
    if len(found) > 1:
        notes.add(
            subject=prop.name,
            iri=str(prop.iri),
            kind="ranges_disagree",
            message=f"Ranges read as {', '.join(sorted(found))}; read as string.",
        )
        return "string"
    return found.pop()


def _resolve(onto: _Ontology, wanted: list[str]) -> list[URIRef]:
    """Picked names → classes, by name, local name, label or IRI, ignoring case."""
    index: dict[str, URIRef] = {}
    for cls in onto.classes:
        for key in (onto.names[cls], local_name(cls), label(onto.graph, cls, onto.lang) or "", str(cls)):
            if key:
                index.setdefault(key.lower(), cls)
    picked, unknown = [], []
    for raw in wanted:
        key = raw.strip()
        if not key:
            continue
        cls = index.get(key.lower())
        (picked if cls is not None else unknown).append(cls if cls is not None else key)
    if unknown:
        raise ValidationError(f"No class named {', '.join(repr(u) for u in unknown)} in the ontology.")
    return sorted(set(picked), key=str)


def map_ontology(
    graph: Graph, fmt: RdfFormat, *, types: list[str] | None, lang: str, name: str | None
) -> tuple[SchemaExport, OntologyReport]:
    """Map the ontology — or the picked part of it — into a draft model's shape."""
    skipped, notes = NoteList(), NoteList()
    onto = _Ontology(graph, lang, skipped, notes)
    if not onto.classes:
        raise ValidationError("The file holds no classes — nothing maps to a node type.")

    came_with: dict[URIRef, str] = {}
    if types:
        picked = _resolve(onto, types)
        chosen = set(picked)
        for cls in picked:
            for prop in onto.properties:
                if prop.declared == "datatype" or onto.applies(prop, cls) is None:
                    continue
                for target in prop.class_ranges:
                    if target not in chosen and target not in came_with:
                        came_with[target] = f"{onto.names[cls]}.{prop.name}"
        chosen |= set(came_with)
    else:
        chosen = set(onto.classes)
    if len(chosen) > MAX_TYPES:
        raise ValidationError(
            f"The import would create {len(chosen)} node types, over {MAX_TYPES}; pick the types you need."
        )
    included = sorted(chosen, key=lambda c: onto.names[c])

    keys: list[tuple[_Property, str]] = []
    edges: list[EdgeTypeCreate] = []
    edge_props: list[_Property] = []
    edge_types: list[MappedType] = []
    unreached = 0
    for prop in onto.properties:
        sources = [c for c in included if onto.applies(prop, c) is not None]
        if not prop.domains:
            skipped.add(
                subject=prop.name, iri=str(prop.iri), kind="no_domain", message="No domain — no type to put it on."
            )
            continue
        if not sources:
            unreached += 1
            continue
        targets = [c for c in included if set(onto.ancestors[c]) & set(prop.class_ranges)]
        wants_edge = prop.declared == "object" or (prop.declared == "any" and (prop.class_ranges or prop.other_ranges))
        if prop.declared != "datatype" and targets:
            if prop.literal_ranges:
                dropped = ", ".join(local_name(r) for r in prop.literal_ranges)
                notes.add(
                    subject=prop.name,
                    iri=str(prop.iri),
                    kind="literal_ranges_dropped",
                    message=f"An edge type; its literal ranges ({dropped}) are not mapped.",
                )
            edges.append(
                EdgeTypeCreate(
                    name=prop.name,
                    description=comment(graph, prop.iri, lang),
                    source_node_types=[onto.names[c] for c in sources],
                    target_node_types=[onto.names[c] for c in targets],
                    source_iri=str(prop.iri),
                )
            )
            edge_props.append(prop)
            edge_types.append(MappedType(name=prop.name, iri=str(prop.iri), kind="edge"))
        elif prop.literal_ranges or not wants_edge:
            keys.append((prop, _literal_type(prop, notes)))
        else:
            ranges = ", ".join(local_name(r) for r in (prop.class_ranges or prop.other_ranges))
            skipped.add(
                subject=prop.name,
                iri=str(prop.iri),
                kind="range_not_imported",
                message=f"Its range ({ranges}) is not in the import.",
            )
    if unreached:
        notes.add(
            subject="properties",
            kind="not_on_imported_types",
            message=f"{unreached} propert(ies) apply to no imported type.",
        )

    property_keys = [
        PropertyKeyCreate(name=p.name, type=t, description=comment(graph, p.iri, lang), source_iri=str(p.iri))
        for p, t in sorted(keys, key=lambda k: k[0].name)
    ]
    node_types: list[NodeTypeCreate] = []
    mapped_types: list[MappedType] = []
    for cls in included:
        own, inherited = [], []
        for prop, _ in keys:
            via = onto.applies(prop, cls)
            if via is None:
                continue
            (own if via == cls else inherited).append((prop.name, via))
        ordered = sorted(own) + sorted(inherited)
        node_types.append(
            NodeTypeCreate(
                name=onto.names[cls],
                description=comment(graph, cls, lang),
                property_mappings=[
                    TypePropertyMappingCreate(property_key=n, sort_order=i) for i, (n, _) in enumerate(ordered)
                ],
                source_iri=str(cls),
            )
        )
        mapped_types.append(
            MappedType(
                name=onto.names[cls],
                iri=str(cls),
                kind="node",
                came_with=came_with.get(cls),
                properties=[n for n, _ in ordered],
                inherited=[
                    InheritedProperty(property=n, from_type=onto.names.get(via, local_name(via)))
                    for n, via in sorted(inherited)
                ],
            )
        )
        _skip_class_constructs(onto, cls, skipped)
    for prop in [p for p, _ in keys] + edge_props:
        _skip_property_constructs(onto, prop, skipped)
    _skip_document_constructs(graph, skipped)

    export = SchemaExport(
        schema_name=name or _model_name(graph, included, lang),
        schema_description=_model_description(graph, lang),
        property_keys=property_keys,
        node_types=node_types,
        edge_types=edges,
    )
    report = OntologyReport(
        format=fmt,
        triples=len(graph),
        mapped={"node_types": len(node_types), "edge_types": len(edges), "property_keys": len(property_keys)},
        types=mapped_types + edge_types,
        skipped=skipped.items,
        skipped_count=skipped.count,
        notes=notes.items,
        notes_count=notes.count,
        suggestions=_suggestions(onto, included, [p for p, _ in keys] + edge_props),
    )
    return export, report


def _skip_class_constructs(onto: _Ontology, cls: URIRef, skipped: NoteList) -> None:
    graph, name = onto.graph, onto.names[cls]
    for parent in graph.objects(cls, RDFS.subClassOf):
        if isinstance(parent, BNode):
            on = graph.value(parent, OWL.onProperty)
            what = f"a restriction on {local_name(on)}" if on is not None else "a class expression"
            skipped.add(subject=name, iri=str(cls), kind="restriction", message=f"Subclass of {what} — not mapped.")
    for other in graph.objects(cls, OWL.equivalentClass):
        if isinstance(other, BNode):
            skipped.add(
                subject=name,
                iri=str(cls),
                kind="class_expression",
                message="Equivalent to a class expression — not mapped.",
            )
    for predicate, text in _CLASS_EXPRESSIONS.items():
        if (cls, predicate, None) in graph:
            skipped.add(
                subject=name,
                iri=str(cls),
                kind="class_expression",
                message=f"Defined by {text} — read as a plain class.",
            )
    disjoint = uris(graph.objects(cls, OWL.disjointWith))
    if disjoint:
        skipped.add(
            subject=name,
            iri=str(cls),
            kind="disjoint",
            message=f"Disjoint with {', '.join(local_name(d) for d in disjoint)} — not enforced.",
        )


def _skip_property_constructs(onto: _Ontology, prop: _Property, skipped: NoteList) -> None:
    graph = onto.graph
    for kind, text in _CHARACTERISTICS.items():
        if (prop.iri, RDF.type, kind) in graph:
            skipped.add(
                subject=prop.name, iri=str(prop.iri), kind="characteristic", message=f"Declared {text} — not enforced."
            )
    for predicate, text in _PROPERTY_AXIOMS.items():
        if (prop.iri, predicate, None) in graph:
            skipped.add(subject=prop.name, iri=str(prop.iri), kind="property_axiom", message=f"{text} — not mapped.")


def _skip_document_constructs(graph: Graph, skipped: NoteList) -> None:
    for imported in uris(graph.objects(None, OWL.imports)):
        skipped.add(
            subject="owl:imports",
            iri=str(imported),
            kind="imports_not_followed",
            message="Not followed — import it on its own.",
        )
    individuals = len(set(graph.subjects(RDF.type, OWL.NamedIndividual)))
    if individuals:
        skipped.add(
            subject="owl:NamedIndividual",
            kind="individuals",
            message=f"{individuals} individual(s) — records, not a model.",
        )


def _suggestions(onto: _Ontology, included: list[URIRef], mapped: list[_Property]) -> list[StitchSuggestion]:
    graph = onto.graph
    out: list[StitchSuggestion] = []
    for cls in included:
        for target in uris(graph.objects(cls, OWL.equivalentClass)):
            out.append(
                StitchSuggestion(kind="equivalent_class", name=onto.names[cls], iri=str(cls), target_iri=str(target))
            )
        for target in uris(graph.objects(cls, OWL.sameAs)):
            out.append(StitchSuggestion(kind="same_as", name=onto.names[cls], iri=str(cls), target_iri=str(target)))
    for prop in sorted(mapped, key=lambda p: p.name):
        for target in uris(graph.objects(prop.iri, OWL.equivalentProperty)):
            out.append(
                StitchSuggestion(kind="equivalent_property", name=prop.name, iri=str(prop.iri), target_iri=str(target))
            )
        for target in uris(graph.objects(prop.iri, OWL.sameAs)):
            out.append(StitchSuggestion(kind="same_as", name=prop.name, iri=str(prop.iri), target_iri=str(target)))
    return out


def _model_name(graph: Graph, included: list[URIRef], lang: str) -> str:
    for ontology in uris(graph.subjects(RDF.type, OWL.Ontology)):
        text = label(graph, ontology, lang)
        if text:
            return text[:255]
    if included and all(any(str(c).startswith(str(ns)) for ns in SCHEMA_NS) for c in included):
        return "schema.org"
    ontologies = uris(graph.subjects(RDF.type, OWL.Ontology))
    return local_name(ontologies[0])[:255] if ontologies else "Ontology"


def _model_description(graph: Graph, lang: str) -> str:
    ontologies = uris(graph.subjects(RDF.type, OWL.Ontology))
    return comment(graph, ontologies[0], lang) if ontologies else ""
