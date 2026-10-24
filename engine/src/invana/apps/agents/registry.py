"""Seeded agents, the step labels, and the intent → template map.

Both are **data** rather than code — docs/for-developers/modules/agents/spec.md
**V6**: an INSERT changes which template an intent picks, the same posture taken
in docs/for-developers/modules/ask/spec.md for "adding an agent is an INSERT".

The library itself — `nl-single@2`, `model-import@1`, … — is the packaged flows
of the core plugins (``invana/plugins/core/*/flows/``). It is band 3, so nothing
here imports it; the runtime hands it to the library seeder.

``INTENT_TEMPLATES``
    The map *Plan* reads: `(ask kind, intent kind) → template key`. Tuning this
    is the cheapest half of the learning loop in docs/for-developers/modules/workflows/features/promote-a-plan.md.

``SEEDED_AGENTS``
    The agents every graph gets: *Explorer* (plans), *Query* (static QL tail),
    *Modeller* (plans a model proposal). A session that names no agent behaves
    exactly as it does today, because these carry the packaged flows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ── Step labels ──────────────────────────────────────────────────────────────
#
# The words on the card. `nl.translate` was labelled *Understand* before
# docs/for-developers/modules/agents/spec.md; calling translation "Understand" is what made "understand then
# plan" sound like a duplicate. It is *Translate* now, and *Understand* is its
# own step (docs/for-developers/modules/agents/spec.md "the current label lies").

LABELS: dict[str, str] = {
    "nl.understand": "Understand",
    "plan.compose": "Plan",
    "nl.translate": "Translate",
    "graph.read.validate": "Validate",
    "graph.read.query": "Execute",
    "answer.shape": "Project",
    "plan.verify": "Verify",
    "model.understand_ask": "Understand",
    "model.propose": "Propose",
    "model.validate_proposal": "Validate",
    "work.spawn_agent": "Spawn",
    "work.delegate": "Delegate",
    "work.await": "Await",
    "work.create_task": "Sub-task",
}


def step(task: str, *, id: str | None = None, label: str | None = None, **args: Any) -> dict:
    """One plan step, in the shape :mod:`invana.apps.agents.envelope` parses.

    The id defaults to the function with dots as underscores (``graph.read.query``
    → ``graph_read_query``): a step id is what ``${steps.<id>.<output>}`` binds, so it never carries a dot.
    """
    return {"id": id or task.replace(".", "_"), "task": task, "label": label or LABELS.get(task, task), "args": args}


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

    A key, not a step list. The rows in ``flows`` + ``tasks`` are what the
    runtime executes, and the packaged flows are the *seed source* those rows are
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
    # Steps, replans, clarifications — how hard it tries (EB9). Its own column,
    # neither the envelope nor the budget.
    effort: dict = field(default_factory=dict)


_PLANNING_ALLOW = [
    "nl.understand",
    "plan.compose",
    "nl.translate",
    "graph.read.validate",
    "graph.read.query",
    "answer.shape",
    "plan.verify",
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
        "pins": {"graph.read.query": {"read_only": True}},
        "templates": ["nl-single", "nl-compare", "ql-direct"],
    },
    effort={"max_steps": 16, "max_replans": 1, "max_clarifications": 3},
)

QL_AGENT = SeededAgent(
    key="ql-query",
    name="Query",
    description="Runs the query you typed. No translation, no interpretation.",
    workflow_spec={
        # No planning entry: the envelope's own steps are the plan (M1).
        "entry": "graph_read_validate",
        "allow": ["graph.read.validate", "graph.read.query", "answer.shape", "plan.verify"],
        "pins": {"graph.read.query": {"read_only": True}},
        "steps": [
            step("graph.read.validate"),
            step("graph.read.query", read_only=True),
            step("answer.shape"),
            step("plan.verify"),
        ],
    },
    effort={"max_steps": 8},
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
        "entry": "model_understand_ask",
        "allow": ["model.understand_ask", "model.propose", "model.validate_proposal"],
        "steps": [step("model.understand_ask"), step("model.propose"), step("model.validate_proposal")],
    },
    effort={"max_steps": 6},
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
        "allow": [*_PLANNING_ALLOW, "work.spawn_agent", "work.delegate", "work.await"],
        "pins": {"graph.read.query": {"read_only": True}},
        "templates": ["nl-single", "nl-compare", "ql-direct"],
    },
    effort={"max_steps": 24, "max_replans": 1, "max_clarifications": 3},
    budget={"max_depth": 2, "max_children": 3},
)

SEEDED_AGENTS: tuple[SeededAgent, ...] = (EXPLORER, QL_AGENT, MODELLER, COORDINATOR)

# Which seeded agent a surface starts a session with, when the graph has no
# default of its own (docs/for-developers/modules/agents/spec.md: "defaulted at session creation by surface").
SURFACE_DEFAULT_AGENT: dict[str, str] = {"explorer": "explorer", "modeller": "modeller"}
