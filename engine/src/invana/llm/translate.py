"""Natural-language → grounded read-only query (RFC-030).

Assembles a grounded system prompt (the active model + target language + a hard
read-only instruction), forces a ``submit_query`` structured result via the
RFC-032 runtime, and returns the generated query for the sessions endpoint to
run through the existing ``execute_query``. A generated query that looks like a
write is refused here (the read-only execution guard is the deeper backstop).
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.llm import LLMError, complete_tool
from invana.llm.grounding import render_model_context
from invana.llm.schemas import TokenUsage
from invana.llm_providers.models import LLMProvider
from invana.modeller.models import GraphVersion

SUBMIT_QUERY_TOOL = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["query", "clarify"],
            "description": "query = translate and run now (the default); clarify = ask one question first.",
        },
        "query": {"type": "string", "description": "The read-only query to run (when action=query)."},
        "language": {"type": "string", "enum": ["cypher", "gremlin"]},
        "read_only": {"type": "boolean", "description": "Must be true (when action=query)."},
        "rationale": {"type": "string", "description": "One sentence on what the query returns (when action=query)."},
        "question": {"type": "string", "description": "One short clarifying question (when action=clarify)."},
    },
    "required": ["action"],
}

# Lower-cased write markers per language — a cheap guard so a hallucinated write
# never reaches a writable connection (mirrors query_service's write detection).
_CYPHER_WRITES = ("create ", "merge ", "set ", "delete ", "remove ", "call {")
_GREMLIN_WRITES = (".addv(", ".adde(", ".property(", ".drop(")


@dataclass(slots=True)
class GeneratedQuery:
    query: str
    language: str
    read_only: bool
    rationale: str
    usage: TokenUsage
    # Wall-clock of the LLM translation step, surfaced so the sessions endpoint
    # can report LLM time next to query time (RFC-025/030).
    duration_ms: float = 0.0


@dataclass(slots=True)
class Clarification:
    """The model asked a question instead of producing a query (RFC-038).

    Returned only when the ask is genuinely ambiguous — the sessions endpoint
    persists the question as an assistant reply rather than running anything.
    """

    question: str
    usage: TokenUsage
    duration_ms: float = 0.0


def _system_prompt(language: str, model_context: str) -> str:
    return (
        f"You translate a natural-language question into a single READ-ONLY {language} query "
        "against the graph described below. Use ONLY the node and edge types listed — never invent "
        "labels or properties. Never mutate the graph (no CREATE/MERGE/SET/DELETE/REMOVE for Cypher; "
        "no addV/addE/property/drop for Gremlin).\n\n"
        'Default to action="query": produce the query and set read_only=true. Translate confidently '
        "whenever the request is clear — including obvious follow-ups like changing a limit, choosing "
        "which columns to return, or adding filters that map cleanly to the listed properties. Resolve "
        'references to earlier turns ("those", "these", "that one") from the conversation.\n\n'
        'Use action="clarify" with a single short question ONLY when you genuinely cannot proceed: a '
        "likely typo of a label/property/value, a reference you cannot resolve, or an ask the listed "
        "types simply cannot express. Never clarify when a reasonable query is obvious — clarifying must "
        "be rare.\n\n"
        f"Target query language: {language}\n\n"
        f"Graph model:\n{model_context}"
    )


def _looks_read_only(query: str, language: str) -> bool:
    low = query.lower()
    markers = _CYPHER_WRITES if language == "cypher" else _GREMLIN_WRITES
    return not any(m in low for m in markers)


async def nl_to_query(
    *,
    provider: LLMProvider,
    prompt: str,
    language: str,
    version: GraphVersion | None,
    encryption_key: str,
    history: list[dict] | None = None,
    timeout_s: float = 120.0,
) -> GeneratedQuery | Clarification:
    system = _system_prompt(language, render_model_context(version))
    messages = [*(history or []), {"role": "user", "content": prompt}]
    result = await complete_tool(
        provider=provider,
        system=system,
        messages=messages,
        tool_schema=SUBMIT_QUERY_TOOL,
        tool_name="submit_query",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
    )
    data = result.input
    if str(data.get("action") or "query") == "clarify":
        question = str(data.get("question") or "").strip()
        if not question:
            raise LLMError("The model asked to clarify but gave no question.")
        return Clarification(question=question, usage=result.usage, duration_ms=result.duration_ms)
    query = str(data.get("query") or "").strip()
    out_language = str(data.get("language") or language)
    if not query:
        raise LLMError("The model did not produce a query for that question.")
    if not bool(data.get("read_only", True)) or not _looks_read_only(query, out_language):
        raise LLMError("The generated query was not read-only — refusing to run it.")
    return GeneratedQuery(
        query=query,
        language=out_language,
        read_only=True,
        rationale=str(data.get("rationale") or ""),
        usage=result.usage,
        duration_ms=result.duration_ms,
    )
