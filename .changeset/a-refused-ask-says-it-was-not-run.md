---
"invana": minor
"studio": minor
---

An ask that a guardrail refuses before it runs now reads *This ask was not run*, and names the world it was asked in, the role, the model that world cast, and whose guardrail refused it (AG35). Before this, the refusal showed as one line of red error text. The engine's `422` for a refused cast carries those facts beside the sentence (`error: "cast_refused"`), and Studio draws them in a new `RefusalCard`.

A run is now drawn against the per-run spend ceiling it froze, not the agent's cap as it reads today, and each run in a list carries its spend, absent when no step was priced (EB13).

The agent page also:

- lists the Graph's guardrails beside its own under *Always in force*
- lays Soul and Activity out in two columns when there is room
- puts the soul's **Preview** in the page header
- shows each run's cost on Activity
