---
"invana": patch
---

Answers take the visual you ask for: "as a table", "as a chart" or "show the graph".

- The intent classifier returns a structured `prefer` (`graph` · `table` · `chart`, or empty) on the understood intent, and the `understand_intent` step's output carries it.
- An answer's template is ranked by `prefer`, then by the intent kind (`aggregate_and_chart` leans to a chart, then a metric; `exploration` to a subgraph), then by the most specific shape match. The raw question is no longer matched against a template's `intent` text.
- An asked-for visual never forces a template that cannot render the result: a chart asked of a single number still renders the number, and the picker offers the chart disabled with its reason.
