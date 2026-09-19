---
"invana": minor
---

**Setup is three gates, not two checkboxes** (13.7 Setup, SU1–SU15).

A Graph could report *setup complete* and be unable to answer anything. The required set was
`graph_info` + `instructions` — a database, and a paragraph — while the two facts an answer
actually needs, a published model and an LLM provider, were not steps at all.

The required set is now what an answer cannot do without, grouped by what each group unlocks:

| Gate | Steps | Unlocks |
|---|---|---|
| Connected | Connect a database | Explorer · Query · introspection · model authoring |
| Grounded | Author a model · Bring data in | data on the canvas, answers drawn from records |
| Answering | Add an LLM provider | Ask · the Assistant · every agent run |

`instructions` and `skills` become optional and skippable: before a model and a provider exist
there is nothing for instructions to instruct, and asking for prose at the top is the onboarding
funnel this product refuses.

**Records already in the database count.** The data step is satisfied by a succeeded import run
*or* by introspection finding node labels, so a Graph pointed at a populated database is grounded
on arrival rather than being asked to import its own data to tick a box.

**A provider remembers its last ping.** `llm_providers` gains `last_ping_at`, `last_ping_ok` and
`last_ping_error`; saving stores a provider, the ping proves it, and the Answering gate waits on
the proof. A rejected key reads back in the provider's own words.

**One dependency per gate.** `require_graph_connected` · `require_graph_grounded` ·
`require_graph_answering` replace `require_graph_setup_complete`, which 409'd Explorer until the
whole sequence was finished. Explorer and the schema route wait on *connected*; sessions wait on
*answering*. Each step also reports `required`, `gate`, `blocked_by` and `broken`, so a surface can
say *why* a row is not actionable instead of inventing the reason.

In Studio, the graph page becomes the **setup board** while anything is outstanding: three gate
cards, the two optional steps, the exact `invana datasets import` line for the step that has no
Studio write path, and *What next* once the Graph is ready — offers, not more steps. The Info
panel's timeline is the same rows, compact. `SetupRequiredBanner` is replaced by `SetupLock`, which
names the gate that opens a surface rather than saying the graph "isn't ready". Creating a Graph
now asks for a name and a slug, and nothing else.
