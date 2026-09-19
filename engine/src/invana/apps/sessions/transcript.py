"""Turning a session's messages into prompt context and human labels.

Pure — no session, no rules about who may do anything (migration-plan §4.1).
The history window is what NL translation reads back as conversation context.
"""

from __future__ import annotations

from invana.apps.sessions.models import SessionMessage, SessionMessageRole, SessionMessageStatus
from invana.graph.connectors.base.exceptions import QueryErrorCategory

"""Service layer for Query Sessions (docs/for-developers/modules/ask/spec.md).

Owns session/message persistence. Sessions are private to their creator and
graph-scoped; ``get_or_404`` enforces both. Answering an ask — translate,
validate, execute, project — is the run runtime's job
(docs/for-developers/modules/ask/features/streaming-and-the-workflow.md,
``invana.runtime``); this module keeps the helpers those tasks share
(provider resolution, grounding, history assembly, modeller draft binding).
"""

_LANGUAGE_LABEL = {"cypher": "Cypher", "gremlin": "Gremlin"}

# How many prior turns to replay as conversation context for an NL ask (docs/for-developers/modules/ask/spec.md),
# so a follow-up like "only show 5" can refine the previous query. Bounded to keep
# the prompt small; this is read-only translation, so the risk is low.
_HISTORY_TURNS = 6

# Backend-owned copy for NL-mode failures. The user typed a question,
# not a query, so the raw driver error (a Cypher/Gremlin parser message) is
# meaningless to them — show guidance keyed off the failure category instead.
# The real error is still captured in the audit event + OTel span for review.
_FRIENDLY_QUERY_ERROR = {
    QueryErrorCategory.SYNTAX: (
        "I couldn't turn that into a query I can run. Try rephrasing, adding more detail, or narrowing your question."
    ),
    QueryErrorCategory.TIMEOUT: "That took too long to answer. Try narrowing it down or being more specific.",
}

_FRIENDLY_QUERY_ERROR_DEFAULT = "I couldn't get an answer for that. Try rephrasing or narrowing your question."


def _friendly_query_error(category: str) -> str:
    """User-facing copy for an NL ask whose generated query failed to execute."""
    return _FRIENDLY_QUERY_ERROR.get(category, _FRIENDLY_QUERY_ERROR_DEFAULT)


def _title_from_text(text: str) -> str:
    clean = " ".join(text.split())
    if not clean:
        return "New session"
    return f"{clean[:64]}…" if len(clean) > 64 else clean


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _context_turns(rows: list[SessionMessage]) -> list[dict]:
    """Prior successful turns as structured ``{prompt, query, rationale}`` (docs/for-developers/modules/ask/spec.md).

    Pairs each user prompt with the assistant's generated query (and rationale,
    when present). Only ``ok`` turns that carry a ``source_query`` contribute —
    ``nl`` and ``ql`` alike, so a follow-up can refine a hand-typed query too.
    Orphaned user turns (whose assistant reply failed or is still running) are
    dropped, keeping the sequence a clean alternation. This is the single source
    of truth for both the replayed history (``_assemble_history``) and the UI
    disclosure (docs/for-developers/modules/ask/features/reasoning-trace.md).
    """
    turns: list[dict] = []
    pending_user: str | None = None
    for m in rows:  # ascending seq
        # Canvas operations (expand/load) are not conversational turns
        # (docs/for-developers/modules/explore/features/boards.md) —
        # their generated traversal must never leak into NL translation context.
        # Skipping both rows of the pair also clears any pending user prompt, but
        # a real query's prompt is always immediately followed by its own reply,
        # never an operation, so nothing legitimate is dropped.
        if m.operation is not None:
            pending_user = None
            continue
        if m.role == SessionMessageRole.user:
            pending_user = m.content
        elif (
            m.role == SessionMessageRole.assistant and m.status == SessionMessageStatus.ok and pending_user is not None
        ):
            if m.source_query:
                turns.append(
                    {"kind": "query", "prompt": pending_user, "query": m.source_query, "rationale": m.rationale or ""}
                )
            else:
                # A clarification reply (docs/for-developers/modules/ask/features/clarifying-questions.md): no query
                # ran; its content is the
                # question. Replayed so the model remembers what it asked.
                turns.append({"kind": "clarify", "prompt": pending_user, "question": m.content})
            pending_user = None
        else:
            pending_user = None
    return turns


def _assemble_history(rows: list[SessionMessage]) -> list[dict]:
    """Structured prior turns → provider-agnostic chat messages (docs/for-developers/modules/ask/spec.md).

    Plain text, not tool_use/tool_result blocks: those are provider-specific,
    whereas user/assistant text serializes identically across every provider
    ``complete_tool`` dispatches to. The current turn still emits via the forced
    ``submit_query`` tool; the clean user/assistant alternation satisfies the
    strictest provider (Anthropic).
    """
    out: list[dict] = []
    for t in _context_turns(rows):
        if t["kind"] == "query":
            content = f"{t['query']}\n-- {t['rationale']}" if t["rationale"] else t["query"]
        else:  # clarify — the assistant asked a question instead of querying
            content = t["question"]
        out.append({"role": "user", "content": t["prompt"]})
        out.append({"role": "assistant", "content": content})
    return out


def _model_summary(summary: str, counts: dict[str, int]) -> str:
    """Assistant reply for a generation turn: the model's summary + what was added.

    Backend-owned message so the FE needs no extra fields — the counts
    ride the existing ``content``. The "Added …" line is appended only when
    something new was created (a pure refinement of existing types shows just the
    summary)."""
    parts = []
    if counts["node_types"]:
        parts.append(_plural(counts["node_types"], "node type"))
    if counts["edge_types"]:
        parts.append(_plural(counts["edge_types"], "edge type"))
    if counts["property_keys"]:
        parts.append(_plural(counts["property_keys"], "property key"))
    if parts:
        return f"{summary}\n\nAdded {', '.join(parts)}."
    return summary
