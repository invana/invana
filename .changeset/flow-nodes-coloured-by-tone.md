---
"invana": patch
---

Every step on a plan's Flow has its coloured border and icon again (TF6).

Only LLM steps were coloured: the canvas looked colours up by the step's raw layer, and a layer
like `graph data` or `code` matched none of the three keys. Steps are now coloured by their type,
and the finer layer is still printed on the card.
