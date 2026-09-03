"""The tasks a thinking is made of (RFC-048 task contract, trimmed to the MVP).

Each task takes the run's shared ``RunVars`` and a ``TaskContext`` (a DB session
for this step, the graph manager, the emitter, the step row) and either returns
an ``Out`` (what the step row shows + what the next task needs), raises
``NeedsInput`` (the model asked back — the thinking suspends, RFC-048 pause /
resume) or raises ``TaskFailure`` carrying a failure **class** (RFC-052 § 2) so
the runtime can decide between retry, diagnose and stop.

The bodies are today's ``sessions.services`` orchestration, split at the task
boundaries; user-facing output goes through ``ctx.emit`` (rule 2 of the task
contract), the return value is for the next task.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions
from invana.events.services import current_trace_id, emit_event
from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph
from invana.graphs.query_service import QueryExecutionError, execute_query, resolve_query_language
from invana.graphs.schemas import QueryResponse
from invana.llm import LLMError
from invana.llm.propose import ModelProposal, propose_model, validate_proposal
from invana.llm.translate import Clarification, _looks_read_only, nl_to_query
from invana.llm_providers.models import LLMProvider
from invana.modeller.models import GraphModel, GraphVersion
from invana.modeller.store import ModelStore
from invana.sessions.models import Session
from invana.sessions.reconcile import reconcile_proposal
from invana.sessions.services import (
    _assemble_history,
    _ensure_model_and_draft,
    _grounding_version,
    _values_from_result,
)
from invana.thinking.models import ThinkingStep
from invana.thinking.stream import Emitter

# ── Contract ──────────────────────────────────────────────────────────────────


class TaskFailure(Exception):
    """A task failed. ``cls`` is the RFC-052 failure class that decides the response.

    ``cause`` is the machine code for the diagnosis, ``message`` the user-facing
    sentence, ``evidence`` the structured facts it was derived from.
    """

    def __init__(
        self,
        *,
        cls: str,
        cause: str,
        message: str,
        short: str | None = None,
        evidence: dict | None = None,
        raw: str | None = None,
    ) -> None:
        super().__init__(message)
        self.cls = cls
        self.cause = cause
        self.message = message
        self.short = short or message
        self.evidence = evidence or {}
        self.raw = raw


class NeedsInput(Exception):
    """The model asked a question instead of answering (RFC-038)."""

    def __init__(self, *, question: str, options: list[str], detail: str) -> None:
        super().__init__(question)
        self.question = question
        self.options = options
        self.detail = detail


@dataclass(slots=True)
class Out:
    detail: str
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    tokens_in: int | None = None
    tokens_out: int | None = None


@dataclass(slots=True)
class RunVars:
    """Everything the tasks of one run read and write."""

    graph: Graph
    sess: Session
    actor_id: str
    encryption_key: str
    user_message_id: str
    user_seq: int
    assistant_message_id: str
    mode: str  # "nl" | "ql"
    prompt: str
    language: str | None = None
    timeout_s: float | None = None
    parameters: dict | None = None
    provider: LLMProvider | None = None
    history: list[dict] = field(default_factory=list)
    grounding: GraphVersion | None = None
    # understand →
    query: str | None = None
    query_language: str | None = None
    via: str | None = None
    llm_ms: float | None = None
    rationale: str | None = None
    # execute / project →
    result: QueryResponse | None = None
    nodes: int = 0
    edges: int = 0
    summary: str | None = None
    # modeller
    model: GraphModel | None = None
    draft: GraphVersion | None = None
    proposal: ModelProposal | None = None
    counts: dict[str, int] | None = None


@dataclass(slots=True)
class TaskContext:
    db: AsyncSession
    manager: GraphConnectionManager
    emitter: Emitter
    step: ThinkingStep

    async def emit(self, kind: str, payload: dict | None = None) -> None:
        await self.emitter.emit(kind, payload, idem_key=f"{self.step.id}:{kind}")

    async def progress(self, detail: str) -> None:
        """Update the step row's one-liner mid-flight and tell subscribers."""
        self.step.detail = detail[:255]
        await self.db.flush()
        await self.emitter.emit("step.progress", {"step_id": self.step.id, "detail": self.step.detail})


# ── Helpers ───────────────────────────────────────────────────────────────────


def _provider_label(p: LLMProvider) -> str:
    return f"{p.provider.value} · {p.model_id}"


def _line_count(text: str) -> int:
    return text.count("\n") + 1


_CYPHER_LABEL = re.compile(r":\s*`?([A-Za-z_][A-Za-z0-9_]*)`?")
_GREMLIN_LABEL = re.compile(r"hasLabel\(\s*['\"]([^'\"]+)['\"]")


