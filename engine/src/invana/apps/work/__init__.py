"""Tasks — the assignable unit of work (specs/system-design/modules/work.md).

Named ``work`` rather than ``tasks`` on purpose. specs/system-design/modules/work.md **D1** keeps two words
that would otherwise collide: a **Task** is what a person writes down and hands
to someone, and a *step* is one attempt of one runtime callable (``task_key``
in code, because docs/for-developers/modules/ask/spec.md keeps the Prefect 1:1 mapping). The user-facing noun
wins in the UI; the package name is where the collision is paid, once.

A Task never *runs*. It is **worked through as** runs and runs, which
is why there is no ``task_runs`` table — invariant R1, applied one level up.
"""
