"""Pydantic read/request models for runs
(docs/for-developers/modules/ask/features/streaming-and-the-workflow.md)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.skills.schemas import OfferedRule
from invana.core.lists import Filter, ListSpec
from invana.core.metrics import Change
from invana.plugins.sdk.manifest import Bound
from invana.runtime.models import ExitReason, RunStatus


class RunNodeRead(BaseModel):
    """One node of a run, read as a row of the trace."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_run_id: str | None = None
    message_id: str | None = None
    seq: int
    task_key: str
    label: str
    attempt: int
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    detail: str = ""
    input: dict | None = None
    output: dict | None = None
    error: dict | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    tokens: int | None = None


class TaskRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    flow_key: str
    #: The run this row is a step of, and ``None`` on a root
    #: (:doc:`see-what-ran SR44 <../../../docs/for-developers/modules/operate/features/see-what-ran>`).
    #: ``task_runs`` is one table, so this route answers for a step as well as
    #: for a run — which is what lets a step board opened **cold** find the
    #: trace it belongs to without carrying the run in its page id.
    parent_run_id: str | None = None
    #: The ask this run carries, when it is a root. A node has none.
    ask_kind: str | None = None
    body: str | None = None
    status: str
    # How it ended, said the way a reader would say it: ``answered`` ·
    # ``cannot_answer`` · ``failed`` · ``cancelled``
    # (docs/for-developers/modules/ask/features/when-it-cannot-answer.md CA1).
    outcome: str | None = None
    assistant_message_id: str | None = None
    queued_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: dict | None = None
    #: Stored when the run settles — the reader formats, never derives.
    duration_ms: int | None = None
    queue_ms: int | None = None
    work_ms: int | None = None
    ask_ms: int | None = None
    wait_ms: int | None = None
    #: The root's own spend plus its direct nodes'.
    run_tokens_in: int | None = None
    run_tokens_out: int | None = None
    run_tokens: int | None = None
    #: Attempts that succeeded, and the plan's length as far as its nodes reach.
    steps_done: int = 0
    steps_total: int = 0
    stream_seq: int
    #: The trace the run was started in — opens it in the collector's UI.
    trace_id: str | None = None
    #: The provider's version name the run called; null for one that called none.
    model_version: str | None = None
    #: The root run this one re-ran.
    rerun_of_run_id: str | None = None
    steps: list[RunNodeRead] = []


class TaskRunSummary(BaseModel):
    """One run, as a **list** row — the plan and its verdict, without the steps.

    Three surfaces read this and they want the same few facts: an agent's
    *Recent plans* (what has this agent actually run?), the flow library's
    *candidates* (which generated plans served and were never promoted?) and the
    **journal** (what ran in this Graph, filtered by kind). Returning the step
    rows here would make any of them an order of magnitude larger for nothing —
    the trace is a per-run fetch.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    flow_key: str
    status: str
    #: What kind of work this run is — ``nl`` · ``ql`` · ``canvas`` · ``import``
    #: · ``bulk`` · ``stitch``. Null on a child run, a root-only fact.
    kind: str | None = None
    #: What it was about, in the words the opener wrote — *Import news-tv*. A
    #: journal row names what changed the graph without a second request.
    body: str | None = None
    #: ``template:<key>@<v>`` · ``generated`` · ``envelope`` · ``promoted:<key>``.
    plan_origin: str | None = None
    plan_revision: int = 0
    replans: int = 0
    agent_id: str | None = None
    #: ``execute`` · ``plan`` · ``evaluate`` — what the run was for.
    role: str = "execute"
    #: What started it — the run's origin, as ``f.origin`` filters it.
    triggered_by: str | None = None
    task_id: str | None = None
    #: The task's title, so a row reads without a second round-trip.
    task_title: str | None = None
    queued_at: datetime | None = None
    #: When the run actually began, which is what *elapsed* is measured from —
    #: a run that sat queued for a minute did not take a minute (SR45).
    started_at: datetime | None = None
    finished_at: datetime | None = None
    #: Stored when the run settles — the reader formats, never derives.
    duration_ms: int | None = None
    queue_ms: int | None = None
    work_ms: int | None = None
    ask_ms: int | None = None
    wait_ms: int | None = None
    step_count: int = 0
    #: The furthest step that is not merely queued — the row's "Execute" in
    #: ``Execute 5/7``. ``None`` before anything has started.
    step_label: str | None = None
    steps_done: int = 0
    steps_total: int = 0
    #: *Verify*'s verdict — ``yes`` · ``partial`` · ``no``. ``None`` means the
    #: run never reached Verify, which is **not** the same as "did not serve".
    served: str | None = None
    #: How the run ended, once it has — `answered` · `conversed` ·
    #: `cannot_answer` · `failed` · `cancelled` (CA8). ``None`` while it runs.
    outcome: str | None = None
    #: True once some library entry records this run as its origin.
    promoted: bool = False
    #: What the run spent, summed over its tasks — the journal row's second
    #: line (SR45). `0` here is a run that recorded no tokens, which a load is.
    tokens_in: int = 0
    tokens_out: int = 0
    #: ``tokens_in + tokens_out`` — the run's whole spend.
    tokens: int = 0
    #: What the run spent, summed over its priced steps. ``None`` when none had
    #: a published rate — *unknown*, never `0` (SR40).
    cost_usd: float | None = None
    #: The run's number in its Graph — ``#2291``.
    number: int | None = None
    #: The root agent's name, as it is now.
    agent_name: str | None = None
    #: ``Explorer`` · ``Todo`` · ``Schedule`` · ``Project`` · ``API``.
    origin: str | None = None
    #: The person the run is on behalf of, by username.
    started_by_name: str | None = None
    #: How many agents the run used — the root and every child with an agent.
    agents: int = 0
    #: Why it ended; ``None`` while it runs.
    exit_reason: str | None = None


class RunDay(BaseModel):
    """One calendar day of the window, in the reader's zone."""

    day: date
    runs: int


