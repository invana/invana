# Give an agent a soul

An agent's soul is who it is and how it speaks — a Markdown document on the agent, read by every step
whose words a person reads, and by none that decides what runs. Governance bounds what an agent may
do; the soul is why it does not sound like a robot while doing it.

| | |
|---|---|
| Index | [5.8](../../../README.md#5--agents) · Slice **S-TBD** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🟡 / — / ✅ |
| Related | [author-an-agent](author-an-agent.md) · [the answer, in words](../../ask/features/the-answer-in-words.md) · [ask in natural language](../../ask/features/ask-in-natural-language.md) · act as |

Product spec: [AG-F01 · Build an agent](../../../../../specs/capabilities/agents/features/AG-F01-build-an-agent/feature.md) — AG-29; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Components |
|---|---|---|
| The agent's page › **Soul** tab | One of five tabs, beside Overview · Skills & callables · Thinking · Activity ([AG23](author-an-agent.md#decisions)): the four dials, then the Markdown editor with the default voice as its placeholder, the character count, *version · edited* under it; Discard · Save in the page header while the tab has edits | `@invana/editor` `MarkdownEditorBlock` · `SegmentedControl` · `PropertyList` |
| Preview | An editable sample ask and **Preview** on the tab, answered twice — current voice above, draft below | `EmissionCard` with a `prose` body, twice |
| Agents drawer row | Nothing new — a soul is not a status | — |

## Engine

| Thing | Shape |
|---|---|
| `agents.soul` | `Text`, default `""`. Empty means the default voice |
| Default voice | One constant in `apps/llm/voice.py`, owned by the product |
| Prompt assembly | `voice_for(soul, soul_traits)` — `render_traits(soul_traits)` then `soul or DEFAULT_VOICE` — is prepended to the system prompt of every step in *What reads the soul*; `RunVars.soul` carries it, read once at run open. Understand is the one such step the runtime runs today; Answer takes it when [3.12](../../ask/features/the-answer-in-words.md) ships. Translate, Plan, Validate and Execute have no parameter for it |
| The dials | `apps/llm/voice.py` owns their vocabulary; `check_traits` refuses an unknown key or value at write, naming it |
| Agent instructions | `agents.instructions` layered after `graphs.instructions` into Understand and Translate |
| Versioning | An edit bumps `agents.version`; `task_runs.agent_version` records which soul a run spoke with |
| Routes | `AgentRead.soul` · `soul_traits` · `AgentUpdate.soul` (read by set-ness; `""` clears to the default voice) · `POST …/agents/{id}/soul/preview` with `{ask, soul, soul_traits}` → `{ask, current, draft, model}` ([SO8](#decisions)) |
| A spawned child | `soul` and `soul_traits` copied from its parent at spawn |
| Events | `agent.soul_set` |

## Decisions

| # | Decision |
|---|---|
| SO1 | **A soul is a Markdown field on the agent, not a skill and not a stance.** A skill is offered where it is bound and reported as applied — character is neither optional nor a claim to cite. A stance is a method whose value is its declared assumptions (AA5). The soul is who the agent is, so it lives on the agent. |
| SO7 | **The soul is a tab on the agent's page, not a field on its form.** It sits beside Overview · Skills & callables · Thinking · Activity because it is authored and versioned on its own, and a paragraph of Markdown does not fit a form row. The preview answers a sample ask the author can change, since a voice is judged on the questions this agent actually gets. |
