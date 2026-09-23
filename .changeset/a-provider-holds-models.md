---
"invana": patch
---

A provider holds models, and the cast is the only thing that picks one (PM9 · PM14).

One `llm_providers` row was one *provider + model*. It is now a **configured endpoint** — a name
somebody chose, a vendor kind, a base URL, one credential — and `llm_models` holds what it offers,
because `llm/anthropic-prod/claude-opus-5` has a provider segment and a model segment and one table
cannot be both. The `name` **is** the address segment, so it is a word a refusal can read back
rather than a uuid (PM10).

**Both existing answers to *which model answers this* are gone.** `llm_providers.is_default` goes
with its partial unique index, and `agents.llm_config_id` with it: a default was only ever the
answer to *which model when nobody said*, and the lens `cast` is that answer now. A run composes its
effective lens, resolves the `decide` role against it, and looks the address up — once, at open,
frozen beside the lens, so *which model answered* and *what it was allowed to see* cannot disagree.
A Graph that casts nothing runs the **shipped cast** over the models it offers; a Graph offering none
gets the 422 that routes somebody to the LLMs drawer. `POST …/llm/{id}/set-default` is retired and
`…/llm/{id}/models` arrives in its place.

**Migration `000000000053` is the irreversible one, so it carries the rows over rather than the
schema alone.** Each old row becomes one provider plus one model; each Graph's current default
becomes an explicit graph-scoped guardrail casting all three reading roles at the address it answers
at today, so nothing silently changes what produces an answer. Rules written against the interim
id-suffixed address of a duplicated vendor (`llm/anthropic-3f9c2b17/*`) are rewritten to the
readable name, because leaving a world pointed at a participant that no longer exists would widen it.
The down path rebuilds `model_id` from the first model per provider, is lossy for a provider that
grew a second, and leaves the seeded guardrail standing — a downgrade must never remove a bound.

The unit of a call is now an `LLMEndpoint`, a provider row **and** one of its models (PM13); pricing
reads the model's own rate before the endpoint's override, since a rate is a fact about a model and
the row that carried it used to be the row that carried the key. A spawned agent inherits its
parent's `lens_id`, which is how *LLM ⊆ its parent's* survives the split — and closes the one
dimension in which a child used to be wider than the agent that spawned it (DG9).