class SlowestRun(BaseModel):
    run_id: str
    #: What the journal row calls it.
    title: str
    #: Stored, or timed to now for a run still going.
    duration_ms: int


class RunStats(BaseModel):
    """The journal's tiles over a window, counted over every root run in it."""

    days: int
    #: Midnight in the reader's zone, the window's first day.
    since: datetime
    #: Standing now, whatever the window.
    live: int
    waiting: int
    runs: int
    succeeded: int
    failed: int
    cannot_answer: int
    tokens: int
    #: Runs in the window that spent any tokens.
    spending_runs: int
    #: Of the runs in the window that finished; null when none did.
    median_ms: int | None
    slowest: SlowestRun | None
    #: Oldest first, empty days included.
    by_day: list[RunDay]
    #: Ended runs in the window whose exit reason is ``served``.
    served: int = 0
    #: Ended runs in the window that did not serve, and why.
    not_served: int = 0
    not_served_by_reason: dict[str, int] = Field(default_factory=dict)
    #: Served over every ended run with a reason, 0 to 1; null when none ended.
    served_share: float | None = None
    #: The live root with the most agents under it, standing now.
    largest_live_run_id: str | None = None
    largest_live_agents: int | None = None
    #: Pending asks routed to the reader, standing now.
    waiting_approvals: int = 0


#: The list's tabs: ``live`` is queued or running, ``waiting`` held on a person,
#: ``ended`` every terminal status.
RUN_STATES = {"live": "live", "waiting": "waiting on a person", "ended": "ended"}

#: The windows ``since`` takes, over when a run was created.
RUN_SINCE = {"24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days"}

#: What the Runs list takes. Root runs only. With no ``interactive=true`` and no
#: ``origin``, canvas and system runs are left out; ``candidates=true`` narrows
#: to generated plans that served and were never promoted — the Promote picker.
#: The Runs list's *From*: where a root run came from, in the reader's words.
RUN_ORIGINS = ("Explorer", "Todo", "Schedule", "Project", "API")

