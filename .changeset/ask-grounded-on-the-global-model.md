---
"invana": patch
---

Ask describes the graph from its authored models, not from the introspected mirror. Understand and Translate now tell the model each type's and property's description and the Graph's active stitches (`Country.iso_code ≡ country.code`, `(Route)-[:ARRIVES_AT]->(airport) where Route.destination_code = airport.code`), so *the longest airport runway* maps to `airport.longest — Longest runway, in feet.` instead of coming back as *cannot answer*. Invana's own `_inv_*` bookkeeping properties are no longer sent. What the prompt describes is cut by the run's lens as well as by egress: a type or property the world hides is not described, and without `property_names` a stitch is sent without its join keys. The mirror remains the version a run engages and bounds.

A *cannot answer* from Understand now keeps its prompt and completion on the step, so the trace shows what the model was looking at when it judged.

The airways demo's guardrails let `property_names` reach an LLM again, which is what their README always said they did.