def labels_in(query: str, language: str | None) -> list[str]:
    """Best-effort label scan for the Validate step's description."""
    pattern = _GREMLIN_LABEL if language == "gremlin" else _CYPHER_LABEL
    seen: list[str] = []
    for m in pattern.finditer(query):
        name = m.group(1)
        if name not in seen:
            seen.append(name)
        if len(seen) >= 6:
            break
    return seen


def _http_failure(exc: HTTPException) -> TaskFailure:
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    code = str(detail.get("error") or "")
    message = str(detail.get("message") or exc.detail)
    if code == "read_only_graph":
        return TaskFailure(cls="blocked", cause="query_not_read_only", message=message)
    return TaskFailure(cls="blocked", cause="db_unreachable", message=message, evidence={"error": code})


def _query_failure(exc: QueryExecutionError, *, query: str, mode: str) -> TaskFailure:
    if exc.category == QueryErrorCategory.TIMEOUT:
        return TaskFailure(
            cls="transient",
            cause="timeout",
            message="The graph did not answer in time.",
            short="timeout",
            evidence={"generated_query": query, "error": str(exc)},
            raw=str(exc),
        )
    if exc.category == QueryErrorCategory.SYNTAX:
        return TaskFailure(
            cls="repairable",
            cause="query_invalid",
            message=(
                "I couldn't turn that into a query the graph accepts."
                if mode == "nl"
                else f"The graph rejected the query: {exc}"
            ),
            short="query rejected",
            evidence={"generated_query": query, "error": str(exc)},
            raw=str(exc),
        )
    return TaskFailure(
        cls="transient",
        cause="db_error",
        message="The graph returned an error." if mode == "nl" else str(exc),
        short="graph error",
        evidence={"generated_query": query, "error": str(exc)},
        raw=str(exc),
    )


# ── nl-query / ql-query ───────────────────────────────────────────────────────


