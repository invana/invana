---
"invana": patch
---

The touch record says what the lens did (WO17 · WO18 · WO19 · GR15).

Four open calls settled and built, and with them the last gap between what Govern's feature files
promise and what a run records. 14.1 Worlds and 14.2 Guardrails read ✅ on the API.

**The slice on the touch is keyed by type** (WO17). A world that narrows by naming authored models
compiles a slice per type into the connector's lens, and the read's own verdict carried none of it
— so `applied.select` was never written on exactly the shape a world is authored in, and the step
dashboard's `SliceSummary` branch was dead. Both `select` and `properties_excluded` now come off
the compiled lens, keyed by type, with a narrowing written against the grounding version itself
filed under `*`. The connector's vocabulary is unchanged: the authored `time` · `geo` · `dims`
shape rides a new `CompiledLens` beside `QueryLens`, because a connector has no use for it and a
person reading the touch has nothing else.

**Compare diffs what each run applied, not only what it touched** (WO18). Two runs read
*shared 2 · differed 0* while one sliced a type and the other rewrote its projection. A shared
address now carries which fields of `applied` differ and each side's value; an address only one run
reached is unchanged, and a participant both read identically says no more. Nothing is synthesised
— every value was recorded by a run that ran. The compare page splits its one *Differed* tile into
*Only one reached* and *Read differently*, which are two findings, not one.

**`rows_available` is retired** (WO19). Knowing what a query would have returned unsliced means
running it unsliced — an unbounded cost on exactly the reads a bound exists to keep small, on every
governed read. The column, the `volume` key and the *1,283 — not 4,902* sentence are gone. `rows`
is the count, and *what narrowed this* is answered by the world, the rule and the slice.

**A closed-layer refusal names the world and the layer** (GR15). No rule fires when a layer was
never opened, so `rule_matched` was empty and G7's *a refusal names the rule* printed
*not permitted* with nothing to act on. A `Closure` now carries its lens' display name, frozen with
the rest so a rename cannot rewrite a past refusal, and the refusal reads
*`llm/anthropic/claude-opus-5` is not in `EU · H1 2026` — the `llm` layer is closed*. `rule_matched`
stays empty: inventing a rule id for a decision no rule made would put a value in the record that
nothing in the world matches.
