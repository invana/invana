"""Render the global model into compact schema grounding
(docs/for-developers/modules/ask/features/ask-in-natural-language.md § The grounding block).

The authored models' active versions and the Graph's active stitches become one
short text block every LLM step puts in its system prompt — this is what keeps
the model from inventing labels, what lets it map the user's words onto the
schema through the authored descriptions, and what makes every NL answer
traceable to the ontology (NL8). The versions are loaded with their type tree
eager-loaded (``ModelStore`` ``_version_eager()``), so the relationship access
here is safe.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.modeller.models import GraphVersion, ModelLink, TypePropertyMapping
from invana.apps.skills.models import Rule, Skill
from invana.graph.types.lens import QueryLens

_NO_MODEL = "No graph model is available — infer labels conservatively from the question and prefer a simple query."
#: What is said when the schema *exists* and may not cross the boundary. A
#: different sentence from ``_NO_MODEL`` on purpose: *there is no model* and
#: *this world does not let the model leave* are different facts about the
#: Graph, and the model reasons differently under each.
_NO_EGRESS = (
    "This run's world does not permit the graph's schema to accompany the call — "
    "infer labels conservatively from the question and prefer a simple query."
)
#: Invana's own bookkeeping on every loaded record (origin, run, file). It is
#: not the domain, and a model told about it will query it.
_BOOKKEEPING_PREFIX = "_inv_"


@dataclass(frozen=True, slots=True)
class Grounding:
    """What the prompt describes: the global model, or the mirror standing in for it.

    ``versions`` are the authored models' active versions and ``links`` the
    Graph's active stitches (CM3). ``described`` is false when no model is
    authored and the introspected mirror stands in — labels alone beat no
    grounding, and the header says what the model is looking at (NL8).
    """

    versions: tuple[GraphVersion, ...]
    links: tuple[ModelLink, ...] = ()
    described: bool = True


def render_model_context(
    grounding: Grounding | GraphVersion | None,
    *,
    may_send: frozenset[str] | None = None,
    lens: QueryLens | None = None,
) -> str:
    """The global model as schema grounding, cut to what may cross and what may be read.

    ``may_send`` is the egress classes this crossing permits, or ``None`` for an
    unbounded one ([GV30](docs/for-developers/modules/govern/spec.md)). The cut
    is applied **to the parts being assembled**, never to the text afterwards
    ([GV31]) — what the model saw is what it reasoned from, whatever a record
    written later says went. A description and a stitch cross under the class of
    what they describe: a type's under ``type_names``, a property's and a
    stitch's join keys under ``property_names`` (NL9).

    ``lens`` is the run's ``QueryLens``: a type it does not allow, a property it
    excludes and a stitch naming either are not described at all (NL9), because
    telling the model about something the lens will refuse turns a clean
    *cannot answer* into a refused query.
    """
    if isinstance(grounding, GraphVersion):
        grounding = Grounding(versions=(grounding,))
    if grounding is None or not grounding.versions:
        return _NO_MODEL
    if may_send is not None and "type_names" not in may_send:
        return _NO_EGRESS

    properties = may_send is None or "property_names" in may_send
    nodes, edges = _union(grounding.versions, lens)

    node_lines = [f"(:{nt.name}{_props(nt, lens) if properties else ''}){_desc(nt.description)}" for nt in nodes]
    edge_lines = [
        f"[:{et.name}{_props(et, lens) if properties else ''}] "
        f"({', '.join(et.source_node_types or []) or '?'})->({', '.join(et.target_node_types or []) or '?'})"
        f"{_desc(et.description)}"
        for et in edges
    ]
    # A stitch between types the block does not list names something the model was never told of.
    listed = {t.name for t in nodes}
    stitch_lines: list[str] = []
    seen: set[tuple] = set()
    for link in grounding.links:
        # One line per shape: the same stitch declared against two versions of
        # the same models is one fact about the types.
        shape = (
            link.kind,
            link.source_type,
            link.source_property,
            link.target_type,
            link.target_property,
            link.edge_type,
        )
        if shape in seen or link.source_type not in listed or link.target_type not in listed:
            continue
        seen.add(shape)
        if line := _stitch(link, lens, properties):
            stitch_lines.append(line)

    label = "label and properties" if properties else "label only — this world does not send property names"
    if not grounding.described:
        label = f"introspected, not described; {label}"
    block = (
        f"Node types ({label}):\n"
        + ("\n".join(node_lines) or "(none defined)")
        + f"\n\nEdge types ({label}, allowed endpoints):\n"
        + ("\n".join(edge_lines) or "(none defined)")
    )
    if stitch_lines:
        block += "\n\nStitches (declared links between models; ≡ means the same entity):\n" + "\n".join(stitch_lines)
    return block


def _union(versions: tuple[GraphVersion, ...], lens: QueryLens | None):
    """Every type across the versions, once by name, and only those the lens reads.

    The same name in two models is one type to the database, so it is one line
    to the model: the first description authored wins and the properties are the
    union.
    """
    nodes: dict[str, _Type] = {}
    edges: dict[str, _Type] = {}
    for version in versions:
        for nt in version.node_types:
            _merge(nodes, nt)
        for et in version.edge_types:
            _merge(edges, et)
    allowed = (lambda name: True) if lens is None else lens.allows_type
    return (
        [t for t in nodes.values() if allowed(t.name)],
        [t for t in edges.values() if allowed(t.name)],
    )


@dataclass(slots=True)
class _Type:
    name: str
    description: str
    mappings: list[TypePropertyMapping]
    source_node_types: list[str] | None = None
    target_node_types: list[str] | None = None


def _merge(into: dict[str, _Type], definition) -> None:
    existing = into.get(definition.name)
    if existing is None:
        into[definition.name] = _Type(
            name=definition.name,
            description=definition.description or "",
            mappings=list(definition.property_mappings),
            source_node_types=list(getattr(definition, "source_node_types", None) or []) or None,
            target_node_types=list(getattr(definition, "target_node_types", None) or []) or None,
        )
        return
    if not existing.description.strip():
        existing.description = definition.description or ""
    known = {m.property_key.name for m in existing.mappings if m.property_key is not None}
    existing.mappings += [
        m for m in definition.property_mappings if m.property_key and m.property_key.name not in known
    ]
    for side in ("source_node_types", "target_node_types"):
        extra = [n for n in (getattr(definition, side, None) or []) if n not in (getattr(existing, side) or [])]
        if extra:
            setattr(existing, side, [*(getattr(existing, side) or []), *extra])


def _desc(text: str | None) -> str:
    """A trailing ``— description`` only when one is authored
    (docs/for-developers/modules/ask/features/clarifying-questions.md).

    Descriptions teach the model what a label/property *means* so it can map the
    user's words to the schema (e.g. "length" → ``longest``) without hand-written
    synonyms. Empty by default, so this is a no-op until a developer fills them in.
    """
    text = (text or "").strip()
    return f"  — {text}" if text else ""


def _props(t: _Type, lens: QueryLens | None) -> str:
    bound = lens.bound_for(t.name) if lens is not None else None
    excluded = bound.excluded if bound is not None else frozenset()
    names = [
        f"{m.property_key.name}:{m.property_key.type}"
        + (f" ({m.property_key.description.strip()})" if (m.property_key.description or "").strip() else "")
        for m in t.mappings
        if m.property_key is not None
        and not m.property_key.name.startswith(_BOOKKEEPING_PREFIX)
        and m.property_key.name not in excluded
    ]
    return " {" + ", ".join(names) + "}" if names else ""


def _stitch(link: ModelLink, lens: QueryLens | None, properties: bool) -> str:
    """One declared link, as the model can use it — or ``""`` when the lens hides either side.

    The join keys are property names, so they cross only with ``property_names``
    and only where the lens keeps them; the link itself still says the two types
    meet (NL9).
    """
    src, dst = link.source_type, link.target_type
    if lens is not None and not (lens.allows_type(src) and lens.allows_type(dst)):
        return ""
    if link.kind == "relationship" and link.edge_type and lens is not None and not lens.allows_type(link.edge_type):
        return ""
    keys = bool(properties and link.source_property and link.target_property)
    if keys and lens is not None:
        for type_name, prop in ((src, link.source_property), (dst, link.target_property)):
            bound = lens.bound_for(type_name)
            if bound is not None and prop in bound.excluded:
                keys = False
    tail = _desc(link.description)
    if link.kind == "anchor":
        if keys:
            return f"{src}.{link.source_property} ≡ {dst}.{link.target_property}{tail}"
        return f"{src} ≡ {dst}{tail}"
    edge = link.edge_type or "?"
    where = f" where {src}.{link.source_property} = {dst}.{link.target_property}" if keys else ""
    return f"({src})-[:{edge}]->({dst}){where}{tail}"


def render_rules(rules: list[Rule]) -> str:
    """The statements that are always true, as the model sees them.

    **Nothing is concatenated** (skills/spec.md § 4 · RU3): each rule is its own
    numbered line so the model can cite the one it followed, and the order is
    the one assembly fixed — graph invariants, then the project's working rules.

    A rule is offered, never enforced (RU5). The prompt says *follow* and asks
    for a citation; it does not claim the run will be refused for ignoring one,
    because it will not be.
    """
    statements = [r.statement.strip() for r in rules if r.statement.strip()]
    if not statements:
        return ""
    return "\n".join(f"{i}. {statement}" for i, statement in enumerate(statements, start=1))


def render_skills(skills: list[Skill]) -> str:
    """The graph's prose, as the model sees it (docs/for-developers/modules/ask/features/reasoning-trace.md).

    Each skill contributes *when to use it* and *how* — the two halves it was
    authored as. The names are what ``run_nodes.skills_offered`` records:
    "this prose was in the prompt" is a fact, and it is the only level of skill
    attribution that is one (docs/for-developers/modules/work/spec.md).
    """
    if not skills:
        return ""
    blocks = []
    for skill in skills:
        parts = [f"### {skill.name}"]
        if skill.description:
            parts.append(skill.description)
        if skill.when_to_use:
            parts.append(f"When to use: {skill.when_to_use}")
        if skill.content:
            parts.append(skill.content)
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks)
