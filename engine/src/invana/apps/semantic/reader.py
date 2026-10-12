"""Reading RDF text — JSON-LD, Turtle, RDF/XML — into an rdflib graph.

The engine **never fetches**: the text arrives in the request, and a JSON-LD
document that names a remote ``@context`` is refused before rdflib could go and
get it. The format is the caller's, or detected from the first character —
``{``/``[`` JSON-LD, ``<`` RDF/XML, anything else Turtle. A parse error is a
``ValidationError`` naming the format, so the API answers 422 and the CLI prints
the reason.

Usage::

    graph, fmt = read_rdf(text)                  # raises ValidationError
    label(graph, iri, lang="en")                 # "Person"
    local_name(URIRef("https://schema.org/Person"))  # "Person"
    identifier("date of birth", style="snake")   # "date_of_birth"
"""

from __future__ import annotations

import enum
import json
import re
from typing import Any

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import DCTERMS, RDFS, SKOS
from rdflib.term import Node

from invana.core.errors import ValidationError

#: The most text one import reads — schema.org's full JSON-LD is under a fifth of it.
MAX_CONTENT_CHARS = 20_000_000
#: Kept per list in an import report; the count beside it is the whole.
MAX_LISTED = 200


class RdfFormat(enum.StrEnum):
    turtle = "turtle"
    json_ld = "json-ld"
    rdf_xml = "rdf-xml"


_RDFLIB_FORMAT = {RdfFormat.turtle: "turtle", RdfFormat.json_ld: "json-ld", RdfFormat.rdf_xml: "xml"}
_LABEL = {RdfFormat.turtle: "Turtle", RdfFormat.json_ld: "JSON-LD", RdfFormat.rdf_xml: "RDF/XML"}


def detect_format(content: str) -> RdfFormat:
    head = content.lstrip("﻿ \t\r\n")[:1]
    if head in ("{", "["):
        return RdfFormat.json_ld
    if head == "<":
        return RdfFormat.rdf_xml
    return RdfFormat.turtle


def read_rdf(content: str, fmt: RdfFormat | None = None) -> tuple[Graph, RdfFormat]:
    """Parse *content* — the format given, or detected. Raises ``ValidationError``."""
    if not content or not content.strip():
        raise ValidationError("The file is empty.")
    if len(content) > MAX_CONTENT_CHARS:
        raise ValidationError(f"The file is over {MAX_CONTENT_CHARS // 1_000_000} MB of text; split it or pick less.")
    fmt = fmt or detect_format(content)
    if fmt == RdfFormat.json_ld:
        _refuse_remote_context(content)
    graph = Graph()
    try:
        graph.parse(data=content, format=_RDFLIB_FORMAT[fmt])
    except Exception as exc:  # rdflib raises a different type per parser
        reason = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
        raise ValidationError(f"Could not read the file as {_LABEL[fmt]}: {reason[:300]}") from None
    if len(graph) == 0:
        raise ValidationError(f"The file reads as {_LABEL[fmt]} but holds no statements.")
    return graph, fmt


def _refuse_remote_context(content: str) -> None:
    """A string ``@context`` (or ``@import``) is a URL rdflib would fetch — refused."""
    try:
        document = json.loads(content)
    except ValueError as exc:
        raise ValidationError(f"Could not read the file as JSON-LD: {exc}") from None
    remote = _remote_contexts(document)
    if remote:
        raise ValidationError(
            f"The JSON-LD names a remote @context ({remote[0]}). Invana never fetches one — inline the context."
        )


def _remote_contexts(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("@context", "@import"):
                found.extend(_context_urls(item))
            found.extend(_remote_contexts(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_remote_contexts(item))
    return found


def _context_urls(context: Any) -> list[str]:
    if isinstance(context, str):
        return [context]
    if isinstance(context, list):
        return [c for c in context if isinstance(c, str)]
    if isinstance(context, dict) and isinstance(context.get("@import"), str):
        return [context["@import"]]
    return []


# ── reading one resource ────────────────────────────────────────────────────


def local_name(iri: Node) -> str:
    """The part of an IRI after its last ``#`` or ``/``."""
    text = str(iri).rstrip("/#")
    for sep in ("#", "/", ":"):
        if sep in text:
            text = text.rsplit(sep, 1)[1]
            break
    return text or str(iri)


def pick_literal(values: list[Node], lang: str) -> str | None:
    """The asked language, then untagged, then a regional variant, then any — deterministic."""
    literals = sorted((v for v in values if isinstance(v, Literal)), key=lambda v: (v.language or "", str(v)))
    if not literals:
        return None
    for test in (
        lambda v: v.language == lang,
        lambda v: v.language is None,
        lambda v: bool(v.language) and v.language.split("-")[0] == lang,
    ):
        hit = next((v for v in literals if test(v)), None)
        if hit is not None:
            return str(hit).strip()
    return str(literals[0]).strip()


def label(graph: Graph, iri: Node, lang: str) -> str | None:
    """``skos:prefLabel``, else ``rdfs:label``, else ``dcterms:title``."""
    for predicate in (SKOS.prefLabel, RDFS.label, DCTERMS.title):
        text = pick_literal(list(graph.objects(iri, predicate)), lang)
        if text:
            return text
    return None


def comment(graph: Graph, iri: Node, lang: str) -> str:
    """``skos:definition``, else ``rdfs:comment``, else ``dcterms:description``."""
    for predicate in (SKOS.definition, RDFS.comment, DCTERMS.description):
        text = pick_literal(list(graph.objects(iri, predicate)), lang)
        if text:
            return text
    return ""


def uris(nodes) -> list[URIRef]:
    """The IRIs among *nodes*, sorted — blank nodes and literals dropped."""
    return sorted({n for n in nodes if isinstance(n, URIRef)}, key=str)


_WORDS = re.compile(r"[A-Za-z0-9]+")


def identifier(text: str, *, style: str) -> str:
    """*text* as a name a model can use: ``pascal`` for a type, ``snake`` for a property.

    A single word keeps its case (``birthDate`` stays ``birthDate``); several are
    joined in the style. A leading digit gets a ``_``.
    """
    words = _WORDS.findall(text)
    if not words:
        return "_"
    if len(words) == 1:
        name = words[0]
        if style == "pascal":
            name = name[0].upper() + name[1:]
    elif style == "pascal":
        name = "".join(w[0].upper() + w[1:] for w in words)
    else:
        name = "_".join(w.lower() for w in words)
    return f"_{name}" if name[0].isdigit() else name


def slug(text: str) -> str:
    """*text* as a standard's ``name`` — lower, hyphens, at most 63 characters."""
    out = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:63].strip("-")
    return out or "vocabulary"
