"""The envelope validator (docs/for-developers/modules/agents/spec.md) — the line that keeps a model-written
workflow inside the envelope (docs/for-developers/modules/ask/spec.md).

The model proposes; the interpreter disposes. Everything here is about the
disposing: what a plan may contain, what it may not rebind, and that a bad plan
fails at *plan time* with a reason rather than at step 6 with a surprise.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.envelope import Envelope, PlanRejected, apply_pins, validate_plan
from invana.apps.agents.registry import EXPLORER
from invana.plugins import load_plugins
from invana.runtime.catalogue import CATALOGUE

NL_SINGLE = load_plugins().flows["nl-single"]
ENVELOPE = Envelope.from_spec(EXPLORER.workflow_spec)


def check(plan_steps, envelope=ENVELOPE, declares=None):
    """``validate_plan`` with the real catalogue handed down from band 3."""
    return validate_plan(plan_steps, envelope, catalogue=CATALOGUE, declares=declares)


def step(task: str, *, id: str | None = None, **args):
    return {"id": id or task, "task": task, "label": task.title(), "args": args}


class TestAccepts:
    def test_a_seeded_template_validates_against_the_seeded_envelope(self):
        # Its own `args_schema` comes with it: a plan that binds `${args.N}` is
        # validated against what it declares (LB20).
        steps = check([dict(s) for s in NL_SINGLE.steps], declares=NL_SINGLE.args_schema)
        assert [s.task for s in steps] == [
            "nl.translate",
            "graph.read.validate",
            "graph.read.query",
            "answer.shape",
            "plan.verify",
        ]

    def test_a_backward_binding_resolves(self):
        steps = check(
            [
                step("nl.translate", id="t1"),
                step("graph.read.validate", id="v1", query="${steps.t1.query}"),
                step("graph.read.query", id="e1", query="${steps.t1.query}"),
            ],
        )
        assert steps[1].args["query"] == "${steps.t1.query}"

    def test_pins_are_overlaid_onto_a_plan_that_never_mentioned_them(self):
        # `read_only: true` holds even for a plan that said nothing about it —
        # which is why a data canvas can never be written from Studio.
        steps = apply_pins(
            check([step("graph.read.validate", id="v"), step("graph.read.query", id="e")]),
            ENVELOPE,
        )
        assert steps[1].args["read_only"] is True


class TestRejects:
    def test_a_task_outside_the_allow_list(self):
        with pytest.raises(PlanRejected) as caught:
            check([step("delete_everything")])
        assert "allow-list" in str(caught.value)

    def test_unsetting_a_pinned_arg(self):
        # The one that matters: a plan cannot make execution writable.
        with pytest.raises(PlanRejected) as caught:
            check(
                [step("graph.read.validate", id="v"), step("graph.read.query", id="e", read_only=False)],
                ENVELOPE,
            )
        assert "pinned" in str(caught.value)

    def test_executing_without_validating_first(self):
        with pytest.raises(PlanRejected) as caught:
            check([step("nl.translate", id="t"), step("graph.read.query", id="e")])
        assert "requires 'graph.read.validate'" in str(caught.value)

    def test_a_forward_reference(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [
                    step("graph.read.validate", id="v", query="${steps.later.query}"),
                    step("nl.translate", id="later"),
                ],
                ENVELOPE,
            )
        assert "does not run before it" in str(caught.value)

    def test_an_envelope_cannot_waive_what_the_catalogue_requires(self):
        # `require` is the catalogue's, not the envelope's — one source, and it
        # is the same line the planner read while drafting.
        loose = Envelope.from_spec({"allow": ["graph.read.query"], "require": []})
        with pytest.raises(PlanRejected) as caught:
            check([step("graph.read.query", id="e")], loose)
        assert "requires 'graph.read.validate'" in str(caught.value)

    def test_binding_to_an_output_the_entry_never_declared(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [
                    step("nl.translate", id="t"),
                    step("graph.read.validate", id="v", query="${steps.t.sql}"),
                ],
            )
        assert "does not declare as an output" in str(caught.value)

    def test_a_step_with_no_label_has_no_row_on_the_card(self):
        with pytest.raises(PlanRejected) as caught:
            check([{"id": "v", "task": "graph.read.validate", "args": {}}])
        assert "label" in str(caught.value)

    def test_a_plan_longer_than_the_budget_is_rejected_not_truncated(self):
        # Half a plan answers a different question.
        small = Envelope.from_spec({"allow": ["graph.read.validate"], "max_steps": 2})
        with pytest.raises(PlanRejected) as caught:
            check([step("graph.read.validate", id=f"v{i}") for i in range(3)], small)
        assert "the envelope allows 2" in str(caught.value)

    def test_every_error_comes_back_at_once_so_the_one_repair_can_fix_them_all(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [step("nope", id="a"), step("also_nope", id="b")],
                Envelope.from_spec({"allow": ["graph.read.validate"]}),
            )
        assert len(caught.value.errors) == 2


class TestModes:
    def test_a_planning_envelope_is_marked_as_one(self):
        assert ENVELOPE.plans is True

    def test_a_static_envelope_is_the_degenerate_case(self):
        static = Envelope.from_spec({"entry": "graph.read.validate", "steps": [step("graph.read.validate", id="v")]})
        assert static.plans is False
        assert [s.task for s in static.steps] == ["graph.read.validate"]


class TestTheCeilings:
    """`agents.budget`, read through `effective_budget`
    ([EB1](docs/for-developers/modules/agents/features/envelope-and-budget.md))."""

    def test_a_row_that_sets_nothing_gets_every_ceiling(self):
        from invana.apps.agents.models import Agent

        budget = Agent(budget=None).effective_budget

        assert budget["max_tokens_month"] == 5_000_000
        assert budget["max_tokens_run"] == budget["max_tokens"] == 200_000
        assert not any(key.startswith("max_cost_usd") for key in budget)
        assert budget["max_concurrent_runs"] == 3
        assert budget["max_fanout"] == 200

    def test_the_old_name_still_means_the_run(self):
        """EB8 — a row carrying `max_tokens` meant the run; it is read as
        `max_tokens_run` and answered back under both names."""
        from invana.apps.agents.models import Agent

        budget = Agent(budget={"max_tokens": 8_000}).effective_budget

        assert budget["max_tokens_run"] == budget["max_tokens"] == 8_000

    def test_both_names_set_the_smaller_binds_and_money_bounds_nothing(self):
        """EB8 — a ceiling read two ways never widens; a stored money key is
        answered as stored and is not a token budget."""
        from invana.apps.agents.models import Agent

        budget = Agent(budget={"max_tokens": 8_000, "max_tokens_run": 50_000, "max_cost_usd_run": 2.0}).effective_budget

        assert budget["max_tokens_run"] == 8_000
        assert budget["max_cost_usd_run"] == 2.0
