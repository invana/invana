"""Pydantic read/request models for runs
(docs/for-developers/modules/ask/features/streaming-and-the-workflow.md)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    detail: str = ""
    input: dict | None = None
    output: dict | None = None
    error: dict | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


class TaskRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    workflow_key: str
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
    stream_seq: int
    steps: list[RunNodeRead] = []


class TaskRunSummary(BaseModel):
    """One run, as a **list** row — the plan and its verdict, without the steps.

    Three surfaces read this and they want the same few facts: an agent's
    *Recent plans* (what has this agent actually run?), the Workflows library's
    *candidates* (which generated plans served and were never promoted?) and the
    **journal** (what ran in this Graph, filtered by kind). Returning the step
    rows here would make any of them an order of magnitude larger for nothing —
    the trace is a per-run fetch.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_key: str
    status: str
    #: What kind of work this run is — ``ask`` · ``import`` · ``bulk``. Null on
    #: a child run, which is what makes it a root-only fact.
    kind: str | None = None
    #: What it was about, in the words the opener wrote — *Import news-tv*. A
    #: journal row names what changed the graph without a second request.
    body: str | None = None
    #: ``template:<key>@<v>`` · ``generated`` · ``envelope`` · ``promoted:<key>``.
    plan_origin: str | None = None
    plan_revision: int = 0
    replans: int = 0
    agent_id: str | None = None
    task_id: str | None = None
    #: The task's title, so a row reads without a second round-trip.
    task_title: str | None = None
    queued_at: datetime | None = None
    finished_at: datetime | None = None
    step_count: int = 0
    #: The furthest step that is not merely queued — the row's "Execute" in
    #: ``Execute 5/7``. ``None`` before anything has started.
    step_label: str | None = None
    steps_done: int = 0
    steps_total: int = 0
    #: *Verify*'s verdict — ``yes`` · ``partial`` · ``no``. ``None`` means the
    #: run never reached Verify, which is **not** the same as "did not serve".
    served: str | None = None
    #: True once some library entry records this run as its origin.
    promoted: bool = False


class TaskRunListResponse(BaseModel):
    items: list[TaskRunSummary]
    total: int


class ResumeTaskRun(BaseModel):
    """The user's answer to a clarification (docs/for-developers/modules/ask/spec.md pause / resume)."""

    answer: str = Field(..., min_length=1)


class CancelResponse(BaseModel):
    id: str
    status: str


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
    tokens_in: int | None = None
    tokens_out: int | None = None
    #: What this step spent, in dollars. ``None`` when the model has no
    #: published rate — *unknown*, never `0` (SR40 · observability.md OB4).
    cost_usd: float | None = None
    input: dict | None = None
    output: dict | None = None
    error: dict | None = None
    #: The arguments this attempt actually ran with, after ``${…}`` binding —
    #: what the step dashboard's **Input** band reads (SR33). Distinct from
    #: ``input``: that is the digest a step chose to record, this is the
    #: resolved request.
    args: dict | None = None
    #: What this step spends, from the catalogue entry its ``task_key`` names.
    #: Read from ``CATALOGUE`` rather than stored, so a bound never disagrees
    #: with the entry it belongs to.
    bound: str | None = None
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
    #: The run this node delegated, if it delegated one. **Derived** — a child
    #: names its delegating node in `parent_run_id`, so the id is read from the
    #: tree rather than stored a second time where it could disagree.
    child_run_id: str | None = None


class TraceRead(BaseModel):
    """The whole run, after the fact — part of the answer, not an admin view (RT1)."""

    run_id: str
    workflow_key: str
    status: str
    #: The ask this run carries — ``nl`` · ``ql`` · ``import``.
    ask_kind: str | None = None
    #: What it was about, in the words the opener wrote — the dashboard's crumb.
    body: str | None = None
    outcome: str | None = None
    agent_id: str | None = None
    agent_version: int | None = None
    plan_origin: str | None = None
    plan_revision: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    #: The run's spend — the sum of the steps that had a price. ``None`` when
    #: none of them did, so the Cost tile is absent rather than `$0.00` (SR40).
    cost_usd: float | None = None
    #: The ceiling this run was dispatched under — the agent's effective
    #: ``max_tokens`` and ``max_cost_usd`` (SR41). ``None`` on a run with no
    #: agent, which has no ceiling to draw against.
    budget: dict | None = None
    #: The run's own ``result.json`` — the roll-up of its tasks' (SR39).
    result: dict | None = None
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