RUN_LIST = ListSpec(
    filters={
        "status": Filter(
            values=tuple(s.value for s in RunStatus),
            labels={s.value: s.value.replace("_", " ") for s in RunStatus},
        ),
        "agent_id": Filter(title="agent"),
        "task_id": Filter(title="task"),
        "kind": Filter(),
        "origin": Filter(values=RUN_ORIGINS),
        "started_by": Filter(title="started by"),
        "since": Filter(values=tuple(RUN_SINCE), labels=RUN_SINCE),
        "state": Filter(values=tuple(RUN_STATES), labels=RUN_STATES),
        "exit_reason": Filter(
            title="exit",
            values=(*(r.value for r in ExitReason), "not_served"),
            labels={**{r.value: r.value.replace("_", " ") for r in ExitReason}, "not_served": "not served"},
        ),
        "candidates": Filter(values=("true",), labels={"true": "never promoted"}),
        "interactive": Filter(values=("true",), labels={"true": "canvas and system runs shown"}),
    },
    sorts=("-created_at",),
    search_title="ask",
)


class ResumeTaskRun(BaseModel):
    """The user's answer to a clarification (docs/for-developers/modules/ask/spec.md pause / resume)."""

    answer: str = Field(..., min_length=1)


class CancelResponse(BaseModel):
    id: str
    status: str


class RunRerun(BaseModel):
    """Re-run a settled run on the versions it recorded, on today's, or retuned.

    A retune names what changes; anything left out stays as the run recorded it.
    """

    versions: Literal["same", "current", "retune"] = "same"
    agent_version: int | None = None
    model_version: str | None = None
    max_tokens_run: int | None = Field(default=None, gt=0)
    lens_id: str | None = None


# ── The run page (docs/for-developers/modules/agents/features/the-run-page.md) ──


class RunHead(BaseModel):
    """What the run page's head says."""

    id: str
    number: int | None = None
    agent_id: str | None = None
    agent_name: str | None = None
    status: str
    exit_reason: str | None = None
    #: ``Explorer`` · ``Todo`` · ``Schedule`` · ``Project`` · ``API``.
    origin: str | None = None
    started_by_name: str | None = None
    #: What was asked, verbatim.
    body: str | None = None
    #: The session an Explorer ask came from, to open it.
    session_id: str | None = None
    session_title: str | None = None
    task_id: str | None = None
    task_title: str | None = None
    #: The tree's spend; ``None`` when no row in it recorded a token count.
    tokens: int | None = None
    #: The run's token ceiling; ``None`` when it has none.
    max_tokens_run: int | None = None
    #: The agent version the run pinned; ``None`` when it was not recorded.
    agent_version: int | None = None
    #: The model version the run pinned; ``None`` when it was not recorded.
    model_version: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    #: True when the run may be stopped (it has not ended).
    can_stop: bool = False
    #: True when the run may be rerun (it has ended).
    can_rerun: bool = False


class RunTiles(BaseModel):
    elapsed_ms: int | None = None
    #: The run's time limit; ``None`` when it has none.
    time_limit_ms: int | None = None
    #: As the head's: ``None`` when nothing in the tree recorded tokens.
    tokens: int | None = None
    max_tokens_run: int | None = None
    agents: int = 0
    #: Deepest child below the root.
    depth: int = 0
    steps: int = 0
    #: Steps that ran more than one attempt.
    redelivered: int = 0
    assets: int = 0
    files: int = 0
    branches: int = 0
    records_touched: int = 0
    writes_refused: int = 0
    #: Large runs: agents live now, queued now, and finishing a minute (last minute).
    live: int = 0
    queued: int = 0
    live_limit: int | None = None
    finishing_per_minute: int = 0
    peak_finishing: int = 0
    peak_finishing_at: datetime | None = None
    tokens_per_minute: int = 0
    served: int = 0
    not_served: int = 0
    #: Seconds until the last agent finishes at the last ten minutes' rate.
    eta_s: int | None = None


class AgentBar(BaseModel):
    """One agent's span on the run's clock."""

    run_id: str
    agent_id: str | None = None
    agent_name: str
    depth: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    status: str
    exit_reason: str | None = None
    #: Its state in words — ``served · 22k``, ``asking for 15k``, ``stopped by ravi``.
    state_line: str
    tokens: int = 0


class MinuteCount(BaseModel):
    minute: datetime
    count: int


class WaitingAsk(BaseModel):
    approval_id: str
    #: ``budget`` · ``send`` · ``access`` · ``delegation`` · ``question``.
    kind: str
    line: str
    #: True when the reader may decide it.
    for_you: bool = False


