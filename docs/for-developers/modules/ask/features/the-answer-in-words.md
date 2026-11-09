# The answer, in words

After the records are read, the agent says what they mean — a few sentences in its own voice, every
claim cited to the record behind it. The table and the subgraph are still there; the words come first.

| | |
|---|---|
| Index | [3.12](../../../README.md#3--ask) · Slice **S-TBD** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [what an answer is made of](the-answer-surface.md) · [soul](../../agents/features/soul.md) · beyond the graph · [ask in natural language](ask-in-natural-language.md) |

Product spec: [EX-F04 · The answer](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Components |
|---|---|---|
| Prose emission | `ProseBody`: sentences with inline citation markers, third-party claims badged | `EmissionCard` · `ProseBody` · citation chip · `ThirdPartyBadge` (3.13) |
| Trace | The Answer step with its exchange ([SR42](../../operate/features/see-what-ran.md#decisions)), claims kept and dropped | `TraceDialog` |

## Engine

| Thing | Shape |
|---|---|
| Entry | `answer_in_words`, bound `llm`, after `verify_result` in every `nl-*` plan |
| Inputs | the ask · the intent summary · up to 50 rows with their record ids · the soul |
| Tool output | `claims: [{text, cites: [record_id…]} \| {text, third_party: {source, reference, …}}]` — the third-party shape is 3.13's |
| Emission | `prose` · payload `{claims}` · citation = union of cited record ids |
| Egress | `the_question` + `property_values`; without `property_values` the step is skipped, not failed |
| Order | the prose emission's `seq` precedes the emissions it cites |
| Events | `emission.produced` |

## Decisions

| # | Decision |
|---|---|
| AW1 | **The Answer step is how a `prose` emission is made.** It is one more step in every natural-language plan, after Verify, bound `llm`; nothing else writes prose. Adding it is a new version of each seeded `nl-*` plan, and seeding upgrades a Graph that holds the old one — a plan is versioned, so the step reaches existing Graphs as a version, never as an edit in place. |
| AW3 | **The Answer step fails soft.** It adds words to an answer that already exists; a model error, a timeout, a cut or zero kept claims leaves the records as the answer and marks the step, never the run. The mechanism is `optional` on the plan step: an optional step that fails is recorded failed and the interpreter goes on, which is the only step kind that may. |
| AW4 | **Words lead.** The prose emission is first in the reading order and the records it cites follow, because a person reads the sentence and checks the table, not the other way round. Reading order is `seq`, so Project reserves the first `seq` for the prose it precedes; when no prose is written the gap stays, and a gap orders nothing wrongly. |

