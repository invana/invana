"""What every step in the catalogue is handed, and what it may raise.

``RunVars`` is the run's shared state, ``TaskContext`` is this step's slice of
the world (a DB session, the graph manager, the emitter, the step row), and
``Out`` is what a step returns. A step that cannot proceed raises
``NeedsInput`` (the model asked back — the run suspends) or ``TaskFailure``
carrying a failure **class**
(docs/for-developers/modules/ask/features/when-it-cannot-answer.md), so the
interpreter can decide between retry, diagnose and stop.

The shared failure builders live here too: every step group turns the same
``HTTPException`` and ``QueryExecutionError`` into the same diagnosis.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.query_service import QueryExecutionError, resolve_query_language
from invana.apps.graphs.schemas import QueryResponse
from invana.apps.llm.intent import Intent
from invana.apps.llm.propose import ModelProposal
from invana.apps.llm_providers.models import LLMProvider
from invana.apps.modeller.models import GraphModel, GraphVersion
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import Session
from invana.apps.sessions.transcript import (
    _assemble_history,
)
from invana.apps.skills.models import Rule, Skill
from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.runtime.models import TaskRun
from invana.runtime.stream import Emitter

# ── Contract ──────────────────────────────────────────────────────────────────


class TaskFailure(Exception):
    """A task failed. ``cls`` is the failure class from
    docs/for-developers/modules/ask/features/when-it-cannot-answer.md that decides the response.

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
    """The model asked a question instead of answering
    (docs/for-developers/modules/ask/features/clarifying-questions.md)."""

    def __init__(self, *, question: str, options: list[str]) -> None:
        super().__init__(question)
        self.question = question
        self.options = options


