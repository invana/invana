---
"invana": minor
"studio": minor
---

An answer is a record, and it says which kind of nothing it is (docs/for-developers/modules/ask/spec.md).

**Emissions are rows.** The `project` step writes what it produced — `subgraph · table · metric · chart · prose · empty` — with the query and the record count it cites, so an answer survives a reload instead of living in the page until someone refreshes. `GET …/thinkings/{id}/emissions` reads them back. A reply whose run was never recorded still renders, by folding one emission out of the query result it carries, and names no template because none chose the rendering.

**Five result templates ship with the distribution** — `records-table · single-value · category-bars · graph-subgraph · nothing-held` — as ordinary rows belonging to no Graph, so a Graph's own template competes with them on the same terms. `accepts` is checked before anything renders: a one-cell result becomes a number rather than a one-row table, and a chart asked to draw one point says *needs a label column and one numeric column, over more than one row* instead of drawing a dot. The emission header carries the switcher, listing every template that would render the same records and, for the ones that would not, **why** — disabled with its reason, never hidden. Switching re-renders from the records already returned; the query never runs again. Templates are authored, versioned and published from a Templates panel, and a published one is read-only because an answer rendered with it must not change shape afterwards.

**A run records how it ended.** `thinkings.outcome` is `answered · cannot_answer · failed · cancelled`, beside the machinery of `status` — a run that finished cleanly having found nothing is *succeeded* **and** *cannot_answer*, and those are not the same claim. Studio draws them as different things: a cannot-answer is calm and dashed, saying what the graph does not hold; a diagnosis is a fault with its evidence foldable underneath and its next step as the only action. Retry and repair stay on the step rows where they happened.

**The trace opens from the number it explains.** `GET …/thinkings/{id}/trace` returns every step with its timings, tokens, input, output and error, and the emission header's citation opens it — because "where did this come from" is a question about that number, not about the session. The generated query is shown verbatim and copyable, and skills stay two counts with what each one means beside them: `offered` is a fact about the prompt, `reported applied` is the model's own claim.

`POST …/thinkings/{id}/answer` records what a person chose as an option id and a value rather than as prose, and only a person can answer.
