---
"invana": patch
---

A `${steps.x.y}` binding is resolved before the step reads it.

A compound ask — two readings of the graph, compared — selects the `nl-compare` plan, whose
*Validate B* and *Execute B* bind branch B's query off *Translate B*. Nothing resolved those
bindings, so the literal string `${steps.translate_b.query}` was handed to the step:

- *Validate* checked it for write keywords, found none, and passed it as read-only;
- *Execute* sent `${steps.translate_b.query}` to the graph;
- the reader was told **"I couldn't turn that into a query the graph accepts."**

The query was fine. The plan was fine. The message blamed the model for the runtime's
omission, which is the one thing a grounded answer must not do.

The interpreter now resolves each step's args immediately before dispatch, against the
settled outputs of the steps that ran before it — the same pattern, and the same top-level
argument surface, the validator already checks. A binding it proved legal is a binding that
resolves; resolving anywhere the validator does not look would open a path nothing proved
legal, which is what the closed catalogue exists to prevent.

A binding whose value is genuinely absent — `rationale` on a query the model did not
explain — resolves to nothing rather than failing the run, so it reads exactly as a plan that
never bound the argument at all.

The step row records the resolved value, so the trace shows the query that actually ran. The
authored binding is unchanged in the plan document, which is what a replay reads.
