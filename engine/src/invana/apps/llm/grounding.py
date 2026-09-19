"""Render a graph model version into compact schema grounding
(docs/for-developers/modules/ask/features/ask-in-natural-language.md).

The active ``GraphVersion`` (node types, edge types, property keys) becomes a
short text block the translator puts in the system prompt — this is what keeps
the model from inventing labels, and what makes every NL answer traceable to
the ontology. The version is loaded with its type tree eager-loaded
(``ModelStore`` ``_version_eager()``), so the relationship access here is safe.
"""

from __future__ import annotations

from invana.apps.modeller.models import GraphVersion, TypePropertyMapping
from invana.apps.skills.models import Rule, Skill

_NO_MODEL = "No graph model is available — infer labels conservatively from the question and prefer a simple query."


def render_model_context(version: GraphVersion | None) -> str:
    if version is None:
        return _NO_MODEL

    node_lines = [f"(:{nt.name}{_props(nt.property_mappings)}){_desc(nt.description)}" for nt in version.node_types]
    edge_lines = [
        f"[:{et.name}{_props(et.property_mappings)}] "
        f"({', '.join(et.source_node_types or []) or '?'})->({', '.join(et.target_node_types or []) or '?'})"
        f"{_desc(et.description)}"
        for et in version.edge_types
    ]
    return (
        "Node types (label and properties):\n"
        + ("\n".join(node_lines) or "(none defined)")
        + "\n\nEdge types (label, properties, allowed endpoints):\n"
        + ("\n".join(edge_lines) or "(none defined)")
    )


def _desc(text: str | None) -> str:
    """A trailing ``— description`` only when one is authored
    (docs/for-developers/modules/ask/features/clarifying-questions.md).

    Descriptions teach the model what a label/property *means* so it can map the
    user's words to the schema (e.g. "length" → ``longest``) without hand-written
    synonyms. Empty by default, so this is a no-op until a developer fills them in.
    """
    text = (text or "").strip()
    return f"  — {text}" if text else ""


def _props(mappings: list[TypePropertyMapping]) -> str:
    names = [
        f"{m.property_key.name}:{m.property_key.type}"
        + (f" ({m.property_key.description.strip()})" if (m.property_key.description or "").strip() else "")
        for m in mappings
        if m.property_key is not None
    ]
    return " {" + ", ".join(names) + "}" if names else ""


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
