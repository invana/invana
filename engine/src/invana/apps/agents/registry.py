"""Seeded agents, the workflow template library, and the intent → template map.

Three kinds of data live here, and all three are **data** rather than code —
docs/for-developers/modules/agents/spec.md **V6**: an INSERT changes which template an intent picks, the
same posture taken in docs/for-developers/modules/ask/spec.md for "adding an agent is an INSERT".

``TEMPLATES``
    The library. Each entry is `key@version` with an ordered step list in the
    envelope grammar (:mod:`invana.apps.agents.envelope`). These are what a *Plan*
    step selects when a template fits, which is the common case and costs no
    LLM call.

``INTENT_TEMPLATES``
    The map *Plan* reads: `(ask kind, intent kind) → template key`. Tuning this
    is the cheapest half of the learning loop in docs/for-developers/modules/workflows/features/promote-a-plan.md.

``SEEDED_AGENTS``
    The agents every graph gets: *Explorer* (plans), *Query* (static QL tail),
    *Modeller* (plans a model proposal). A session that names no agent behaves
    exactly as it does today, because these carry the workflows S9b shipped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ── Step labels ──────────────────────────────────────────────────────────────
#
# The words on the card. `translate_thought` was labelled *Understand* before
# docs/for-developers/modules/agents/spec.md; calling translation "Understand" is what made "understand then
# plan" sound like a duplicate. It is *Translate* now, and *Understand* is its
# own step (docs/for-developers/modules/agents/spec.md "the current label lies").

LABELS: dict[str, str] = {
    "understand_intent": "Understand",
    "plan_workflow": "Plan",
    "translate_thought": "Translate",
    "validate_query": "Validate",
    "execute_graph_query": "Execute",
    "shape_for_canvas": "Project",
    "verify_result": "Verify",
    "understand_ask": "Understand",
    "propose_model": "Propose",
    "validate_proposal": "Validate",
    "spawn_agent": "Spawn",
    "delegate": "Delegate",
    "await_delegations": "Await",
    "create_task": "Sub-task",
}


def step(task: str, *, id: str | None = None, label: str | None = None, **args: Any) -> dict:
    """One plan step, in the shape :mod:`invana.apps.agents.envelope` parses."""
    return {"id": id or task, "task": task, "label": label or LABELS.get(task, task), "args": args}


@dataclass(frozen=True, slots=True)
class Template:
    """A reusable plan tail — the library entry a Plan step selects."""

    key: str
    version: int
    description: str
    # Which `intent.kind` values this template serves. Read by the Plan step
    # through INTENT_TEMPLATES; kept here too so the library detail can show it.
    intents: tuple[str, ...]
    steps: tuple[dict, ...]
    #: The plan's **subject** — `ask · import · bulk · stitch · model · enrich · canvas`.
    #: A plain string rather than `PlanKind`, because `apps/task_plans` already
    #: imports this module and the band contract keeps `apps` acyclic.
    kind: str = "ask"
    source: str = "seeded"
    tags: tuple[str, ...] = field(default_factory=tuple)
    #: What this plan **offers** a caller that inlines it — `{name: {type,
    #: default, label}}` ([LB20](docs/for-developers/modules/workflows/features/the-library.md)).
    #: Its own steps bind these as `${args.<name>}`; a caller tunes them, and a
    #: name it leaves alone takes the default.
    args_schema: dict = field(default_factory=dict)

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"


# ── The library ──────────────────────────────────────────────────────────────

# The query bindings are **declared**, not left to the sequence.
#
# `validate_query` and `execute_graph_query` both read whatever `translate`
# produced. `nl-compare` says so with `${steps.translate_a.query}`; this tail
# used to leave it implicit and rely on `RunVars`, so materialising the plan
# recorded *validate after translate* as a `sequence` guess rather than the
# data-flow it actually is (task-model-migration M2). The value is identical —
# `args.query` resolves to what translate left — and now the edge states why.
# `read_only` is **declared**, not hard-coded, because it is the one thing about
# this tail a caller legitimately differs on: a skill that answers questions
# wants it true, and one that writes what it found does not. Declaring it is
# what lets a skill inline this plan instead of redrawing five steps to change a
# single boolean ([LB19 · LB20](docs/for-developers/modules/workflows/features/the-library.md)).
# An agent whose envelope **pins** it still wins — a pin is a ceiling, and a
# tuned argument is a request.
_QUERY_TAIL = (
    step("translate_thought"),
    step("validate_query", query="${steps.translate_thought.query}"),
    step("execute_graph_query", query="${steps.translate_thought.query}", read_only="${args.read_only}"),
    step("shape_for_canvas"),
    step("verify_result"),
)

# **@2, not an edit to @1.** A library version is immutable: a changed shape
# mints `key@n+1` rather than rewriting the rows an install already holds
# ([LB1](docs/for-developers/modules/workflows/features/the-library.md)). Editing
# @1 here would have given a fresh install rows that bind `${args.read_only}`
# and an existing one rows that hold `true`, under one name.
NL_SINGLE = Template(
    key="nl-single",
    version=2,
    description="One question, one query: translate it, check it is read-only, run it, paint it, verify it served.",
    intents=("single_query", "exploration"),
    steps=_QUERY_TAIL,
    args_schema={
        "read_only": {
            "type": "bool",
            "default": True,
            "label": "Refuse anything that writes",
        }
    },
)

QL_DIRECT = Template(
    key="ql-direct",
    version=1,
    description="A typed query, and every re-run: no translation.",
    intents=("typed_query",),
    steps=(
        step("validate_query"),
        step("execute_graph_query", read_only=True),
        step("shape_for_canvas"),
        step("verify_result"),
    ),
)

NL_COMPARE = Template(
    key="nl-compare",
    version=1,
    description="Two readings of the graph, compared, with the difference charted.",
    intents=("compound", "aggregate_and_chart"),
    steps=(
        step("translate_thought", id="translate_a", label="Translate A"),
        step("validate_query", id="validate_a", label="Validate A", query="${steps.translate_a.query}"),
        step(
            "execute_graph_query",
            id="execute_a",
            label="Execute A",
            query="${steps.translate_a.query}",
            read_only=True,
        ),
        step("translate_thought", id="translate_b", label="Translate B"),
        step("validate_query", id="validate_b", label="Validate B", query="${steps.translate_b.query}"),
        step(
            "execute_graph_query",
            id="execute_b",
            label="Execute B",
            query="${steps.translate_b.query}",
            read_only=True,
        ),
        step("shape_for_canvas"),
        step("verify_result"),
    ),
)

MODELLER_PROPOSE = Template(
    key="modeller-propose",
    version=1,
    description="Read a described change and stage it on the model draft.",
    intents=("model_change",),
    steps=(
        step("understand_ask"),
        step("propose_model"),
        step("validate_proposal"),
    ),
)

# ── The builtin loads ────────────────────────────────────────────────────────
#
# The four plans ingestion is assembled from (terminology.md · the-library
# LB14). Their steps are catalogue **primitives** — `validate_records`,
# `write_graph`, `stitch`, `snapshot_model` — and the plan is what orders them,
# which is the whole of what `import_dataset` used to do in code.
#
# `model-import@1`, not `dataset-import@1`: records are imported **into a
# model**, and the model is what holds them (BD16).

MODEL_IMPORT = Template(
    key="model-import",
    version=1,
    kind="import",
    description="Load records into a model: check them, write them, resolve their edges, record what landed.",
    intents=(),
    steps=(
        step("validate_records", label="Validate"),
        step("write_graph", label="Write"),
        step("stitch", label="Stitch"),
        step("snapshot_model", label="Snapshot"),
    ),
)

# **`bundle-import@1` is not seeded yet, and the reason is that it cannot be
# stated honestly with what exists.**
#
# `bundle-import` needs `map_over` — a lane per model, and **one** stitch after
# the fan-out rather than one inside each load (load-a-bundle C5). Written flat
# it would be a single-model plan with a manifest check bolted on the front,
# and its stitch would resolve over a partial graph. `map_over` is designed and
# not built (orchestration.md § 12).
#
# `bulk-load@1` is seeded now that `bulk_write` exists. It stayed out while it
# did not: the fast path writes *without* validating — that is what makes it
# fast and what makes it unauditable — and `write_graph` declares
# `requires: validate_records`, so a bulk plan naming it would have been refused
# by the validator, correctly. `bulk_write` declares no `requires` instead of
# borrowing one, so the plan states what actually happens.

BULK_LOAD = Template(
    key="bulk-load",
    version=1,
    kind="bulk",
    description="Write a CSV folder straight through the connector — fast, and validating nothing.",
    intents=(),
    steps=(step("bulk_write", label="Load"),),
)


STITCH_APPLY = Template(
    key="stitch-apply",
    version=1,
    kind="stitch",
    description="Declare a bundle's join rules, staged, then write their edges on commit.",
    intents=(),
    steps=(
        step("apply_stitches", label="Apply"),
        step("commit_stitches", label="Commit"),
    ),
)

STITCH_COMMIT = Template(
    key="stitch-commit",
    version=1,
    kind="stitch",
    description="Commit the staged stitches and write their edges, under the Graph's guardrails.",
    intents=(),
    steps=(step("commit_stitches", label="Commit"),),
)

STITCH_WITHDRAW = Template(
    key="stitch-withdraw",
    version=1,
    kind="stitch",
    description="Withdraw the edges a removed stitch wrote, under the Graph's guardrails.",
    intents=(),
    steps=(step("withdraw_stitch", label="Withdraw"),),
)

STITCH_PREVIEW = Template(
    key="stitch-preview",
    version=1,
    kind="stitch",
    description="Count what stitch rules resolve, under the Graph's guardrails (ST43).",
    intents=(),
    steps=(step("preview_stitches", label="Preview"),),
)

COUNT_TYPES = Template(
    key="count-types",
    version=1,
    kind="canvas",
    description="Count the types the canvas's world holds (SP11).",
    intents=(),
    steps=(step("count_types", label="Count types"),),
)

RESOLVE_ELEMENTS = Template(
    key="resolve-elements",
    version=1,
    kind="canvas",
    description="Check a reopened canvas against the graph, under its world (GC14).",
    intents=(),
    steps=(step("resolve_elements", label="Resolve"),),
)

EXPAND_NEIGHBOURS = Template(
    key="expand-neighbours",
    version=1,
    kind="canvas",
    description="Read one vertex's neighbours under the canvas session's lens (GC6 · GC9).",
    intents=(),
    steps=(step("expand_neighbours", label="Expand"),),
)

TEMPLATES: dict[str, Template] = {
    t.key: t
    for t in (
        NL_SINGLE,
        QL_DIRECT,
        NL_COMPARE,
        MODELLER_PROPOSE,
        MODEL_IMPORT,
        BULK_LOAD,
        STITCH_APPLY,
        STITCH_COMMIT,
        STITCH_WITHDRAW,
        STITCH_PREVIEW,
        EXPAND_NEIGHBOURS,
        COUNT_TYPES,
        RESOLVE_ELEMENTS,
    )
}


# ── The intent → template map (V6: data, tunable by INSERT) ──────────────────
#
# Keyed by (ask kind, intent kind). A QL ask never reaches the NL templates
# because its kind decides first — that is why a typed query skips Understand
# and Translate without the planner having to know anything about it.

INTENT_TEMPLATES: dict[tuple[str, str], str] = {
    ("ql", "typed_query"): "ql-direct",
    ("nl", "single_query"): "nl-single",
    ("nl", "exploration"): "nl-single",
    ("nl", "compound"): "nl-compare",
    ("nl", "aggregate_and_chart"): "nl-compare",
    ("nl", "model_change"): "modeller-propose",
}


def template_key_for(*, ask_kind: str, intent_kind: str) -> str | None:
    """The **key** of the plan that serves this intent, or None when the model must plan.

    A key, not a step list. The rows in ``task_plans`` + ``tasks`` are what the
    runtime executes, and ``TEMPLATES`` above is the *seed source* those rows are
    exploded from — nothing else reads it
    (docs/for-developers/modules/workflows/features/the-library.md **LB12**).
    Returning a `Template` here is what made *a plan is its rows* true for the
    library and false for execution.

    This map is **selection, not the plan**, which is why it stays a dict: M12
    moves matching onto the plan row's own ``intent``, and that is the slice
    where the last dict in the run path goes.
    """
    return INTENT_TEMPLATES.get((ask_kind, intent_kind))


# ── Seeded agents ────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededAgent:
    key: str
    name: str
    description: str
    workflow_spec: dict
    instructions: str = ""
    # Explorer is the graph default: a session that names no agent gets it.
    default: bool = False
    surface: str = "explorer"
    # The bounds the interpreter enforces on delegation — depth, fan-out, spend
    # (docs/for-developers/modules/agents/features/delegation.md DG2). Empty on an
    # agent that does not delegate, which is all of them but one.
    budget: dict = field(default_factory=dict)


_PLANNING_ALLOW = [
    "understand_intent",
    "plan_workflow",
    "translate_thought",
    "validate_query",
    "execute_graph_query",
    "shape_for_canvas",
    "verify_result",
]

EXPLORER = SeededAgent(
    key="explorer",
    name="Explorer",
    description="Answers questions about this graph in plain language, and shows its work.",
    instructions=(
        "Answer only from this graph. If the graph cannot answer the question, say so "
        "instead of guessing. Prefer the smallest query that answers the ask."
    ),
    default=True,
    workflow_spec={
        "entry": "understand",
        "allow": _PLANNING_ALLOW,
        # The pin that makes every data canvas read-only from Studio. A plan
        # cannot unset it; the validator rejects a plan that tries.
        "pins": {"execute_graph_query": {"read_only": True}},
        "templates": ["nl-single", "nl-compare", "ql-direct"],
        "max_steps": 16,
        "max_replans": 1,
        "max_clarifications": 3,
    },
)

QL_AGENT = SeededAgent(
    key="ql-query",
    name="Query",
    description="Runs the query you typed. No translation, no interpretation.",
    workflow_spec={
        # No planning entry: the envelope's own steps are the plan (M1).
        "entry": "validate_query",
        "allow": ["validate_query", "execute_graph_query", "shape_for_canvas", "verify_result"],
        "pins": {"execute_graph_query": {"read_only": True}},
        "steps": list(QL_DIRECT.steps),
        "max_steps": 8,
    },
)

MODELLER = SeededAgent(
    key="modeller",
    name="Modeller",
    description="Turns a described change into staged edits on the model draft.",
    surface="modeller",
    instructions=(
        "Propose changes to the model draft only. Never write to the bound graph database. "
        "Explain each change in one line."
    ),
    workflow_spec={
        "entry": "understand_ask",
        "allow": ["understand_ask", "propose_model", "validate_proposal"],
        "steps": list(MODELLER_PROPOSE.steps),
        "max_steps": 6,
    },
)

# The one seeded agent that may delegate
# (docs/for-developers/modules/agents/features/delegation.md).
#
# Until this existed, `spawn_agent · delegate · await_delegations` shipped with
# no agent allowed to run them — so the path had never actually run. It is
# seeded **not as the default** and with tight bounds, because delegation is the
# expensive shape: one question becoming four.
#
# The bounds are enforced by the interpreter, never by the prompt (DG2): depth 2,
# three children per run, and a child's allow-list, skills, budget and LLM
# are all subsets of this one's.
COORDINATOR = SeededAgent(
    key="coordinator",
    name="Coordinator",
    description="Splits a question into parts, hands each to a helper it creates, and answers from what they return.",
    instructions=(
        "Delegate only when the question genuinely has independent parts. Give each helper "
        "one part, in its own words, and cite what it returned. If one question answers it, "
        "answer it yourself — a helper you did not need is a cost nobody agreed to."
    ),
    workflow_spec={
        "entry": "understand",
        "allow": [*_PLANNING_ALLOW, "spawn_agent", "delegate", "await_delegations"],
        "pins": {"execute_graph_query": {"read_only": True}},
        "templates": ["nl-single", "nl-compare", "ql-direct"],
        "max_steps": 24,
        "max_replans": 1,
        "max_clarifications": 3,
    },
    budget={"max_depth": 2, "max_children": 3},
)

SEEDED_AGENTS: tuple[SeededAgent, ...] = (EXPLORER, QL_AGENT, MODELLER, COORDINATOR)

# Which seeded agent a surface starts a session with, when the graph has no
# default of its own (docs/for-developers/modules/agents/spec.md: "defaulted at session creation by surface").
SURFACE_DEFAULT_AGENT: dict[str, str] = {"explorer": "explorer", "modeller": "modeller"}
