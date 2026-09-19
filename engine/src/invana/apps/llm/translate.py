"""Natural-language → grounded read-only query (docs/for-developers/modules/ask/features/ask-in-natural-language.md).

Assembles a grounded system prompt (the active model + target language + a hard
read-only instruction), forces a ``submit_query`` structured result via the
docs/for-developers/modules/agents/features/providers-and-models.md runtime, and returns the generated query for the
sessions endpoint to
run through the existing ``execute_query``. A generated query that looks like a
write is refused here (the read-only execution guard is the deeper backstop).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from invana.apps.llm import LLMError, QueryNotReadOnlyError, complete_tool
from invana.apps.llm.grounding import render_model_context
from invana.apps.llm.schemas import Exchange, TokenUsage
from invana.apps.llm_providers.models import LLMProvider
from invana.apps.modeller.models import GraphVersion

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
        "options": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Fixed answer options the user can pick (when action=clarify); else [].",
        },
        "options_query": {
            "type": "string",
            "description": (
                "When clarifying WHICH value to pick from the data, a read-only query returning up to 10 "
                "DISTINCT human-readable labels (prefer a name over a bare code; if the value is a code "
                "with its own named node, return that node's name with the code in parentheses). The "
                'backend runs it and turns the first column into options. Else "".'
            ),
        },
        # A **self-report**, and rendered as one: the step row badges it
        # *reported*, never *used* (docs/for-developers/modules/work/spec.md). Nothing downstream trusts
        # it — it is a signal for the person reading the trace.
        "skills_applied": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Names of the skills above you actually followed for this answer. [] if none.",
        },
        # Also a self-report. A rule is cited by its statement because that is
        # what the model was shown — ids would be one more thing to hallucinate.
        "rules_cited": {
            "type": "array",
            "items": {"type": "string"},
            "description": "The exact statements of the rules above you followed for this answer. [] if none.",
        },
    },
    # All required: a relaxed required-set makes some models omit `query`
    # entirely. Branch on `action` in code; unused fields are sent as ""/[].
    "required": [
        "action",
        "query",
        "language",
        "read_only",
        "rationale",
        "question",
        "options",
        "options_query",
        "skills_applied",
        "rules_cited",
    ],
}

# Lower-cased write markers per language — a cheap guard so a hallucinated write
# never reaches a writable connection (mirrors query_service's write detection).
# Write clauses, matched as **words**. A trailing space made `OFFSET 10`,
# `d.dataset` and `n.asset` all read as `set ` — three read-only queries refused
# — while `CREATE(n)` and `MERGE(n)`, written without the space, sailed through.
# A word boundary is both the fix and the stricter rule.
_CYPHER_WRITE_WORDS = ("create", "merge", "set", "delete", "remove", "drop", "foreach")
# Two words, so they cannot be one `\b`-delimited token.
_CYPHER_WRITE_PHRASES = ("load csv",)
_GREMLIN_WRITES = (".addv(", ".adde(", ".property(", ".drop(")

_CYPHER_WRITE_RE = re.compile(r"\b(?:" + "|".join(_CYPHER_WRITE_WORDS) + r")\b")
#: A quoted literal is text the graph never executes, so `CONTAINS 'merge '`
#: is a read. Handles the escaped quote inside a literal.
_STRING_LITERAL_RE = re.compile(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"")


@dataclass(slots=True)
class GeneratedQuery:
    query: str
    language: str
    read_only: bool
    rationale: str
    # What the model says it followed. A self-report, labelled as one.
    skills_applied: list[str]
    # The rule statements it says it followed. Also a self-report.
    rules_cited: list[str]
    usage: TokenUsage
    #: The call as a reader reads it — drawn as the step dashboard's Output
    #: band (SR42). Not a declared output: a plan cannot bind a raw prompt.
    exchange: Exchange = field(default_factory=Exchange)
    # Wall-clock of the LLM translation step, surfaced so the sessions endpoint
    # can report LLM time next to query time (docs/for-developers/modules/platform/features/telemetry.md ·
    # docs/for-developers/modules/ask/features/ask-in-natural-language.md).
    duration_ms: float = 0.0


@dataclass(slots=True)
class Clarification:
    """The model asked a question instead of producing a query
    (docs/for-developers/modules/ask/features/clarifying-questions.md).

    Returned only when the ask is genuinely ambiguous — the sessions endpoint
    persists the question as an assistant reply rather than running anything.
    ``options`` are short answers the user can pick instead of retyping.
    """

    question: str
    usage: TokenUsage
    options: list[str] = field(default_factory=list)
    # A read-only query whose DISTINCT first-column values become the options —
    # so the user picks a real value from the graph (e.g. a category). Empty when
    # the options are a fixed list (``options``) or there are none.
    options_query: str = ""
    #: The call as a reader reads it — drawn as the step dashboard's Output
    #: band (SR42). Not a declared output: a plan cannot bind a raw prompt.
    exchange: Exchange = field(default_factory=Exchange)
    duration_ms: float = 0.0


def _system_prompt(
    language: str,
    model_context: str,
    skills: str = "",
    instructions: str = "",
    rules: str = "",
) -> str:
    return (
        f"You translate a natural-language question into a single READ-ONLY {language} query "
        "against the graph described below. Use ONLY the node and edge types listed — never invent "
        "labels or properties. Never mutate the graph (no CREATE/MERGE/SET/DELETE/REMOVE for Cypher; "
        "no addV/addE/property/drop for Gremlin).\n\n"
        'Default to action="query": produce the query and set read_only=true. Translate confidently '
        "whenever the request is clear — including obvious follow-ups like changing a limit, choosing "
        "which columns to return, or adding filters that map cleanly to the listed properties. Resolve "
        'references to earlier turns ("those", "these", "that one") from the conversation.\n\n'
        "ALWAYS cap results: add LIMIT 10 (Cypher) / .limit(10) (Gremlin) unless the user names a "
        "specific number — never return an entire collection; the graph may hold millions of rows. "
        "Counts/aggregations are exempt.\n\n"
        "Presentation intent drives the SHAPE of the result. When the user wants to SEE or VISUALISE the "
        'data — "on the canvas", "visualise", "as a graph", "show/load the graph", "load into the '
        'canvas/visualiser" — return WHOLE nodes (and their relationships where relevant) so the result '
        "is a graph, e.g. `MATCH (n:SomeType) RETURN n LIMIT 10` or "
        "`MATCH (n:SomeType)-[r:REL_TYPE]->(m:OtherType) RETURN n, r, m LIMIT 10` (use the graph's own "
        "types) — NOT scalar columns. "
        'When they want a list/table ("as a table", "list", named fields, "count"), return scalar '
        'columns instead. "canvas" and "visualiser" are presentation words, not labels in the graph — '
        "never clarify about them.\n\n"
        'To show the RELATIONSHIPS/connections of a previous result ("relationships of these nodes", '
        '"connect them", "how are they linked") you do NOT have the result rows — reuse the previous '
        "turn's query as a subquery to re-select those nodes, then match their relationships and return "
        "whole nodes + relationships. Cypher shape: "
        "`MATCH (n:SomeType) WITH n <prior ordering/filter> LIMIT 10 MATCH (n)-[r]-(m) RETURN n, r, m`.\n\n"
        'Use action="clarify" with a single short question ONLY when you genuinely cannot proceed: a '
        "likely typo of a label/property/value, a reference you cannot resolve, or an ask the listed "
        "types simply cannot express. Never clarify when a reasonable query is obvious — clarifying must "
        "be rare. NEVER offer a 'show all' / 'list everything' option.\n\n"
        'Always fill every field. For action="query": put the query in "query", set read_only=true, set '
        '"question"="" , "options"=[] , "options_query"="". For action="clarify": put the question in '
        '"question" and set "query"="". When the choice is WHICH value from the data, set '
        '"options_query" to a read-only query returning up to 10 DISTINCT, human-readable labels for '
        "that choice — prefer a name/description over a bare code; if the value is a code that has its "
        "own node carrying a name, return that name (you may append the code in parentheses). Leave "
        '"options"=[]. Otherwise list 2-4 fixed choices '
        'in "options" and set "options_query"="".'
        "\n\n"
        f"Target query language: {language}\n\n"
        + (f"Standing instructions for this graph:\n{instructions}\n\n" if instructions else "")
        + (f"Skills you may apply (name each one you follow in skills_applied):\n{skills}\n\n" if skills else "")
        + (
            f"Rules that are always true here (quote each statement you follow in rules_cited):\n{rules}\n\n"
            if rules
            else ""
        )
        + f"Graph model:\n{model_context}"
    )


def _looks_read_only(query: str, language: str) -> bool:
    """Whether *query* only reads — the cheap text check in front of the graph.

    Literals are removed first: their contents are never executed, and matching
    them refused questions about the word *merge*. `CALL { … }` is no longer a
    marker of its own — a subquery that writes says so with `CREATE` or `SET`
    inside it, which this already reads, and the brace alone refused every
    read-only subquery.

    A heuristic, and deliberately the outermost of four: the connection's
    read-only flag, the envelope's pin on ``execute_graph_query`` and the
    ``validate_query`` step all check again closer to the database.
    """
    low = _STRING_LITERAL_RE.sub(" ", query).lower()
    if language != "cypher":
        return not any(m in low for m in _GREMLIN_WRITES)
    if any(phrase in low for phrase in _CYPHER_WRITE_PHRASES):
        return False
    return _CYPHER_WRITE_RE.search(low) is None


async def nl_to_query(
    *,
    provider: LLMProvider,
    prompt: str,
    language: str,
    version: GraphVersion | None,
    encryption_key: str,
    skills: str = "",
    instructions: str = "",
    rules: str = "",
    history: list[dict] | None = None,
    timeout_s: float = 120.0,
) -> GeneratedQuery | Clarification:
    system = _system_prompt(language, render_model_context(version), skills, instructions, rules)
    messages = [*(history or []), {"role": "user", "content": prompt}]
    result = await complete_tool(
        provider=provider,
        system=system,
        messages=messages,
        tool_schema=SUBMIT_QUERY_TOOL,
        tool_name="submit_query",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="translate",
    )
    data = result.input
    if str(data.get("action") or "query") == "clarify":
        question = str(data.get("question") or "").strip()
        if not question:
            raise LLMError("The model asked to clarify but gave no question.")
        options = [str(o).strip() for o in (data.get("options") or []) if str(o).strip()]
        # Only honour an options query that looks read-only (execute_query guards
        # again at run time); drop it otherwise so clarification never mutates.
        options_query = str(data.get("options_query") or "").strip()
        if options_query and not _looks_read_only(options_query, str(data.get("language") or language)):
            options_query = ""
        return Clarification(
            question=question,
            usage=result.usage,
            options=options,
            options_query=options_query,
            exchange=result.exchange,
            duration_ms=result.duration_ms,
        )
    query = str(data.get("query") or "").strip()
    out_language = str(data.get("language") or language)
    if not query:
        raise LLMError("The model did not produce a query for that question.")
    if not bool(data.get("read_only", True)) or not _looks_read_only(query, out_language):
        raise QueryNotReadOnlyError(
            "That query would write to the graph — Invana only runs read-only queries.", query=query
        )
    return GeneratedQuery(
        query=query,
        language=out_language,
        read_only=True,
        rationale=str(data.get("rationale") or ""),
        skills_applied=[str(s).strip() for s in (data.get("skills_applied") or []) if str(s).strip()],
        rules_cited=[str(r).strip() for r in (data.get("rules_cited") or []) if str(r).strip()],
        usage=result.usage,
        exchange=result.exchange,
        duration_ms=result.duration_ms,
    )
