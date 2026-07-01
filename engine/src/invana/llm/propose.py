"""Natural-language → proposed graph model (RFC-031).

The Modeller counterpart to ``translate.nl_to_query``: it grounds on a model's
**draft** version and forces a ``propose_model`` structured result — node/edge
types + property keys — that the sessions service reconciles into that draft.
Model-only: it never proposes data, queries, or connector writes.

Mirrors ``translate.py`` deliberately (same forced-tool client, same all-required
tool convention, same ``Clarification`` early-out) so the two surfaces stay
symmetric and share the runtime + the clarification UI.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.llm import LLMError, complete_tool
from invana.llm.grounding import render_model_context
from invana.llm.schemas import TokenUsage
from invana.llm.translate import Clarification
from invana.llm_providers.models import LLMProvider
from invana.modeller.models import GraphVersion

# Universal property types — available on every backend regardless of version
# (RFC-022 ``PropertyType`` universal tier + always-available temporal). Keeping
# generation to this safe subset means a generated draft activates on any bound
# DB; richer/native types stay a hand-authoring choice.
ALLOWED_PROPERTY_TYPES = ("string", "integer", "float", "boolean", "date", "datetime")

_PROPERTY_KEY_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "Property name (e.g. 'title', 'created_at')."},
        "type": {
            "type": "string",
            "enum": list(ALLOWED_PROPERTY_TYPES),
            "description": "One of the allowed property types.",
        },
    },
    "required": ["name", "type"],
}

PROPOSE_MODEL_TOOL = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["propose", "clarify"],
            "description": "propose = author/refine the model now (the default); clarify = ask one question first.",
        },
        "node_types": {
            "type": "array",
            "description": "Node types to create or refine (when action=propose); else [].",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Node-type label, e.g. 'Person' (PascalCase)."},
                    "description": {"type": "string", "description": 'One short sentence; else "".'},
                    "property_keys": {"type": "array", "items": _PROPERTY_KEY_SCHEMA},
                },
                "required": ["name", "description", "property_keys"],
            },
        },
        "edge_types": {
            "type": "array",
            "description": "Edge types to create or refine (when action=propose); else [].",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Edge-type label, e.g. 'WORKS_ON' (UPPER_SNAKE)."},
                    "description": {"type": "string", "description": 'One short sentence; else "".'},
                    "source_node_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Source node-type names — each must be a proposed or existing node type.",
                    },
                    "target_node_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Target node-type names — each must be a proposed or existing node type.",
                    },
                    "property_keys": {"type": "array", "items": _PROPERTY_KEY_SCHEMA},
                },
                "required": ["name", "description", "source_node_types", "target_node_types", "property_keys"],
            },
        },
        "summary": {
            "type": "string",
            "description": "One or two sentences describing what was proposed/changed (when action=propose).",
        },
        "question": {"type": "string", "description": "One short clarifying question (when action=clarify)."},
        "options": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Fixed answer options the user can pick (when action=clarify); else [].",
        },
    },
    # All required: a relaxed required-set makes some models drop fields. Branch
    # on `action` in code; unused fields are sent as ""/[].
    "required": ["action", "node_types", "edge_types", "summary", "question", "options"],
}


@dataclass(slots=True)
class ModelProposal:
    """A validated node/edge-type proposal the service reconciles into the draft."""

    node_types: list[dict]
    edge_types: list[dict]
    summary: str
    usage: TokenUsage
    duration_ms: float = 0.0


def _system_prompt(model_context: str) -> str:
    return (
        "You author a graph MODEL — node types, edge types, and their property keys — from the user's "
        "description. You NEVER write data, queries, or instances; only the schema (the types). The model "
        "you are refining is described below; ADD to or REFINE it. Reuse the existing types verbatim where "
        "the user's request maps onto them — only introduce a new type when nothing existing fits.\n\n"
        'Default to action="propose". Node-type names are PascalCase singular (Person, Project); edge-type '
        "names are UPPER_SNAKE verbs (WORKS_ON, MANAGES). Every edge type's source_node_types and "
        "target_node_types MUST each reference a node type that is either proposed in THIS response or "
        "already present in the model below — never reference an undefined node type.\n\n"
        f"Property keys carry a name and a type. Allowed types ONLY: {', '.join(ALLOWED_PROPERTY_TYPES)}. "
        "Give each type a few generic, relevant properties (e.g. a name/title, an id, a created_at) unless "
        "the user is specific. Keep proposals focused — at most ~12 node types and ~12 edge types per "
        "turn.\n\n"
        'Use action="clarify" with a single short question ONLY when the request is genuinely ambiguous and '
        "you cannot make a reasonable modelling choice. Prefer to propose a sensible model over clarifying — "
        "clarifying must be rare.\n\n"
        'Always fill every field. For action="propose": fill node_types/edge_types/summary and set '
        '"question"="" , "options"=[]. For action="clarify": fill "question" (and optionally 2-4 "options"), '
        'and set "node_types"=[] , "edge_types"=[] , "summary"="".'
        "\n\n"
        f"Current model:\n{model_context}"
    )


def _clean_property_keys(raw: object) -> list[dict]:
    out: list[dict] = []
    for pk in raw or []:
        if not isinstance(pk, dict):
            continue
        name = str(pk.get("name") or "").strip()
        if not name:
            continue
        ptype = str(pk.get("type") or "string").strip().lower()
        out.append({"name": name, "type": ptype})
    return out


def _clean_node_types(raw: object) -> list[dict]:
    out: list[dict] = []
    for nt in raw or []:
        if not isinstance(nt, dict):
            continue
        name = str(nt.get("name") or "").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "description": str(nt.get("description") or "").strip(),
                "property_keys": _clean_property_keys(nt.get("property_keys")),
            }
        )
    return out


def _clean_edge_types(raw: object) -> list[dict]:
    out: list[dict] = []
    for et in raw or []:
        if not isinstance(et, dict):
            continue
        name = str(et.get("name") or "").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "description": str(et.get("description") or "").strip(),
                "source_node_types": [str(s).strip() for s in (et.get("source_node_types") or []) if str(s).strip()],
                "target_node_types": [str(t).strip() for t in (et.get("target_node_types") or []) if str(t).strip()],
                "property_keys": _clean_property_keys(et.get("property_keys")),
            }
        )
    return out


async def propose_model(
    *,
    provider: LLMProvider,
    prompt: str,
    version: GraphVersion | None,
    encryption_key: str,
    history: list[dict] | None = None,
    timeout_s: float = 120.0,
) -> ModelProposal | Clarification:
    """Turn an NL prompt into a model proposal grounded on the model's draft.

    ``version`` is the draft being authored (or ``None`` when starting from
    scratch). Returns a :class:`ModelProposal` to reconcile, or a
    :class:`Clarification` when the ask is genuinely ambiguous.
    """
    system = _system_prompt(render_model_context(version))
    messages = [*(history or []), {"role": "user", "content": prompt}]
    result = await complete_tool(
        provider=provider,
        system=system,
        messages=messages,
        tool_schema=PROPOSE_MODEL_TOOL,
        tool_name="propose_model",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="propose",
    )
    data = result.input
    if str(data.get("action") or "propose") == "clarify":
        question = str(data.get("question") or "").strip()
        if not question:
            raise LLMError("The model asked to clarify but gave no question.")
        options = [str(o).strip() for o in (data.get("options") or []) if str(o).strip()]
        return Clarification(
            question=question,
            usage=result.usage,
            options=options,
            options_query="",  # nothing to query when authoring a model
            duration_ms=result.duration_ms,
        )
    node_types = _clean_node_types(data.get("node_types"))
    edge_types = _clean_edge_types(data.get("edge_types"))
    summary = str(data.get("summary") or "").strip()
    if not node_types and not edge_types:
        raise LLMError("The model proposed no node or edge types for that request.")
    return ModelProposal(
        node_types=node_types,
        edge_types=edge_types,
        summary=summary or "Updated the model.",
        usage=result.usage,
        duration_ms=result.duration_ms,
    )


def validate_proposal(proposal: ModelProposal, *, existing_node_type_names: set[str]) -> None:
    """Referential-integrity pre-check (RFC-031 Decision 9) — raises before any mutation.

    Every edge endpoint must reference a node type that is proposed here or
    already in the draft; every property key must have a non-empty name and an
    allowed type. On any violation raise :class:`LLMError` so the caller takes
    the error-reply path with the draft left untouched.
    """
    proposed_node_names = {nt["name"] for nt in proposal.node_types}
    known = proposed_node_names | existing_node_type_names

    def _check_props(props: list[dict], owner: str) -> None:
        for pk in props:
            if not pk.get("name"):
                raise LLMError(f"{owner} has a property with no name.")
            if pk.get("type") not in ALLOWED_PROPERTY_TYPES:
                raise LLMError(f"{owner} property '{pk['name']}' has unsupported type '{pk.get('type')}'.")

    for nt in proposal.node_types:
        _check_props(nt["property_keys"], f"Node type '{nt['name']}'")

    for et in proposal.edge_types:
        endpoints = [*et["source_node_types"], *et["target_node_types"]]
        if not et["source_node_types"] or not et["target_node_types"]:
            raise LLMError(f"Edge type '{et['name']}' is missing a source or target node type.")
        for ref in endpoints:
            if ref not in known:
                raise LLMError(f"Edge type '{et['name']}' references unknown node type '{ref}'.")
        _check_props(et["property_keys"], f"Edge type '{et['name']}'")
