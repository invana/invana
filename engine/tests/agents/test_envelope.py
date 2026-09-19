"""The envelope validator (docs/for-developers/modules/agents/spec.md) — the line that keeps a model-written
workflow inside the envelope (docs/for-developers/modules/ask/spec.md).

The model proposes; the interpreter disposes. Everything here is about the
disposing: what a plan may contain, what it may not rebind, and that a bad plan
fails at *plan time* with a reason rather than at step 6 with a surprise.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.envelope import Envelope, PlanRejected, apply_pins, validate_plan
from invana.apps.agents.registry import EXPLORER, NL_SINGLE
from invana.runtime.catalogue import CATALOGUE

ENVELOPE = Envelope.from_spec(EXPLORER.workflow_spec)


def check(plan_steps, envelope=ENVELOPE):
    """``validate_plan`` with the real catalogue handed down from band 3."""
    return validate_plan(plan_steps, envelope, catalogue=CATALOGUE)


def step(task: str, *, id: str | None = None, **args):
    return {"id": id or task, "task": task, "label": task.title(), "args": args}


class TestAccepts:
    def test_a_seeded_template_validates_against_the_seeded_envelope(self):
        steps = check([dict(s) for s in NL_SINGLE.steps])
        assert [s.task for s in steps] == [
            "translate_thought",
            "validate_query",
            "execute_graph_query",
            "shape_for_canvas",
            "verify_result",
        ]

    def test_a_backward_binding_resolves(self):
        steps = check(
            [
                step("translate_thought", id="t1"),
                step("validate_query", id="v1", query="${steps.t1.query}"),
                step("execute_graph_query", id="e1", query="${steps.t1.query}"),
            ],
        )
        assert steps[1].args["query"] == "${steps.t1.query}"

    def test_pins_are_overlaid_onto_a_plan_that_never_mentioned_them(self):
        # `read_only: true` holds even for a plan that said nothing about it —
        # which is why a data canvas can never be written from Studio.
        steps = apply_pins(
            check([step("validate_query", id="v"), step("execute_graph_query", id="e")]),
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
                [step("validate_query", id="v"), step("execute_graph_query", id="e", read_only=False)],
                ENVELOPE,
            )
        assert "pinned" in str(caught.value)

    def test_executing_without_validating_first(self):
        with pytest.raises(PlanRejected) as caught:
            check([step("translate_thought", id="t"), step("execute_graph_query", id="e")])
        assert "requires 'validate_query'" in str(caught.value)

    def test_a_forward_reference(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [
                    step("validate_query", id="v", query="${steps.later.query}"),
                    step("translate_thought", id="later"),
                ],
                ENVELOPE,
            )
        assert "does not run before it" in str(caught.value)

    def test_an_envelope_cannot_waive_what_the_catalogue_requires(self):
        # `require` is the catalogue's, not the envelope's — one source, and it
        # is the same line the planner read while drafting.
        loose = Envelope.from_spec({"allow": ["execute_graph_query"], "require": []})
        with pytest.raises(PlanRejected) as caught:
            check([step("execute_graph_query", id="e")], loose)
        assert "requires 'validate_query'" in str(caught.value)

    def test_binding_to_an_output_the_entry_never_declared(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [
                    step("translate_thought", id="t"),
                    step("validate_query", id="v", query="${steps.t.sql}"),
                ],
            )
        assert "does not declare as an output" in str(caught.value)

    def test_a_step_with_no_label_has_no_row_on_the_card(self):
        with pytest.raises(PlanRejected) as caught:
            check([{"id": "v", "task": "validate_query", "args": {}}])
        assert "label" in str(caught.value)

    def test_a_plan_longer_than_the_budget_is_rejected_not_truncated(self):
        # Half a plan answers a different question.
        small = Envelope.from_spec({"allow": ["validate_query"], "max_steps": 2})
        with pytest.raises(PlanRejected) as caught:
            check([step("validate_query", id=f"v{i}") for i in range(3)], small)
        assert "the envelope allows 2" in str(caught.value)

    def test_every_error_comes_back_at_once_so_the_one_repair_can_fix_them_all(self):
        with pytest.raises(PlanRejected) as caught:
            check(
                [step("nope", id="a"), step("also_nope", id="b")],
                Envelope.from_spec({"allow": ["validate_query"]}),
            )
        assert len(caught.value.errors) == 2


class TestModes:
    def test_a_planning_envelope_is_marked_as_one(self):
        assert ENVELOPE.plans is True

    def test_a_static_envelope_is_the_degenerate_case(self):
        static = Envelope.from_spec({"entry": "validate_query", "steps": [step("validate_query", id="v")]})
        assert static.plans is False
        assert [s.task for s in static.steps] == ["validate_query"]
