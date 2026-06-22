---
"invana": minor
---

NL translation grounding now includes authored schema descriptions.

`render_model_context` previously emitted only `name:type` for each node/edge type and property, dropping the `description` fields that already exist on the model. It now surfaces them — property descriptions inline (`longest:integer (longest runway length, in feet)`) and node/edge descriptions as a trailing `— …` — so the model can map a user's wording to the schema (e.g. "length" → `longest`) from meaning, without hand-written synonyms (RFC-038, developer-tunable grounding).

No-op until descriptions are authored: when they're empty the rendered grounding is byte-identical to before, so there's no token bloat or behavior change for existing models.
