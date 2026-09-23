---
"invana": minor
---

A step row names the rules it was offered, and marks the ones it cited
(rules.md RU12 · RU7 · RU11).

**Both halves of the pair were on the record, and only one was ever read.**
`task_runs.rules_offered` has been written by assembly since the statement migration, and no step
surface carried either column — so the activity tree and a step's trace detail drew a skill's
*offered* against *reported* and said nothing at all about rules. A reader could not tell a
statement the model ignored from one it was never given, which is the one distinction the evidence
loop needs.

- `ActivityNode` and `TraceStep` both carry **`rules_offered` · `rules_cited`**, each item an
  `OfferedRule` — the `rule_version_id`'s **statement**, resolved by the engine, beside the
  `rules.id` it belongs to. The version's wording, never the rule's current one: rewording a rule
  afterwards must not rewrite what a past step was given (RU4 · C5). A version whose rule is gone
  resolves to nothing and is dropped, because a step row shows statements and an id is not one.
- One resolve per tree or trace — `offered_rules`, beside the citations manager that already
  answers the other direction — so the two surfaces ask once each rather than once per row.
- The row draws **offered** and marks **cited**, exactly as a skill row draws offered and marks
  reported. They are the same two certainties and a reader should not have to learn a second
  convention for the second one. A statement is the row; clicking one opens that rule's `kind =
  rule` board with the drawer where it was (RU11). The trace dialog draws the statements and links
  nothing — a board would open behind the dialog, so the drill-in belongs to the tree.
