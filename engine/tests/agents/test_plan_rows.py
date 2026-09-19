"""A plan is its rows — and the rows lose nothing.

task-model-migration **M2** is done when *a plan round-trips to rows and back to
YAML byte-identically, and no plan carries a sequence-fallback edge nobody
meant*. These two tests are that sentence, one each.
"""

from __future__ import annotations

import pytest

from invana.apps.agents.registry import TEMPLATES
from invana.apps.task_plans.dag import dag_for, materialise
from invana.apps.task_plans.managers.task_plan import explode
from invana.apps.task_plans.models import PlanKind, PlanOrigin, TaskPlan
from invana.apps.task_plans.yaml_export import steps_of, to_yaml
from invana.runtime.catalogue import CATALOGUE

REQUIRES = {key: entry.requires for key, entry in CATALOGUE.items()}


def _plan(template) -> TaskPlan:
    return TaskPlan(
        id="p1",
        graph_id="g1",
        key=template.key,
        version=template.version,
        name=template.key,
        description=template.description,
        kind=PlanKind.ask.value,
        origin=PlanOrigin.builtin.value,
        intent=list(template.intents),
    )


@pytest.mark.parametrize("template", list(TEMPLATES.values()), ids=lambda t: t.key)
def test_a_plan_round_trips_through_rows(template) -> None:
    """Exploding a spec into rows and rendering it back is the same document.

    The rows are the plan, so anything the authored list said and the rows
    cannot say would be lost the first time a plan was read back.
    """
    tasks = explode("p1", template.steps, requires=REQUIRES)

    rebuilt = steps_of(tasks)
    authored = [
        {"id": s.get("id") or s.get("task"), "task": s["task"], "label": s["label"], "args": dict(s.get("args") or {})}
        for s in template.steps
    ]
    assert rebuilt == authored

    # And the export itself is stable — the bytes a person would diff.
    assert to_yaml(_plan(template), tasks) == to_yaml(_plan(template), explode("p1", template.steps, requires=REQUIRES))


@pytest.mark.parametrize("template", list(TEMPLATES.values()), ids=lambda t: t.key)
def test_no_unmeant_sequence_edge(template) -> None:
    """Every fallback edge left in a builtin is one that was reviewed.

    ``sequence`` is the guess: the node bound nothing and required nothing, so
    it was joined to the open sinks. The only one we mean is *Verify*, which
    summarises the work and therefore has to come after it. Anything else is a
    data-flow that should have been declared as a binding — which is exactly
    what `nl-single` was hiding before M2.
    """
    meant = {("verify_result", "shape_for_canvas")}
    rows = materialise(template.steps, requires=REQUIRES)
    found = {(row["key"], dep["key"]) for row in rows for dep in row["depends_on"] if dep["kind"] == "sequence"}
    assert found <= meant, f"{template.key} carries an unreviewed sequence edge: {found - meant}"


def test_two_readings_of_the_graph_do_not_depend_on_each_other() -> None:
    """`nl-compare`'s branches fork, because the list order between them is an artefact.

    This is the case the whole materialisation exists for: drawn as a chain,
    the plan would claim *Translate B requires Execute A*, which is false.
    """
    tasks = explode("p1", TEMPLATES["nl-compare"].steps, requires=REQUIRES)
    _, edges = dag_for(tasks)
    pairs = {(e["source"], e["target"]) for e in edges}

    assert ("execute_a", "translate_b") not in pairs
    assert {"translate_a", "translate_b"} == {t.key for t in tasks if not t.depends_on}
    # Both branches converge on the node that summarises them.
    assert {"execute_a", "execute_b"} == {s for s, t in pairs if t == "shape_for_canvas"}
