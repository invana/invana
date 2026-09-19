"""The DAG the plan canvas draws (docs/for-developers/modules/workflows/spec.md).

The claim under test is a narrow one: the picture is the **partial order**, not
the authored list. A plan is written as a list because it has to be written in
some order, but "runs at index 4" is not "must run after index 3" — and drawing
the second when only the first is true is the bug these tests exist to keep out.

Since M2 the order is **materialised**: :func:`materialise` decides it once,
when the plan is written, and ``dag_for`` reads the rows back. So these tests
run the real path — explode, then draw — rather than deriving on read.
"""

from __future__ import annotations

from invana.apps.agents.registry import NL_COMPARE, NL_SINGLE
from invana.apps.task_plans.dag import dag_for
from invana.apps.task_plans.managers.task_plan import explode
from invana.runtime.catalogue import CATALOGUE

#: `requires` is the catalogue's, handed down the way the runtime hands it —
#: the picture is materialised against the same line the validator enforces.
REQUIRES = {key: entry.requires for key, entry in CATALOGUE.items()}


def _tasks(template):
    return explode("p1", template.steps, requires=REQUIRES)


def test_independent_branches_share_a_depth_and_converge() -> None:
    """`nl-compare` reads the graph twice; neither reading waits on the other."""
    nodes, edges = dag_for(_tasks(NL_COMPARE))
    depth = {n["id"]: n["depth"] for n in nodes}

    # The two translations are roots — the list puts `translate_b` fourth, and
    # that is not a dependency.
    assert depth["translate_a"] == depth["translate_b"] == 0
    assert depth["validate_a"] == depth["validate_b"] == 1
    assert depth["execute_a"] == depth["execute_b"] == 2

    order = {(e["source"], e["target"]) for e in edges if e["kind"] == "order"}
    assert ("execute_a", "translate_b") not in order, "the list order is not a dependency"

    # Both branches feed the step that summarises them, which is what makes the
    # picture converge instead of dangle.
    assert ("execute_a", "shape_for_canvas") in order
    assert ("execute_b", "shape_for_canvas") in order
    assert depth["shape_for_canvas"] == 3
    assert depth["verify_result"] == 4


def test_bindings_and_require_are_different_edges() -> None:
    """A binding says *this feeds that*; a require says *this comes first*."""
    _, edges = dag_for(_tasks(NL_COMPARE))
    bindings = {(e["source"], e["target"]): e["label"] for e in edges if e["kind"] == "binding"}

    # `${steps.translate_a.query}` → `query`: the field keeps its name, so the
    # label says it once rather than "query → query".
    assert bindings[("translate_a", "validate_a")] == "query"
    assert bindings[("translate_a", "execute_a")] == "query"

    # The require rule resolves to *branch A's* validation, not branch B's.
    requires = {(e["source"], e["target"]) for e in edges if e["label"] == "require"}
    assert ("validate_a", "execute_a") in requires
    assert ("validate_b", "execute_b") in requires
    assert ("validate_a", "execute_b") not in requires


def test_a_linear_template_stays_linear() -> None:
    """Nothing is invented: a plan with no branches draws as one column.

    It is not a bare chain, and that is deliberate. `execute_graph_query` reads
    the query `translate_thought` produced *and* must follow `validate_query`,
    so it has two predecessors — the same shape `nl-compare`'s branches have.
    Before M2 the binding was implicit and the edge was recorded as a sequence
    guess; declaring it is what made the two templates agree.
    """
    nodes, edges = dag_for(_tasks(NL_SINGLE))
    assert [n["depth"] for n in nodes] == [0, 1, 2, 3, 4]

    pairs = {(e["source"], e["target"]): e["kind"] for e in edges}
    assert pairs[("translate_thought", "execute_graph_query")] == "binding"
    assert pairs[("validate_query", "execute_graph_query")] == "order"
    # Every node but the root is reachable, and nothing skips backwards.
    assert {t for _, t in pairs} == {n["id"] for n in nodes[1:]}
