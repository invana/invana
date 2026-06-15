"""Render a graph model version into compact schema grounding (RFC-030).

The active ``GraphVersion`` (node types, edge types, property keys) becomes a
short text block the translator puts in the system prompt — this is what keeps
the model from inventing labels, and what makes every NL answer traceable to
the ontology. The version is loaded with its type tree eager-loaded
(``ModelStore`` ``_VERSION_EAGER``), so the relationship access here is safe.
"""

from __future__ import annotations

from invana.modeller.models import GraphVersion, TypePropertyMapping

_NO_MODEL = "No graph model is available — infer labels conservatively from the question and prefer a simple query."


def render_model_context(version: GraphVersion | None) -> str:
    if version is None:
        return _NO_MODEL

    node_lines = [f"(:{nt.name}{_props(nt.property_mappings)})" for nt in version.node_types]
    edge_lines = [
        f"[:{et.name}{_props(et.property_mappings)}] "
        f"({', '.join(et.source_node_types or []) or '?'})->({', '.join(et.target_node_types or []) or '?'})"
        for et in version.edge_types
    ]
    return (
        "Node types (label and properties):\n"
        + ("\n".join(node_lines) or "(none defined)")
        + "\n\nEdge types (label, properties, allowed endpoints):\n"
        + ("\n".join(edge_lines) or "(none defined)")
    )


def _props(mappings: list[TypePropertyMapping]) -> str:
    names = [f"{m.property_key.name}:{m.property_key.type}" for m in mappings if m.property_key is not None]
    return " {" + ", ".join(names) + "}" if names else ""