class CannotAnswer(Exception):
    """The ask is outside this graph — a legitimate outcome, not a failure.

    The run **succeeds**: promise #4 is that Invana says so, visibly
    styled as *not* an answer, rather than inventing one or erroring. Raised by
    *Understand*, so the judgement lands before any query is written.
    """

    def __init__(self, *, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(slots=True)
class LoadVars:
    """One load's working state. Populated for ``ask_kind = "import"``.

    It lives here because nothing below the runtime describes a load any more:
    loading owns no records, so there is no app to declare this in
    (the-runtime-package.md § 4a). A stage hands the next one tens of thousands
    of parsed records and a plan document is not where that goes — the split
    `load-data.md` **LD21** keeps is that ``${steps.x.y}`` binds what the
    catalogue **declares**, which is counts and ids, so those ride the plan and
    the records ride here.
    """

    #: Where the records are, and what the run was opened against. The prologue
    #: settled these before the first node ran (**LD20**).
    root: str = ""
    model_id: str = ""
    version_id: str = ""
    #: Identity keys, read from `model.json` when the folder ships one.
    model_json: dict = field(default_factory=dict)
    # validate_records →
    valid_nodes: dict[str, list[dict]] = field(default_factory=dict)
    valid_edges: dict[str, list[dict]] = field(default_factory=dict)
    #: Edges whose endpoints these records do not carry — `stitch` decides.
    deferred: list[dict] = field(default_factory=list)
    #: Accumulated across stages, because a rejection found while stitching
    #: belongs in the same report as one found while validating.
    report: list[dict] = field(default_factory=list)
    total: int = 0
    # write_graph →
    counts: dict[str, dict[str, int]] = field(default_factory=dict)
    written: int = 0


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
    # : On a resumed run (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) the question this pass
    # answers — ``prompt``
    #: is then the user's answer to it. Recorded in the step's input digest so
    #: every round of a multi-question clarification is auditable on its own.
    answering: str | None = None
    language: str | None = None
    timeout_s: float | None = None
    parameters: dict | None = None
    provider: LLMProvider | None = None
    history: list[dict] = field(default_factory=list)
    grounding: GraphVersion | None = None
    # The prose the agent carries into every prompt (docs/for-developers/modules/ask/features/reasoning-trace.md).
    # ``skills`` is
    # the rows; a model's self-reported name maps back to that skill's current
    # **version** id, so ``skills_applied`` stores what ``skills_offered`` does.
    skills: list[Skill] = field(default_factory=list)
    #: The statements always true in this run's scope — graph invariants, then
    #: the project's working rules, in that fixed order (skills/spec.md § 4).
    rules: list[Rule] = field(default_factory=list)
    instructions: str = ""
    # The agent this run thinks through, and the envelope that bounds it.
    agent: Any = None
    envelope: Any = None
    run: TaskRun | None = None
    # understand →
    intent: Intent | None = None
    # plan →
    plan_steps: list = field(default_factory=list)
    plan_origin: str | None = None
    #: The library plan this run is executing, when one was selected. Written
    #: onto the root run when the plan lands (LB12).
    task_plan_id: str | None = None
    # verify →
    verdict: str | None = None
    # delegation → the children this run opened, and what they emitted (R2:
    # the parent reads the child's stream, never its return value)
    spawned: list[str] = field(default_factory=list)
    delegated: list[dict] = field(default_factory=list)
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
    #: The load this run is carrying out, when it is carrying one out. Owned
    #: by the catalogue's own body modules and only carried here (LD21).
    load: LoadVars | None = None


@dataclass(slots=True)
class TaskContext:
    db: AsyncSession
    manager: GraphConnectionManager
    emitter: Emitter
    step: TaskRun
    #: Set by the Plan step so the runtime can queue the rows the plan asks
    #: for; the runtime reads it after the step settles.
    planned: list | None = None
    #: The files this step read or wrote, in the order it touched them — what
    #: the step dashboard's Artifacts panel lists (SR38). It rides the context
    #: rather than ``Out`` so a step that raises still keeps what it had already
    #: read: *needs input* after reading four files read four files.
    artifacts: list[dict] = field(default_factory=list)
    #: The runtime, so a ``delegate`` step can start its child. Typed loosely
    #: to keep the task layer from importing the adapter it runs under.
    runtime: Any = None

    def artifact(self, name: str, *, direction: str, summary: str | None = None) -> None:
        """Record one file this step read or wrote.

        ``direction`` is ``read`` or ``written`` — the word the Artifacts panel
        shows as a chip, so a reader can tell a source from a product without
        opening either.
        """
        entry: dict[str, Any] = {"name": name, "direction": direction}
        if summary:
            entry["summary"] = summary
        self.artifacts.append(entry)

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


async def query_language_for(ctx: TaskContext, v: RunVars, *, strict: bool) -> str:
    """The dialect this run speaks, resolved once and remembered on ``RunVars``.

    Reading the connector's dialect is **connection metadata, not a graph
    read** — no query is sent — which is why it lives here, in the shared
    contract, rather than pulling ``apps/graphs`` into a bound module that
    would then span two bounds.

    ``strict`` is the difference between the two callers. *Translate* needs a
    real dialect to ground the prompt, so an unavailable connection is its
    failure to report. *Validate*'s check is textual: when the connection
    cannot say, Cypher's markers are the fallback and *Execute* reports the
    connection.
    """
    if v.query_language:
        return v.query_language
    if v.language:
        v.query_language = v.language
        return v.query_language
    try:
        v.query_language = (await resolve_query_language(ctx.db, graph=v.graph, manager=ctx.manager)).value
    except HTTPException as exc:
        if strict:
            raise http_failure(exc) from exc
        v.query_language = "cypher"
    return v.query_language


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


# The connection/config codes ``query_service`` raises carry a machine code and
# no prose, so each needs a sentence of its own here.
_HTTP_MESSAGES = {
    "no_connection": "This graph has no graph connection yet.",
    "graph_not_active": "The graph connection is not active right now.",
    "unsupported_query_language": "The connection speaks neither Cypher nor Gremlin.",
}


def http_failure(exc: HTTPException) -> TaskFailure:
    """A config/availability answer about the graph — never an engine defect.

    The detail is a machine code, so a missing ``message`` must not fall
    through to ``str(detail)``: the reader would get a Python dict where a
    sentence belongs.
    """
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    code = str(detail.get("error") or "")
    message = str(detail.get("message") or _HTTP_MESSAGES.get(code) or "The graph connection is not available.")
    if code == "read_only_graph":
        return TaskFailure(cls="blocked", cause="query_not_read_only", message=message, short="not read-only")
    return TaskFailure(
        cls="blocked", cause="db_unreachable", message=message, short="no connection", evidence={"error": code}
    )


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


def offered_skill_version_ids(v: RunVars) -> list[str]:
    """What prompt assembly is about to put in front of the model.

    Recorded on the step **before** the call, because *offered* is a fact about
    the prompt — it stays true whether or not the model says anything about it.

    The **version** is what is recorded, never the bare skill id
    ([SK3](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
    the prose in this prompt is one particular published text, and a count that
    spans a rewrite is a claim about two different skills wearing one name
    ([US3](docs/for-developers/modules/skills/features/usage.md)).
    """
    return [s.current_version_id for s in v.skills if s.current_version_id]


def offered_rule_version_ids(v: RunVars) -> list[str]:
    """The rule versions this prompt carries, in the order it carries them.

    A fact about the prompt, recorded before the call — the same shape and the
    same reason as the skills above (RU7).
    """
    return [r.current_version_id for r in v.rules if r.current_version_id]


def cited_rule_version_ids(v: RunVars, statements: list[str]) -> list[str]:
    """Map the model's citations back to the versions it was offered.

    The model cites a rule by its **statement**, because that is what it was
    shown; anything that does not match one of the offered statements is
    dropped, exactly as an unknown skill name is. A rule is offered and cited,
    never enforced (RU5) — nothing downstream reads this as permission.
    """
    by_statement = {r.statement.strip().lower(): r.current_version_id for r in v.rules if r.current_version_id}
    return [by_statement[k] for s in statements if (k := s.strip().lower()) in by_statement]


def _report_ids(v: RunVars, names: list[str]) -> list[str]:
    """Map the model's self-reported skill names back to version ids.

    A name the graph does not have is dropped rather than stored: a report
    about a skill that was never offered is noise, not evidence.
    """
    by_name = {s.name.lower(): s.current_version_id for s in v.skills if s.current_version_id}
    return [by_name[n.lower()] for n in names if n.lower() in by_name]


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _sha(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()[:12]


async def load_grounding(db: AsyncSession, graph_id: str) -> GraphVersion | None:
    return await SessionManager()._grounding_version(db, graph_id)


def assemble_history(rows) -> list[dict]:
    return _assemble_history(rows)
