"""Pydantic request/response models for the Skills API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OfferedRule(BaseModel):
    """One rule as it reached a step — the wording, and the rule to open.

    ``statement`` is the **version's** wording, resolved from the
    ``rule_version_id`` the step recorded, so rewording or deactivating the rule
    never rewrites what a past step was given
    ([RU4 · RU12](docs/for-developers/modules/skills/features/rules.md)).
    ``rule_id`` rides beside it because a board is bound to the rule, not to one
    of its versions — a step row shows the statement and opens the rule
    ([RU11](docs/for-developers/modules/skills/features/rules.md)).

    It lives here rather than beside the step schemas that carry it: a step is a
    ``runtime`` row and a rule is this app's record, and **an app may not import
    the runtime** (migration-plan §18.1.1 S1). The runtime reads down to it.
    """

    rule_id: str
    statement: str


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    content: str = Field(default="")
    when_to_use: str = Field(default="")


class SkillUpdate(BaseModel):
    """A rename, a republish, or both.

    Changing any of the three text fields publishes the next version; changing
    only the name does not, because the name is the skill's identity and not
    something a step was ever offered
    ([SK2](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    content: str | None = None
    when_to_use: str | None = None


class SkillVersionPublish(BaseModel):
    """The next version's text. Anything omitted carries over from the head."""

    description: str | None = None
    content: str | None = None
    when_to_use: str | None = None


class SkillVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    skill_id: str
    version: int
    description: str
    content: str
    when_to_use: str
    published_by_id: str | None
    #: **Null is the draft** — the one mutable version row
    #: ([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    published_at: datetime | None
    #: One version, exactly one plan (SK13). Never null.
    plan_id: str
    is_draft: bool = False


class SkillVersionListResponse(BaseModel):
    items: list[SkillVersionRead]
    total: int


class SkillVersionFieldDiff(BaseModel):
    """One field's before and after, as unified-diff lines.

    Lines rather than two blobs: the surface draws a diff, and computing one in
    three places — the API, the CLI and Studio — is three chances to disagree
    about what changed.
    """

    field: str
    changed: bool
    lines: list[str]


class SkillVersionDiff(BaseModel):
    """A version against the one before it — the prose half.

    The plan half arrives with M8, when a version draws one. There is no
    `stale` flag to reconcile: a version is immutable, so its plan can never
    drift from the prose it was drawn from
    ([SK5](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """

    skill_id: str
    version: int
    #: Null when this is v1 — the first version is compared against nothing,
    #: which is not the same as being compared against empty text.
    against_version: int | None
    fields: list[SkillVersionFieldDiff]


class SkillPlanSummary(BaseModel):
    """What the drawer row and the Flow tab's badge need without a second call."""

    plan_id: str
    #: ``generated`` when the planner drew it, ``authored`` after a hand-edit
    #: ([SK7](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    origin: str
    step_count: int
    #: The bands this playbook will touch, in the strip's order — what the
    #: bind-time check reads in advance ([SK16](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    layers: list[str] = Field(default_factory=list)


class SkillPlanNode(BaseModel):
    """One node of a skill's plan, with the band it sits in and the sentence it
    came from."""

    id: str
    task: str
    label: str
    args: dict = Field(default_factory=dict)
    depth: int = 0
    form: str = "callable"
    layer: str = "agent"
    source_span: str | None = None
    #: `nl-single@1` when this row was inlined from a library plan, null when
    #: somebody wrote it ([SK33](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    source_plan_key: str | None = None


class SkillPlanEdge(BaseModel):
    source: str
    target: str
    kind: str
    label: str = ""


class PlanUseRead(BaseModel):
    """One composition: which library plan was inlined, and what it was tuned to.

    ``latest_version`` is the newest version of that key the Graph holds, which
    is the one fact the caller cannot work out from its own rows. It is said,
    never acted on: the copy is the point, and re-inlining is something somebody
    asks for ([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """

    key: str
    version: int
    args: dict = Field(default_factory=dict)
    latest_version: int


class SkillPlanRead(BaseModel):
    """The plan a version owns — the Flow tab, in one response."""

    plan_id: str
    origin: str
    nodes: list[SkillPlanNode] = Field(default_factory=list)
    edges: list[SkillPlanEdge] = Field(default_factory=list)
    layers: list[str] = Field(default_factory=list)
    #: The library plans this plan inlined and what it tuned on each, so *what
    #: will this do for me* is answerable without opening them
    #: ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
    uses: list[PlanUseRead] = Field(default_factory=list)


class SkillClarificationRead(BaseModel):
    """A question the planner asked about one sentence.

    ``options`` are the readings, each naming the step it would write. Never a
    free-text box (*Not building*).
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    skill_version_id: str
    span: str
    question: str
    options: list[dict]
    answer: str | None
    answered_at: datetime | None


class SkillClarificationAnswer(BaseModel):
    """One of the offered readings, by its ``step_key`` — or ``none`` for *none
    of these*, which writes a `form: human` node rather than a guess."""

    answer: str = Field(..., min_length=1, max_length=64)


class SkillDraftTaskWrite(BaseModel):
    """One row of a hand-edited plan.

    Row-level on purpose ([§ 9](docs/for-developers/building-engine/skills-draw-as-plans.md)):
    this is not a flow editor. A person says **which step**, what it is called
    and what it takes; the edges are materialised from what actually constrains
    each node — its `${steps.X.y}` bindings and the catalogue's `requires` — so
    an order nobody reviewed is never written down
    (`apps/task_plans/dag.py`).
    """

    #: The sibling key. Minted from the step when absent; made unique when a
    #: playbook names one step twice.
    key: str | None = Field(default=None, max_length=200)
    #: ``callable`` names a catalogue entry; ``human`` names none, because a
    #: person is the universal fallback
    #: ([SK15](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    #: ``uses`` names a library plan instead of a step: the row is replaced by
    #: that plan's rows before anything is validated
    #: ([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    form: str = Field(default="callable", pattern="^(callable|human|uses)$")
    step_key: str | None = None
    #: ``uses`` rows only — ``nl-single@1``, or ``nl-single`` for its newest.
    uses: str | None = Field(default=None, max_length=80)
    #: ``uses`` rows only — the arguments this composition tunes, over the
    #: plan's declared defaults ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
    uses_args: dict = Field(default_factory=dict)
    title: str = Field(default="", max_length=250)
    args: dict = Field(default_factory=dict)
    #: The sentence this step answers to, kept so the Playbook tab still maps
    #: prose to steps after a hand-edit ([C11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    source_span: str | None = None


class SkillDraftTasksWrite(BaseModel):
    """The draft's plan, replaced wholesale.

    The rows go and come back rather than being patched, for the same reason a
    redraw does ([SK12](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
    an edit is a revision of the whole shape, and the diff a person reads is
    against what was there.
    """

    tasks: list[SkillDraftTaskWrite] = Field(default_factory=list)


class SkillStepChoice(BaseModel):
    """One step a hand-edit may name.

    The catalogue is what bounds authoring
    ([SK28](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
    so the surface that offers the choice is sent the set rather than carrying a
    copy of it — a second list of step keys in TypeScript is a second thing to
    keep in step with a closed set it cannot see.
    """

    step_key: str
    label: str
    bound: str
    #: The band this step sits in, so the picker reads in the same six bands the
    #: Flow tab draws ([SK16](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    layer: str
    #: Steps that must be ordered before it. The editor says so before the
    #: write is refused for it.
    requires: list[str] = Field(default_factory=list)


class InlinablePlan(BaseModel):
    """A library plan a skill may inline, and what it offers a caller.

    The picker's one read. `args_schema` comes with the row because tuning is
    the same act as picking — a person who inlines `nl-single@1` decides
    `read_only` in the same breath
    ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
    """

    key: str
    version: int
    #: `nl-single@1` — what a `uses` row names, and what each copied row carries.
    ref: str
    name: str
    description: str = ""
    kind: str = ""
    step_count: int = 0
    #: The bands this plan will touch, in the strip's order — the same reading
    #: the Flow tab and the bind check give
    #: ([SK16](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    layers: list[str] = Field(default_factory=list)
    #: `{name: {type, default, label}}` — what a caller may tune.
    args_schema: dict = Field(default_factory=dict)


class InlinablePlanListResponse(BaseModel):
    items: list[InlinablePlan] = Field(default_factory=list)


class SkillAgentStanding(BaseModel):
    """Where this skill stands with one agent — the Bindings tab's three sections.

    ``refusal`` is the refusal the bind **would** raise, run as a dry run rather
    than predicted by the surface
    ([BN10](docs/for-developers/modules/skills/features/bindings.md)): a second
    reading of the same rules in TypeScript is a copy to keep in step, and the
    copy is what goes stale. It is null for an agent already bound — a bind that
    happened is not re-litigated by a later guardrail; unbinding is.
    """

    agent_id: str
    agent_name: str
    #: The world the agent carries by default — the name of the lens in
    #: ``agents.lens_id``, absent when it carries none or the lens is unnamed.
    #: **Context on the row, never a ground for a refusal**: the check reads
    #: guardrails and never worlds
    #: ([BN12](docs/for-developers/modules/skills/features/bindings.md)).
    world: str | None = None
    bound: bool
    refusal: dict | None = None


class SkillAgentsResponse(BaseModel):
    items: list[SkillAgentStanding] = Field(default_factory=list)


class SkillDrawRefusal(BaseModel):
    """Why the last draw wrote nothing.

    It settles rather than fails ([SK31](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
    so the author reads it where the flow would have been rather than in a run
    that died. ``reasons`` are the validator's, verbatim — a plan that does not
    hold together is refused **on what was checked**.
    """

    run_id: str
    reasons: list[str] = Field(default_factory=list)


class SkillDraftRead(BaseModel):
    """What the authoring surface reads: the text being written, the plan being
    drawn, and the question waiting on an answer."""

    version: SkillVersionRead
    plan: SkillPlanRead
    clarifications: list[SkillClarificationRead] = Field(default_factory=list)
    open_clarification: SkillClarificationRead | None = None
    #: The run that is drawing it, while one is in flight.
    drawing_run_id: str | None = None
    #: Set when the last draw settled having written nothing, because what the
    #: prose named does not hold together as a plan (SK31). Cleared by the next
    #: draw that writes rows.
    refusal: SkillDrawRefusal | None = None
    #: What a hand-edit may name (SK28). Sent with the draft, because the draft
    #: is the only surface that authors rows.
    vocabulary: list[SkillStepChoice] = Field(default_factory=list)


class SkillDrawStarted(BaseModel):
    """The run that is drawing the draft, and where to watch it."""

    run_id: str
    stream_url: str


class SkillRead(BaseModel):
    """The skill and the text of its current version, flattened.

    ``description`` · ``content`` · ``when_to_use`` read through the head, so a
    caller renders a skill without knowing versions exist; ``version`` and
    ``current_version_id`` are what it needs to say *which* text it got.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    version: int
    current_version_id: str | None
    description: str
    content: str
    when_to_use: str
    created_at: datetime
    updated_at: datetime
    #: ``builtin`` ships with Invana and is re-seeded by name; it is editable
    #: and cannot be deleted ([SK25](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    origin: str = "authored"
    #: Never published — the drawer draws it as a draft, and nothing is offered
    #: it ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    is_draft: bool = False
    #: An unpublished row waiting to be published, whether or not there is a
    #: published head above it.
    draft_version_id: str | None = None
    plan: SkillPlanSummary | None = None


class SkillListResponse(BaseModel):
    items: list[SkillRead]
    total: int


# ── Rules ─────────────────────────────────────────────────────────────────────


class RuleCreate(BaseModel):
    statement: str = Field(..., min_length=1)
    #: Where it lands in the assembled context. Omitted, it goes last.
    order: int | None = None


class RuleUpdate(BaseModel):
    """A rewording, a reorder, or both.

    Changing the statement publishes the next version; ``order`` and ``active``
    are properties of the rule and are edited in place
    ([RU4](docs/for-developers/modules/skills/features/rules.md)).
    """

    statement: str | None = Field(default=None, min_length=1)
    order: int | None = None


class RuleVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_id: str
    version: int
    statement: str
    published_by_id: str | None
    published_at: datetime


class RuleVersionListResponse(BaseModel):
    items: list[RuleVersionRead]
    total: int


class RuleRead(BaseModel):
    """The rule and the statement of its current version, flattened.

    ``scope`` and ``kind`` are derived from ``project_id``
    ([RU6](docs/for-developers/modules/skills/features/rules.md)) — both words
    are on the surface, neither is a column.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    project_id: str | None
    scope: str
    kind: str
    active: bool
    order: int
    version: int
    current_version_id: str | None
    statement: str
    #: Steps that cited any version of this rule — the number under the
    #: statement on the drawer row. `0` on a rule nothing has used yet.
    citations: int = 0
    created_at: datetime
    updated_at: datetime


class RuleCitation(BaseModel):
    """One step that cited this rule, and which wording it read."""

    run_id: str | None
    step_id: str
    label: str
    task_key: str
    rule_version_id: str
    version: int
    statement: str
    finished_at: datetime | None


class RuleVersionCitations(BaseModel):
    """One published wording, and how many steps said they followed it.

    Counted by the engine rather than tallied from ``items``: that list is a
    bounded, newest-first window, and a total taken from a page is a different
    number wearing the same label
    ([RU10](docs/for-developers/modules/skills/features/rules.md)).
    """

    rule_version_id: str
    version: int
    statement: str
    published_at: datetime
    cited: int


class RuleCitationsResponse(BaseModel):
    """Where a rule was offered and where it was cited.

    ``offered`` is a fact written by assembly; ``total`` is the model's own
    claim, and the difference between them is *never cited* — which cannot be
    told from *never offered* unless both are sent
    ([RU7](docs/for-developers/modules/skills/features/rules.md) ·
    [RU9](docs/for-developers/modules/skills/features/rules.md)). Both are over
    **every** version; each row says which wording it read, so deactivating or
    rewording never rewrites it.
    """

    rule_id: str
    #: Steps that had any version of this rule in context.
    offered: int = 0
    total: int
    #: Every published wording with its own count, newest first.
    versions: list[RuleVersionCitations] = Field(default_factory=list)
    items: list[RuleCitation]


class RuleListResponse(BaseModel):
    items: list[RuleRead]
    total: int
    #: On a Project's list: the Graph invariants it inherits, read-only (C3).
    inherited: list[RuleRead] = Field(default_factory=list)