class RoleRow(BaseModel):
    """One role of a large run — every agent of one name."""

    role: str
    depth: int = 0
    agents: int
    served: int
    not_served: int
    running: int = 0
    waiting: int = 0
    tokens_p50: int | None = None
    tokens_p95: int | None = None
    time_p95_ms: int | None = None


class RunOverview(BaseModel):
    head: RunHead
    tiles: RunTiles
    #: True past 50 agents: the large-run reading.
    large: bool = False
    agents_over_time: list[AgentBar] = Field(default_factory=list)
    steps_per_minute: list[MinuteCount] = Field(default_factory=list)
    waiting: list[WaitingAsk] = Field(default_factory=list)
    finished_per_minute: list[MinuteCount] = Field(default_factory=list)
    live_over_time: list[MinuteCount] = Field(default_factory=list)
    by_role: list[RoleRow] = Field(default_factory=list)


class RunAgentNode(BaseModel):
    """One agent in a run's tree."""

    run_id: str
    parent_run_id: str | None = None
    agent_id: str | None = None
    agent_name: str
    #: Agents of one name are one role.
    role: str
    depth: int = 0
    status: str
    exit_reason: str | None = None
    state_line: str
    tokens: int = 0
    #: The tokens it may spend: its escrow, or the root's run budget.
    budget: int | None = None
    #: ``spawned`` · ``delegated`` · ``root``.
    how: str = "root"


class DelegationAsk(BaseModel):
    """A delegation waiting on a person, drawn dashed from the asking agent."""

    approval_id: str
    from_run_id: str
    agent_id: str | None = None
    agent_name: str
    line: str


class RoleCell(BaseModel):
    run_id: str
    status: str
    exit_reason: str | None = None


class RoleGroup(BaseModel):
    role: str
    depth: int = 0
    agents: int
    #: ``{status word: count}`` — served · running · waiting · not served · stopped.
    by_state: dict[str, int] = Field(default_factory=dict)
    line: str = ""
    cells: list[RoleCell] = Field(default_factory=list)


class RunAgents(BaseModel):
    origin_label: str
    origin_line: str
    nodes: list[RunAgentNode] = Field(default_factory=list)
    asks: list[DelegationAsk] = Field(default_factory=list)
    roles: list[RoleGroup] = Field(default_factory=list)


class RunStage(BaseModel):
    """Every step of one step key, in plan order."""

    step_key: str
    function: str
    status: str
    calls: int
    lanes: int = 1
    duration_ms: int | None = None
    p95_ms: int | None = None
    tokens: int = 0
    in_count: int | None = None
    out_count: int | None = None
    #: The card's last line — ``1 → 214 routes``.
    line: str = ""
    #: One line of what happened — ``9 pages ok · 2 refused · 3 failed``.
    summary: str = ""
    step_ids: list[str] = Field(default_factory=list)
    #: Step id → the run it belongs to — a delegated child's step opens against that child.
    run_of: dict[str, str] = Field(default_factory=dict)


class RunStages(BaseModel):
    stages: list[RunStage] = Field(default_factory=list)
    pruned: bool = False


class RunAsset(BaseModel):
    name: str
    #: ``emission`` · ``file · csv`` · ``branch`` · ``Todo for a person``.
    kind: str
    produced_by: str
    size_line: str = "—"
    where: str = ""
    step_run_id: str | None = None
    emission_id: str | None = None
    task_id: str | None = None


class RunAssets(BaseModel):
    items: list[RunAsset] = Field(default_factory=list)


class TouchedGraphRow(BaseModel):
    type: str
    read: int = 0
    written: int = 0
    refused: int = 0
    refused_line: str = ""


class TouchedWebRow(BaseModel):
    domain: str
    pages: int = 0
    refused: int = 0
    refused_line: str = ""


class TouchedLlmRow(BaseModel):
    #: The model version the calls ran on; ``None`` when none was recorded.
    model: str | None = None
    calls: int = 0
    tokens_in: int = 0
    tokens_out: int = 0


class TouchedSecretRow(BaseModel):
    name: str
    used_by: str = "—"
    where: str = ""


class RunTouched(BaseModel):
    graph: list[TouchedGraphRow] = Field(default_factory=list)
    web: list[TouchedWebRow] = Field(default_factory=list)
    llm: list[TouchedLlmRow] = Field(default_factory=list)
    secrets: list[TouchedSecretRow] = Field(default_factory=list)
    records_touched: int = 0


