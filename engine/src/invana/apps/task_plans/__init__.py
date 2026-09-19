"""The plan library — reusable **TaskPlans**, referenced by agents
(docs/for-developers/modules/workflows/spec.md).

Three words that are easy to confuse, kept apart here and everywhere
(docs/for-developers/terminology.md §8):

**TaskPlan** (this module)
    The flow that carries work out, `key@version`: an ordered set of **Task**
    rows with their bindings. A *workflow* is not a fourth noun — it is a
    TaskPlan that is ``reusable``, which is why the library is a filter of this
    table rather than a table of its own
    ([SR5](docs/for-developers/modules/operate/features/see-what-ran.md)).

**Task** (this module)
    One node of a plan — an LLM call, a query, a decision box, a fan-out.
    ``task_plan_id`` is ``NOT NULL``, and that constraint is the rule: nothing
    a person authors is ever a Task. What a person writes down is a **Todo**,
    and it lives in :mod:`invana.apps.work`.

**Envelope** (:mod:`invana.apps.agents.envelope`)
    Per-agent policy: which plans it may select, plus the allow-list, the
    pinned args and the budgets that bound whatever it selects.

Authoring a plan from scratch is out of MVP: a plan drives dispatch, so
authoring is an execution surface and needs its own threat model. A canvas is
not a loophole in that
(docs/for-developers/modules/explore/features/selection-and-the-panel.md).
"""
