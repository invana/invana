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
        "query": {"type": "string", "description": "The read-only query to run."},
        "language": {"type": "string", "enum": ["cypher", "gremlin"]},
        "read_only": {"type": "boolean", "description": "Must be true."},
        "rationale": {"type": "string", "description": "One sentence on what the query returns."},
    },
    "required": ["query", "language", "read_only", "rationale"],
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


def _system_prompt(language: str, model_context: str) -> str:
    return (
        f"You translate a natural-language question into a single READ-ONLY {language} query "
        "against the graph described below. Use ONLY the node and edge types listed — never invent "
        "labels or properties. Never mutate the graph (no CREATE/MERGE/SET/DELETE/REMOVE for Cypher; "
        "no addV/addE/property/drop for Gremlin). Return the result via the schema and set read_only=true.\n\n"
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
) -> GeneratedQuery:
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
    query = str(data["query"]).strip()
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
    )