class RunRerunResponse(BaseModel):
    run_id: str
    rerun_of_run_id: str
    #: The provider's version name the new run will call; null for one that calls none.
    model_version: str | None = None
    stream_url: str


# ── Emissions (docs/for-developers/modules/ask/features/the-answer-surface.md) ──


class TemplateOffer(BaseModel):
    """One template the reader could switch to, and why it cannot when it cannot.

    An unavailable template is offered **disabled with its reason** rather than
    hidden (projections.md P10) — otherwise a reader wonders where the chart went.
    """

    template_id: str
    name: str
    surface: str
    version: int = 1
    available: bool = True
    reason: str | None = None


class EmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seq: int
    kind: str
    payload: dict
    # NULL means no template chose the rendering; the header says so rather than
    # naming a default so the row looks complete (AS9).
    template_id: str | None = None
    citation: dict = Field(default_factory=dict)
    message_id: str | None = None
    templates: list[TemplateOffer] = []


class SwitchTemplate(BaseModel):
    """Re-render an emission through another template — never a re-run (P5)."""

    template_id: str | None = None


# ── The trace (docs/for-developers/modules/ask/features/reasoning-trace.md) ──


class TraceStep(BaseModel):
    """One step, with everything it is honest to show about how it ran."""

    id: str
    seq: int
    attempt: int
    task_key: str
    label: str
    status: str
    detail: str = ""
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    #: From the run's start to this step's start — the log's offset.
    offset_ms: int | None = None
    #: This step's ``duration_ms`` over the run's, from 0 to 1.
    share_of_run: float | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    tokens: int | None = None
    #: This step's ``tokens`` over the run's, from 0 to 1.
    share_of_run_tokens: float | None = None
    #: What this step spent, in dollars. ``None`` when the model has no
    #: published rate — *unknown*, never `0` (SR40 · observability.md OB4).
    cost_usd: float | None = None
    input: dict | None = None
    output: dict | None = None
    error: dict | None = None
    #: The arguments this attempt actually ran with, after ``${…}`` binding —
    #: what the step board's **Input** band reads (SR33). Distinct from
    #: ``input``: that is the digest a step chose to record, this is the
    #: resolved request.
    args: dict | None = None
    #: What this step spends, from the catalogue entry its ``task_key`` names.
    #: Read from ``CATALOGUE`` rather than stored, so a bound never disagrees
    #: with the entry it belongs to.
    bound: str | None = None
    #: How many attempts this step was allowed — the plan node's retry policy,
    #: else the flow's, else the task's default. The bound a run page reads
    #: *attempts 2 of 3* against.
    max_attempts: int = 1
    #: Where it sits — the plan's own id for this node, and the lane it ran in
    #: when its parent fanned out.
    step_key: str | None = None
    lane: str | None = None
    #: ``result.json`` for this task run (SR17). ``None`` until the runtime
    #: writes one — a band with no record is absent, not zero (SR34).
    result: dict | None = None
    # Two lists, two certainties: offered is a fact about the prompt, applied is
    # the model's own report (RT3).
    skills_offered: list = Field(default_factory=list)
    skills_applied: list = Field(default_factory=list)
    #: The same pair for rules, already resolved to the statements the step was
    #: given — a rule is only readable as its wording, never as an id (RU12).
    rules_offered: list[OfferedRule] = Field(default_factory=list)
    rules_cited: list[OfferedRule] = Field(default_factory=list)
    #: The run this node delegated, if it delegated one. **Derived** — a child
    #: names its delegating node in `parent_run_id`, so the id is read from the
    #: tree rather than stored a second time where it could disagree.
    child_run_id: str | None = None


