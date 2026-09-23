---
"invana": patch
---

A skill can inline a library plan instead of redrawing its steps, and tune the arguments that plan declares (SK32 · SK33 · LB20).

A hand-edited plan row may now name a **plan** rather than a step. Saving it copies that plan's rows
in — flat, each carrying the version it came from — so the envelope validates one graph and a
composed plan cannot smuggle a step past a bound. Re-opening the editor collapses those rows back
into the one row that wrote them, so editing a skill that inlined five steps does not quietly turn
them into five steps somebody wrote.

**Copied, not linked.** The library may publish a newer version tomorrow and the skill still does
what it said it did today; re-inlining is an act somebody asks for. That is also what keeps a
published version's plan from going stale against its prose.

A reusable plan can now **declare arguments** — `args_schema`, with a type, a default and a label —
and its own rows bind them as `${args.<name>}`. A caller tunes them when it inlines the plan, and a
plan selected directly runs on what it declares; either way the marker is resolved before anything
validates, so the runtime is handed literals and the grammar it already knows. An argument the plan
does not declare is refused by name beside the ones it does, and a value of the wrong type is refused
as one.

`nl-single@2` declares the one argument that tail genuinely has: `read_only`. A new version rather
than an edit to `@1`, because a library version is immutable — editing it would have given a fresh
install one thing and an existing install another, under one name.

New: `GET …/skills/inlinable` lists what a skill may inline, with each plan's bands, step count and
declared arguments.
