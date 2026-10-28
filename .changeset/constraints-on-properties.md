---
"invana": minor
---

A property can carry a constraint: a range with a unit, or the values a standard names.

- **The Constraints tab** on a type's page lists every property with its constraint and where
  it comes from — `80 – 180 days`, `model · constraint`, or `CO_338 · Seed type` — then the
  database's key, unique and exists rules. `Constraints · N` counts both.
- **The constraint dialog** sets a range (either bound may be open) or a standard's term,
  and whether a record that breaks it is *Rejected* or *Flagged for review*. Before saving it
  says how many records in the graph break it today, naming up to five.
- **Checked wherever records land** — every import, every dataset bound to the Graph, and an
  Explorer board's data edits. A refusal names the constraint:
  `airport.runways breaks its constraint 1 – 3 runways: 4`. A flagged record lands and is
  listed in the load's report.
- A constraint is a draft change: staged, reviewed and published with the model. Adding or
  narrowing one is breaking.