class TraceRead(BaseModel):
    """The whole run, after the fact — part of the answer, not an admin view (RT1)."""

    run_id: str
    flow_key: str
    status: str
    #: The ask this run carries — ``nl`` · ``ql`` · ``import``.
    ask_kind: str | None = None
    #: What it was about, in the words the opener wrote — the board's crumb.
    body: str | None = None
    outcome: str | None = None
    agent_id: str | None = None
    agent_version: int | None = None
    plan_origin: str | None = None
    plan_revision: int = 0
    #: What opened the run — ``user`` · ``schedule`` · ``task`` · ``delegation``.
    triggered_by: str = "user"
    #: The trace the run was started in — opens it in the collector's UI.
    trace_id: str | None = None
    #: The person it ran for, by username — the one on whose behalf it ran, else
    #: its author. ``None`` when no person is on the record (a schedule).
    opened_by: str | None = None
    #: The bounded repetitions the run spent — questions it asked and times it
    #: re-planned — read against ``effort``'s ``max_clarifications`` and
    #: ``max_replans`` (SR67).
    clarifications: int = 0
    replans: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    queue_ms: int | None = None
    work_ms: int | None = None
    ask_ms: int | None = None
    wait_ms: int | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    tokens: int = 0
    #: The run's spend — the sum of the steps that had a price. ``None`` when
    #: none of them did, so the Cost tile is absent rather than `$0.00` (SR40).
    cost_usd: float | None = None
    #: The ceilings this run was dispatched under — the agent's effective
    #: budget (SR41 · [EB1](docs/for-developers/modules/agents/features/envelope-and-budget.md)).
    #: ``None`` on a run with no agent, which has no ceiling to draw against.
    #: Token budgets; ``max_tokens`` is ``max_tokens_run`` under its old name
    #: and the money keys are answered as stored, both for one release.
    budget: dict | None = None
    #: The run's own ``result.json`` — the roll-up of its tasks' (SR39).
    result: dict | None = None
    #: The world this run was asked under, and its name **as frozen**
    #: ([SR36](docs/for-developers/modules/operate/features/see-what-ran.md) ·
    #: [GR3](docs/for-developers/modules/govern/features/guardrails.md)). Both
    #: ``None`` reads *Everything*, which is a real world and the default one —
    #: never a blank, which would read as *not recorded*. The name comes from
    #: ``lens_snapshot`` rather than from the row, so renaming a world does not
    #: change what a run that already happened says it ran under.
    lens_id: str | None = None
    lens_name: str | None = None
    #: The record ``lens_name`` was read from — ``{"id", "kind"}`` with kind
    #: ``world`` or ``guardrail`` — so the name can open it (SR67). ``None``
    #: when the snapshot names nobody.
    lens_ref: dict | None = None
    #: Whether the run froze a lens at open. ``False`` means what it engaged was
    #: never recorded — not that it engaged nothing (SR68 · GV36).
    governed: bool = False
    steps: list[TraceStep] = []
    emissions: list[EmissionRead] = []
    error: dict | None = None


# ── Prompt answers (docs/for-developers/modules/ask/features/projections.md F1) ──


class AnswerPrompt(BaseModel):
    """A person's answer to a closed question — a value and an option id (P3)."""

    step_seq: int
    template_id: str | None = None
    option_id: str | None = None
    value: dict = Field(default_factory=dict)


class TaskPromptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    step_seq: int
    template_id: str | None = None
    answered_by_kind: str
    answered_by_id: str | None = None
    value: dict
    answered_at: datetime


class CatalogueArgRead(BaseModel):
    name: str
    type: str
    required: bool
    default: object | None = None


class CatalogueOutputRead(BaseModel):
    name: str
    type: str
    #: How lanes roll up on a fan-out — ``sum`` · ``concat`` · null when the
    #: output is per lane only (orchestration §5.1b · CA C3).
    rollup: str | None = None


class CatalogueEntryRead(BaseModel):
    """One catalogue entry, rendered from its declaration (the-catalogue.md CA2)."""

    step_key: str
    bound: str
    summary: str
    args: list[CatalogueArgRead]
    outputs: list[CatalogueOutputRead]
    requires: list[str]
    #: Reusable plans in this Graph that name the entry — distinct keys, not versions.
    used_by: int
    #: The plugin that declares the entry, e.g. ``invana.core.graph_read``.
    plugin: str = ""


#: What the Catalogue list takes. The default sort groups by bound, in the
#: bound's declared order, then by key; ``q`` matches the key and the summary.
CATALOGUE_LIST = ListSpec(
    filters={
        "bound": Filter(
            values=tuple(b.value for b in Bound), labels={b.value: b.value.replace("_", " ") for b in Bound}
        ),
        "plugin": Filter(),
    },
    sorts=("bound", "key"),
    search_title="key",
)


