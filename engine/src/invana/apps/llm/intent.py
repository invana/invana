"""Understand — what the ask *means* inside this graph (docs/for-developers/modules/agents/spec.md).

This is the cheap classifier that runs before anything writes a query. It
answers three questions and nothing else:

* **what kind of ask is this** — one query, several, an aggregate to chart;
* **which types does it name** — so *Verify* has something to check against;
* **can this graph answer it at all** — and if not, say so *before* a query is
  written, which is what turns promise #4 from a post-hoc apology into a
  judgement about the boundary.

Splitting this out of translation is what lets a clarification settle before a
plan exists, and lets *Plan* be reused by asks that have no NL to understand —
a QL ask, a rethink, a scheduled firing, a task handed to an agent.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.grounding import render_model_context
from invana.apps.llm.schemas import Exchange, TokenUsage
from invana.apps.llm.translate import Clarification, _looks_read_only
from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.modeller.models import GraphVersion

# The shapes a plan can serve. Keep in step with
# ``invana.apps.agents.registry.INTENT_TEMPLATES`` — an intent kind with no template
# is the case where the model plans.
INTENT_KINDS = (
    "single_query",
    "compound",
    "exploration",
    "aggregate_and_chart",
    "model_change",
    "out_of_scope",
)

UNDERSTAND_TOOL = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["understood", "clarify", "cannot_answer"],
            "description": "understood = the intent is settled; clarify = ask one question; "
            "cannot_answer = this graph cannot answer it at all.",
        },
        "kind": {
            "type": "string",
            "enum": list(INTENT_KINDS),
            "description": "single_query = one question, one query. compound = several readings to combine. "
            "exploration = open-ended browsing. aggregate_and_chart = a number or a trend to draw. "
            "model_change = a change to the schema, not the data. out_of_scope = not answerable here.",
        },
        "summary": {"type": "string", "description": "One line: what the user means, in your words."},
        "refs": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Node/edge type names from the model that this ask is about. [] if none apply.",
        },
        "expects": {
            "type": "array",
            "items": {"type": "string", "enum": ["graph", "table", "metric", "chart", "text"]},
            "description": "Which result shapes would answer this ask. Verify checks these were emitted.",
        },
        "confidence": {"type": "number", "description": "0-1. Below 0.5, prefer clarify."},
        "reason": {"type": "string", "description": 'When cannot_answer: what the graph does not hold. Else "".'},
        "question": {"type": "string", "description": 'When clarify: one short question. Else "".'},
        "options": {"type": "array", "items": {"type": "string"}, "description": "Fixed answer options, or []."},
        "options_query": {
            "type": "string",
            "description": "When the choice is WHICH value from the data, a read-only query returning up to 10 "
            'distinct human-readable labels. Else "".',
        },
        "skills_applied": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Names of the skills above you actually followed while reading this ask. [] if none.",
        },
        # Also a self-report, cited by statement because that is what was shown.
        "rules_cited": {
            "type": "array",
            "items": {"type": "string"},
            "description": "The exact statements of the rules above you followed while reading this ask. [] if none.",
        },
    },
    "required": [
        "action",
        "kind",
        "summary",
        "refs",
        "expects",
        "confidence",
        "reason",
        "question",
        "options",
        "options_query",
        "skills_applied",
        "rules_cited",
    ],
}


@dataclass(slots=True)
class Intent:
    """Structured, never prose — invariant **V1**.

    ``refs`` and ``expects`` exist so *Verify* has something deterministic to
    check: "did the result mention the types the ask was about, in the shape it
    asked for". A prose intent would leave verification to a second LLM, and a
    self-report is not evidence.
    """

    kind: str
    summary: str
    refs: list[str] = field(default_factory=list)
    expects: list[str] = field(default_factory=list)
    confidence: float = 1.0
    skills_applied: list[str] = field(default_factory=list)
    #: The rule statements it says it followed. Also a self-report.
    rules_cited: list[str] = field(default_factory=list)
    usage: TokenUsage | None = None
    #: The call as a reader reads it — drawn as the step dashboard's Output
    #: band (SR42). Not a declared output: a plan cannot bind a raw prompt.
    exchange: Exchange = field(default_factory=Exchange)
    duration_ms: float = 0.0

    def as_dict(self) -> dict:
        return {
            "kind": self.kind,
            "summary": self.summary,
            "refs": self.refs,
            "expects": self.expects,
            "confidence": self.confidence,
        }


@dataclass(slots=True)
class OutOfScope:
    """A legitimate outcome, decided **before** any query is written."""

    reason: str
    usage: TokenUsage | None = None
    #: The call as a reader reads it — drawn as the step dashboard's Output
    #: band (SR42). Not a declared output: a plan cannot bind a raw prompt.
    exchange: Exchange = field(default_factory=Exchange)
    duration_ms: float = 0.0


def _system_prompt(model_context: str, instructions: str, skills: str, rules: str) -> str:
    return (
        "You classify what a question means against ONE bounded knowledge graph. You do not write "
        "queries and you do not answer the question — a later step does both.\n\n"
        'Set action="understood" and fill "kind", "summary", "refs" and "expects" whenever the ask is '
        "clear enough to act on. Be decisive: most asks are single_query.\n\n"
        'Set action="clarify" ONLY when you genuinely cannot tell what is being asked — an ambiguous '
        "entity, a reference you cannot resolve, two readings that would produce different answers. "
        "Never clarify to be polite.\n\n"
        'Set action="cannot_answer" ONLY when the graph below simply does not hold what is being asked '
        'about — a type or a fact that is not there. Say what is missing in "reason". A hard question '
        "the graph CAN answer is not out of scope.\n\n"
        '"refs" must contain names that appear in the model below — never invented ones. "expects" is '
        "what a good answer would look like: graph for things to see on a canvas, table for rows, "
        "metric for a single number, chart for a trend or comparison, text for an explanation.\n\n"
        f"{instructions}{skills}{rules}"
        f"Graph model:\n{model_context}"
    )


async def understand(
    *,
    provider: LLMEndpoint,
    prompt: str,
    version: GraphVersion | None,
    encryption_key: str,
    instructions: str = "",
    skills: str = "",
    rules: str = "",
    history: list[dict] | None = None,
    timeout_s: float = 60.0,
    #: The egress classes this crossing permits, or ``None`` for an unbounded
    #: one (docs/for-developers/modules/govern/spec.md GV30). The cut is applied
    #: to the parts of the prompt, before the prompt exists (GV31).
    may_send: frozenset[str] | None = None,
) -> Intent | Clarification | OutOfScope:
    system = _system_prompt(
        render_model_context(version, may_send=may_send),
        f"Standing instructions for this graph:\n{instructions}\n\n" if instructions else "",
        f"Skills you may apply:\n{skills}\n\n" if skills else "",
        f"Rules that are always true here (quote each statement you follow in rules_cited):\n{rules}\n\n"
        if rules
        else "",
    )
    result = await complete_tool(
        provider=provider,
        system=system,
        messages=[*(history or []), {"role": "user", "content": prompt}],
        tool_schema=UNDERSTAND_TOOL,
        tool_name="submit_intent",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="understand",
    )
    data = result.input
    action = str(data.get("action") or "understood")

    if action == "cannot_answer":
        reason = str(data.get("reason") or "").strip()
        if not reason:
            raise LLMError("The model said it cannot answer but gave no reason.")
        return OutOfScope(reason=reason, usage=result.usage, exchange=result.exchange, duration_ms=result.duration_ms)

    if action == "clarify":
        question = str(data.get("question") or "").strip()
        if not question:
            raise LLMError("The model asked to clarify but gave no question.")
        options_query = str(data.get("options_query") or "").strip()
        if options_query and not _looks_read_only(options_query, "cypher"):
            options_query = ""
        return Clarification(
            question=question,
            usage=result.usage,
            options=[str(o).strip() for o in (data.get("options") or []) if str(o).strip()],
            options_query=options_query,
            exchange=result.exchange,
            duration_ms=result.duration_ms,
        )

    kind = str(data.get("kind") or "single_query")
    if kind not in INTENT_KINDS:
        kind = "single_query"
    return Intent(
        kind=kind,
        summary=str(data.get("summary") or "").strip(),
        refs=[str(r).strip() for r in (data.get("refs") or []) if str(r).strip()],
        expects=[str(e).strip() for e in (data.get("expects") or []) if str(e).strip()],
        confidence=float(data.get("confidence") or 1.0),
        skills_applied=[str(s).strip() for s in (data.get("skills_applied") or []) if str(s).strip()],
        rules_cited=[str(r).strip() for r in (data.get("rules_cited") or []) if str(r).strip()],
        usage=result.usage,
        exchange=result.exchange,
        duration_ms=result.duration_ms,
    )