async def translate_thought(ctx: TaskContext, v: RunVars) -> Out:
    """NL → grounded query via the bound provider (RFC-030); asks back when ambiguous (RFC-038)."""
    assert v.provider is not None
    turns = len(v.history) // 2
    await ctx.progress(f"{_provider_label(v.provider)} · reading {turns} prior turn{'' if turns == 1 else 's'}")
    language = v.language or (await resolve_query_language(ctx.db, graph=v.graph, manager=ctx.manager)).value
    try:
        generated = await nl_to_query(
            provider=v.provider,
            prompt=v.prompt,
            language=language,
            version=v.grounding,
            encryption_key=v.encryption_key,
            history=v.history,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc

    v.via = _provider_label(v.provider)
    v.llm_ms = generated.duration_ms
    usage = generated.usage

    if isinstance(generated, Clarification):
        options = list(generated.options)
        if generated.options_query:
            try:
                opt_result = await execute_query(
                    ctx.db,
                    graph=v.graph,
                    manager=ctx.manager,
                    query=generated.options_query,
                    parameters=None,
                    actor_id=v.actor_id,
                    session_id=v.sess.id,
                    timeout_s=v.timeout_s,
                )
                fetched = _values_from_result(opt_result)
                if fetched:
                    options = fetched
            except (QueryExecutionError, HTTPException):
                pass  # keep the fixed options / question-only
        await emit_event(
            ctx.db,
            action=actions.LLM_TRANSLATE,
            target_kind=actions.TARGET_SESSION,
            target_id=v.sess.id,
            graph_id=v.graph.id,
            actor_id=v.actor_id,
            details={
                "provider": v.provider.provider.value,
                "model_id": v.provider.model_id,
                "action": "clarify",
                "question": generated.question,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "duration_ms": round(generated.duration_ms),
            },
            trace_id=current_trace_id(),
        )
        ctx.step.tokens_in, ctx.step.tokens_out = usage.input_tokens, usage.output_tokens
        ctx.step.input = {"prompt": v.prompt, "context_turns": turns, "model": v.via}
        ctx.step.output = {"question": generated.question, "options": options}
        raise NeedsInput(question=generated.question, options=options, detail=generated.question[:120])

    v.query = generated.query
    v.query_language = generated.language
    v.rationale = generated.rationale or None
    if generated.rationale:
        await ctx.emit("reasoning", {"text": generated.rationale})
    await ctx.emit(
        "query.proposed",
        {"query": generated.query, "language": generated.language, "rationale": generated.rationale, "via": v.via},
    )
    await emit_event(
        ctx.db,
        action=actions.LLM_TRANSLATE,
        target_kind=actions.TARGET_SESSION,
        target_id=v.sess.id,
        graph_id=v.graph.id,
        actor_id=v.actor_id,
        details={
            "provider": v.provider.provider.value,
            "model_id": v.provider.model_id,
            "language": generated.language,
            "generated_query": generated.query,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "duration_ms": round(generated.duration_ms),
        },
        trace_id=current_trace_id(),
    )
    return Out(
        detail=f"proposed {generated.language.title()} · {_line_count(generated.query)} line"
        f"{'' if _line_count(generated.query) == 1 else 's'}",
        input={
            "prompt": v.prompt,
            "schema": getattr(v.grounding, "id", None),
            "context_turns": turns,
            "model": v.via,
            "timeout_s": v.timeout_s,
        },
        output={"query": generated.query, "language": generated.language, "rationale": generated.rationale},
        tokens_in=usage.input_tokens,
        tokens_out=usage.output_tokens,
    )


async def validate_query(ctx: TaskContext, v: RunVars) -> Out:
    """A query is never run unvalidated — the read-only check, as a step on the record."""
    query = v.query or v.prompt
    v.query = query
    if v.query_language is None:
        # The check is textual — when the connection can't tell us the dialect,
        # default to Cypher's markers and let Execute report the connection.
        try:
            v.query_language = (
                v.language or (await resolve_query_language(ctx.db, graph=v.graph, manager=ctx.manager)).value
            )
        except HTTPException:
            v.query_language = v.language or "cypher"
    if not _looks_read_only(query, v.query_language):
        raise TaskFailure(
            cls="blocked",
            cause="query_not_read_only",
            message="That query would write to the graph — Invana only runs read-only queries.",
            short="not read-only",
            evidence={"generated_query": query},
        )
    labels = labels_in(query, v.query_language)
    return Out(
        detail="read-only ✓" + (f" · {', '.join(labels)}" if labels else ""),
        input={"query_sha": _sha(query), "language": v.query_language},
        output={"verdict": "read-only", "labels": labels},
    )


async def execute_graph_query(ctx: TaskContext, v: RunVars) -> Out:
    """Run the query against the bound connection; the result rides the stream."""
    assert v.query is not None
    await ctx.progress("waiting for the graph")
    try:
        result = await execute_query(
            ctx.db,
            graph=v.graph,
            manager=ctx.manager,
            query=v.query,
            parameters=v.parameters,
            actor_id=v.actor_id,
            session_id=v.sess.id,
            timeout_s=v.timeout_s,
        )
    except HTTPException as exc:
        raise _http_failure(exc) from exc
    except QueryExecutionError as exc:
        raise _query_failure(exc, query=v.query, mode=v.mode) from exc
    v.result = result
    v.query_language = result.query_language
    # One emission carrying the whole result today; ``graph.delta`` batches
    # arrive when the connector streams (RFC-048 build step 8).
    await ctx.emit("result", {"result": result.model_dump(), "message_id": v.assistant_message_id})
    rows = result.row_count
    return Out(
        detail=f"{rows} row{'' if rows == 1 else 's'} · {result.execution_time_ms}ms",
        input={"query_sha": _sha(v.query), "timeout_s": v.timeout_s, "parameters": bool(v.parameters)},
        output={"rows": rows, "execution_time_ms": result.execution_time_ms, "result_type": result.result_type},
    )


async def shape_for_canvas(ctx: TaskContext, v: RunVars) -> Out:
    """Counts + the one-line summary the reply shows (RFC-033)."""
    assert v.result is not None
    r = v.result
    v.nodes = len(r.data.nodes) if r.data else 0
    v.edges = len(r.data.edges) if r.data else 0
    if r.result_type == "graph":
        v.summary = f"Returned {_plural(v.nodes, 'node')} and {_plural(v.edges, 'relationship')}."
        detail = f"{_plural(v.nodes, 'node')} · {_plural(v.edges, 'relationship')} → canvas"
    else:
        v.summary = f"Returned {_plural(r.row_count, 'row')}."
        detail = f"{r.row_count} row{'' if r.row_count == 1 else 's'} → table"
    return Out(detail=detail, output={"nodes": v.nodes, "edges": v.edges, "result_type": r.result_type})


# ── modeller-generate ─────────────────────────────────────────────────────────


async def understand_ask(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve the draft a modeller session authors and the turns to replay (RFC-031)."""
    assert v.provider is not None
    v.model, v.draft = await _ensure_model_and_draft(ctx.db, sess=v.sess, graph=v.graph, prompt=v.prompt)
    turns = len(v.history) // 2
    return Out(
        detail=f"{_provider_label(v.provider)} · draft of {v.model.name} · {_plural(turns, 'prior turn')}",
        input={"prompt": v.prompt, "model_id": v.model.id, "draft_version_id": v.draft.id, "context_turns": turns},
    )


async def propose_model_task(ctx: TaskContext, v: RunVars) -> Out:
    assert v.provider is not None and v.draft is not None
    await ctx.progress(f"{_provider_label(v.provider)} · proposing node and edge types")
    try:
        proposal = await propose_model(
            provider=v.provider,
            prompt=v.prompt,
            version=v.draft,
            encryption_key=v.encryption_key,
            history=v.history,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc
    v.via = _provider_label(v.provider)
    v.llm_ms = proposal.duration_ms
    usage = proposal.usage
    if isinstance(proposal, Clarification):
        await emit_event(
            ctx.db,
            action=actions.LLM_TRANSLATE,
            target_kind=actions.TARGET_SESSION,
            target_id=v.sess.id,
            graph_id=v.graph.id,
            actor_id=v.actor_id,
            details={
                "provider": v.provider.provider.value,
                "model_id": v.provider.model_id,
                "action": "clarify",
                "question": proposal.question,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "duration_ms": round(proposal.duration_ms),
            },
            trace_id=current_trace_id(),
        )
        ctx.step.tokens_in, ctx.step.tokens_out = usage.input_tokens, usage.output_tokens
        raise NeedsInput(question=proposal.question, options=list(proposal.options), detail=proposal.question[:120])
    v.proposal = proposal
    if proposal.summary:
        await ctx.emit("reasoning", {"text": proposal.summary})
    n, e = len(proposal.node_types), len(proposal.edge_types)
    return Out(
        detail=f"proposed {n} node type{'' if n == 1 else 's'} · {e} edge type{'' if e == 1 else 's'}",
        output={
            "node_types": [t["name"] for t in proposal.node_types],
            "edge_types": [t["name"] for t in proposal.edge_types],
            "summary": proposal.summary,
        },
        tokens_in=usage.input_tokens,
        tokens_out=usage.output_tokens,
    )


async def validate_proposal_task(ctx: TaskContext, v: RunVars) -> Out:
    """Referential integrity before any draft mutation (RFC-031 D9), then reconcile into the draft."""
    assert v.proposal is not None and v.draft is not None and v.model is not None and v.provider is not None
    existing = {nt.name for nt in v.draft.node_types}
    try:
        validate_proposal(v.proposal, existing_node_type_names=existing)
    except LLMError as exc:
        raise TaskFailure(
            cls="repairable", cause="proposal_invalid", message=exc.message, short="proposal rejected", raw=exc.message
        ) from exc
    v.counts = await reconcile_proposal(ctx.db, store=ModelStore(), version=v.draft, proposal=v.proposal)
    await emit_event(
        ctx.db,
        action=actions.MODEL_GENERATE,
        target_kind=actions.TARGET_SESSION,
        target_id=v.sess.id,
        graph_id=v.graph.id,
        actor_id=v.actor_id,
        details={
            "provider": v.provider.provider.value,
            "model_id": v.provider.model_id,
            "model_id_target": v.model.id,
            "node_type_count": v.counts["node_types"],
            "edge_type_count": v.counts["edge_types"],
            "property_key_count": v.counts["property_keys"],
            "input_tokens": v.proposal.usage.input_tokens,
            "output_tokens": v.proposal.usage.output_tokens,
            "latency_ms": round(v.proposal.duration_ms),
        },
        trace_id=current_trace_id(),
    )
    c = v.counts
    added = [
        f"{c[k]} {label}{'' if c[k] == 1 else 's'}"
        for k, label in (("node_types", "node type"), ("edge_types", "edge type"), ("property_keys", "property key"))
        if c[k]
    ]
    return Out(
        detail=("added " + ", ".join(added)) if added else "no new types · refined existing ones",
        output={"counts": c, "draft_version_id": v.draft.id},
    )


# ── Registry + small helpers ─────────────────────────────────────────────────

TASKS = {
    "translate_thought": translate_thought,
    "validate_query": validate_query,
    "execute_graph_query": execute_graph_query,
    "shape_for_canvas": shape_for_canvas,
    "understand_ask": understand_ask,
    "propose_model": propose_model_task,
    "validate_proposal": validate_proposal_task,
}


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _sha(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()[:12]


async def load_grounding(db: AsyncSession, graph_id: str) -> GraphVersion | None:
    return await _grounding_version(db, graph_id)


def assemble_history(rows) -> list[dict]:
    return _assemble_history(rows)