class FunctionPlanRef(BaseModel):
    """A reusable plan in this Graph that names the function — its newest version."""

    id: str
    key: str
    name: str
    #: ``packaged`` · ``generated`` · ``promoted``.
    origin: str


class FunctionSkillRef(BaseModel):
    """A skill whose current version's plan names the function."""

    skill_id: str
    name: str
    version: int


class FunctionCallsRead(BaseModel):
    """A function's calls over the window against the window before, read once by the engine."""

    days: int
    #: The first day of the window, 00:00 UTC.
    since: datetime
    calls: int
    calls_prior: int
    calls_change: Change | None = None
    #: Queued to finished over settled calls; null when none settled.
    p95_ms: float | None = None
    p95_prior_ms: float | None = None
    p95_change: Change | None = None
    failed: int
    #: Failed over settled; null when none settled.
    failed_rate: float | None = None
    failed_rate_prior: float | None = None
    failed_rate_change: Change | None = None


class FunctionRead(CatalogueEntryRead):
    """A function's page: its catalogue entry, its manifest, who names it and its calls."""

    #: ``name@version`` of the plugin that declares it.
    plugin: str = ""
    version: str
    side_effect: str
    resources: list[str]
    #: Declared on the manifest; null means the engine's default.
    timeout_s: int | None = None
    retries: int | None = None
    plans: list[FunctionPlanRef]
    needed_by: list[FunctionSkillRef]
    calls: FunctionCallsRead


class FunctionCallRead(BaseModel):
    """One run step that called the function."""

    #: The step's ``task_runs.id``.
    id: str
    #: The run the step ran in.
    run_id: str
    title: str
    status: str
    duration_ms: int | None = None
    tokens: int | None = None
    queued_at: datetime


#: What a function's Calls list takes — newest first.
FUNCTION_CALLS_LIST = ListSpec(
    filters={
        "status": Filter(
            values=tuple(s.value for s in RunStatus),
            labels={s.value: s.value.replace("_", " ") for s in RunStatus},
        ),
    },
    sorts=("-queued_at",),
)


# ── Evals (docs/for-developers/modules/skills/features/evals.md) ──


class EvalCheck(BaseModel):
    """One rule check — ``kind`` and, where the kind takes one, its ``value``."""

    kind: Literal[
        "cites_records",
        "names_world",
        "cannot_answer",
        "guardrail_holds",
        "expected_records",
        "max_tokens",
        "max_latency_ms",
    ]
    value: str | int | list[str] | None = None


class EvalSetWrite(BaseModel):
    judge_model_pin: str | None = Field(default=None, max_length=255)
    rubric: str | None = None


class EvalCaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    checks: list[EvalCheck]
    label: Literal["passing", "failing"]
    status: Literal["proposed", "active", "retired"]
    source_run_id: str | None = None
    created_by_id: str | None = None
    created_at: datetime | None = None


class EvalSetRead(BaseModel):
    #: Null until the set is first written.
    id: str | None = None
    subject_kind: Literal["skill", "agent"]
    subject_id: str
    judge_model_pin: str | None = None
    rubric: str | None = None
    cases: list[EvalCaseRead] = Field(default_factory=list)


class EvalCaseWrite(BaseModel):
    question: str = Field(min_length=1)
    checks: list[EvalCheck] = Field(default_factory=list)
    label: Literal["passing", "failing"] = "passing"
    #: True for the assistant's starter set — it waits for a person to accept it.
    proposed: bool = False


class EvalCaseUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    checks: list[EvalCheck] | None = None
    label: Literal["passing", "failing"] | None = None
    status: Literal["proposed", "active", "retired"] | None = None


class EvalRunOpen(BaseModel):
    side: Literal["live", "draft", "both"] = "both"
    #: A rollback's candidate: the version it would restore.
    version: int | None = Field(default=None, ge=1)
    #: A pin move's candidate: the address the pin would move to.
    model_pin: str | None = Field(default=None, max_length=255)
    trigger: Literal["manual", "publish", "rollback", "pin"] = "manual"


class EvalRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    outcome: str | None = None
    detail: str = ""
    triggered_by: str
    params: dict
    result: dict | None = None
    queued_at: datetime | None = None
    finished_at: datetime | None = None


class EvalResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    eval_case_id: str
    case_run_id: str | None = None
    side: Literal["live", "draft"]
    hard: dict[str, str]
    #: The labelled judge's 0-5 — never part of the hard count.
    judged: float | None = None
    tokens: int
    latency_ms: int
    answer_digest: str


class EvalRunDetail(EvalRunRead):
    results: list[EvalResultRead] = Field(default_factory=list)


class EvalRunOpened(BaseModel):
    run_id: str
    status: str
    detail: str = ""


class EvalPromote(BaseModel):
    run_id: str
    subject_kind: Literal["skill", "agent"]
    subject_id: str
    label: Literal["passing", "failing"]
    #: Omitted on a passing case: the checks are read from the run.
    checks: list[EvalCheck] | None = None


class EvalBudgetRead(BaseModel):
    #: Null is no ceiling.
    monthly_tokens: int | None = None
    spent: int = 0


class EvalBudgetWrite(BaseModel):
    monthly_tokens: int | None = Field(default=None, ge=0)


class EvalDrift(BaseModel):
    trigger: Literal["nightly", "model_publish", "world_change", "pin_moved"] = "nightly"


class EvalDriftResponse(BaseModel):
    run_ids: list[str]


# ── Plugins (docs/for-developers/modules/platform/features/tool-plugins.md) ──


class PluginBase(BaseModel):
    """What a plugin is and whether it may run — shared by the summary and the detail."""

    name: str
    #: ``core`` · ``simulator`` · ``tool`` · ``mcp``.
    kind: str
    version: str
    title: str = ""
    #: The pip extra that installs it; empty for a core plugin.
    extra: str = ""
    #: False for a tool plugin whose extra is missing, or an MCP plugin this process has not loaded.
    installed: bool
    enabled: bool
    #: Whether an install Admin may enable or disable it — tool and MCP plugins.
    switchable: bool
    #: An MCP plugin stored at a revision this process has not loaded — restart to load it.
    restart_required: bool = False


class PluginSummary(PluginBase):
    """One plugin as the registry lists it, with how much it declares."""

    task_types: int
    skills: int
    flows: int


#: What the Plugins list takes. ``q`` matches the name and the title.
PLUGIN_LIST = ListSpec(
    filters={
        "kind": Filter(values=("core", "simulator", "tool", "mcp")),
        "enabled": Filter(values=("true", "false"), labels={"true": "enabled", "false": "disabled"}),
    },
    sorts=("name",),
    search_title="name",
)


class TaskArgRead(BaseModel):
    type: str
    required: bool
    default: object | None = None


class TaskManifestRead(BaseModel):
    """One task type's manifest, as declared on disk."""

    key: str
    version: str
    summary: str
    bound: str
    side_effect: str
    args: dict[str, TaskArgRead]
    outputs: dict[str, str]
    requires: list[str]
    resources: list[str]
    timeout_s: int | None = None
    retries: int | None = None


class PluginFlowRead(BaseModel):
    key: str
    version: int
    kind: str
    description: str


class PluginSkillRead(BaseModel):
    slug: str
    name: str
    version: int
    when_to_use: str
    description: str


class PluginDetail(PluginBase):
    """A plugin and everything it declares; the lists are empty when it is not installed."""

    #: Names the plugin's task types may resolve in a worker — never their values.
    secrets: list[str]
    task_types: list[TaskManifestRead]
    flows: list[PluginFlowRead]
    skills: list[PluginSkillRead]


class McpServerAdd(BaseModel):
    #: ``[a-z][a-z0-9_]{0,31}`` — the plugin is ``invana.mcp.<name>``.
    name: str
    #: The server's Streamable HTTP endpoint.
    url: str


class McpToolRead(BaseModel):
    key: str
    version: str
    side_effect: str
    summary: str


class McpServerRead(BaseModel):
    """An MCP server as stored, and whether this process serves that revision."""

    name: str
    plugin: str
    url: str
    revision: int
    #: The revision this process loaded at start-up; null when it loaded none.
    loaded_revision: int | None
    restart_required: bool
    tools: list[McpToolRead]
    #: Tool names that could not be keyed.
    skipped: list[str]
    #: ``{name, version, protocol}`` from the server's ``initialize``.
    server: dict
    frozen_at: datetime
