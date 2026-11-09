# Ask — module spec

A question becomes a run, the run becomes steps, and the steps produce things a person can read.
Everything here is grounded: an answer states only what the graph holds, and says so when it holds
nothing.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [§3 · Ask](../../README.md#3--ask) |
| Features | [write-queries](features/write-queries.md) · [ask-in-natural-language](features/ask-in-natural-language.md) · [the-answer-surface](features/the-answer-surface.md) · [projections](features/projections.md) · [streaming-and-the-workflow](features/streaming-and-the-workflow.md) · [clarifying-questions](features/clarifying-questions.md) · [reasoning-trace](features/reasoning-trace.md) · when-it-cannot-answer · [the-assistant](features/the-assistant.md) · [runtime-and-adapters](features/runtime-and-adapters.md) · fork-a-session |
| Depends on | [Agents](../agents/spec.md) (a run is executed through an agent) · Connect and model (the global model is the grounding context) |
| Depended on by | [Work](../work/spec.md) (a task runs as a run) · Explore · Operate |
| Owns the surface | [the-assistant](features/the-assistant.md) — the one place a question is asked, on every left panel of the graph page. It is Ask's surface, not Explore's |

System design: [ask.md](../../../../specs/system-design/modules/ask.md) — the pipeline, how a run comes together, grounding in the engine and the runtime shape (§§ 2 · 3 · 4 · 6). This file keeps the vocabulary, what the module owns, its decisions, the drawn states and the retired single-runtime rows of § 6.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Ask-kind** | how the question was posed: `NL` or `QL` | a mode the user configures per session |
| **Emission** | one thing a step produced, of a declared kind | the answer |
| **Projection** | the declared mapping from a shape to a surface — in either direction | styling |

## 5. What this module owns

| Owns | Shape |
|---|---|
| `todos` | `kind (nl\|ql\|import\|stitch\|enrich)` — `nl` and `ql` are both *ask* to a reader · the intent · who asked · on behalf of whom |
| `task_runs` | one run of a todo · `triggered_by (user\|task\|schedule\|delegation)` · `parent_run_id?` · `task_id?` · agent · plan · status · outcome |
| `task_runs` | step key · state · timings · tokens · skills offered / reported · rules cited |
| `sessions` | `agent_id` · **`lens_id?`** — the default world · **`max_tokens_run?`** — the default tokens per run ([AS5](#7b-a-session-executes-through-plans-always)) · title · surface |
| `emissions` | `run_id` · `seq` · `kind` · payload · `template_id?` · source citation |
| `projection_templates` · `task_prompts` | [projections](features/projections.md) |

Ask owns these tables; it does not own the journal over them. Every run in the Graph is listed by **Runs** ([10.5](../operate/features/see-what-ran.md)), and Imports is that journal filtered to `kind in (import, bulk)`.

## 6. The runtime shape

Stays here, retired — steps now travel as `TaskEnvelope`s from the coordinator to in-process or remote workers:

| Rule | Detail |
|---|---|
| Not one dispatch per step | Driving task-by-task from the engine would multiply latency by the step count and put loop state on the wire |
| Step granularity is reported, not orchestrated | The worker says what happened; the orchestrator sees one unit of work |

**No external infrastructure, at all.** The in-process runtime is what ships and the only one that
exists. The protocol around it is the seam where a deployment could put a scheduler it already
operates — that has not been written, and nothing waits on it.

| Rule | Detail |
|---|---|
| One runtime exists | In-process, persisting to the app database; zero external dependencies |


## 7. Cross-feature decisions

| # | Decision |
|---|---|
| K1 | One question opens exactly one root run. A session is a thread of them, not a run. |
| K2 | **The lens's `cast` names the model; the composer offers the ask kind and the world, never a model.** The agent carries no provider and no world ([A1](../agents/spec.md)); the world chip in the composer is where a person changes what a question runs against ([WO5](../govern/features/worlds.md#decisions)). |
| K3 | Steps stream. Nothing waits for the end of the run to appear. |
| K4 | Validation failure is repaired **once**, with the error, then reported. |
| K5 | A structured question gets a structured answer — a value, not prose ([projections](features/projections.md)). |
| K6 | An emission's rendering is chosen by a projection template, never authored by the model. |
| K7 | The four reader-facing states — the answer surface, the projection switch, the clarification, the diagnosis — are drawn before they are built. They are the one place Studio leads the engine, because [13.1](../platform/features/design-system.md) blocks on the components they name. |
| K8 | An emission header — kind · template · citation — is the same component wherever an emission appears: the thread, a task result, a scheduled answer. |
| K9 | A stream frame is not an emission. The stream carries **todo frames** — `step.*`, `diagnosis`, an emission arriving; an **emission** is the produced answer part a reader sees. Both sides of the wire use the two words that way. |

## 7a. The drawn states

Hi-fi, at 1440×900, on the **Hi-fi · finance** page of the *Agents at Work Wireframes* canvas —
`claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`; the rows named `ask.*` and `settings.*` are on *The Assistant Speaks* canvas — `https://claude.ai/artifact/HdXWfPfwoES9CKTCpQtH5J`.

| Artboard | Feature | Shows |
|---|---|---|
| Explorer · one answer, five kinds | [the-answer-surface](features/the-answer-surface.md) | `metric · table · chart · subgraph · prose` in one answer, each with its header; the empty emission; the subgraph landing on the canvas |
| Explorer · the same records, another projection | [projections](features/projections.md) | the template picker on the emission header; incompatible templates refused with the reason |
| Explorer · Understand asks back | [clarifying-questions](features/clarifying-questions.md) | the closed question in the thread, the parked run, the same run resuming |
| Four ways a run ends · states sheet | when-it-cannot-answer | retry · repair · cannot-answer · diagnosis, four surfaces that never share a shape |
| `ask.converse` | [ask-in-natural-language](features/ask-in-natural-language.md) NL12 | small talk answered as a message in the agent's voice, pointing at something to ask — no emission, no refusal |
| `ask.cannot_answer.voiced` | when-it-cannot-answer CA10 | a cannot-answer in the agent's voice that still names what the graph is missing and offers what it holds |
| `ask.answer.prose` | [the-answer-in-words](features/the-answer-in-words.md) | the prose emission first, each claim with its citation chip; a clicked citation highlights its row in the table below |
| `ask.answer.prose.writing` | [the-answer-in-words](features/the-answer-in-words.md) | the table painted, the Answer step running, *Writing the answer…* above it |
| `ask.answer.prose.skipped` | [the-answer-in-words](features/the-answer-in-words.md) | the world cuts record values: the Answer step dimmed and named, the table alone |
| `ask.answer.prose.failed_soft` | [the-answer-in-words](features/the-answer-in-words.md) | *0 of 3 claims could be cited*: the step failed, the answer stands |
| `ask.answer.third_party` | beyond-the-graph | `nl-outside` run with Search and Fetch; a graph claim cited, an internet claim badged with its link, a model claim badged with its model |
| `ask.answer.third_party.refused` | beyond-the-graph | Search struck through with the guardrail rule named, Fetch not reached, the prose saying it could not look |
| `settings.search_providers.list` | beyond-the-graph | Settings › Search providers: rows with ping state, the provider's address, and the rules that name it |
| `settings.search_providers.list.empty` | beyond-the-graph | no provider: the empty state and the add form, pinged before it saves |

## 7b. A session executes through plans, always

| # | Decision |
|---|---|
| AS1 | **Nothing in a chat reaches a provider, a database or the graph except through a Flow.** A message that asks for something opens a TaskRun; the session records the thread (orchestration § 4.2). There is no chat-only execution path, which is what makes an answer auditable and an envelope enforceable (§ 4.1a). |
| AS2 | **Selection order is: a matched reusable plan · a generated plan.** Both are `Flow` rows; `plan_origin` says which served. A reusable plan is packaged or promoted, never drawn by hand ([7.2](../workflows/features/plan-selection.md) · [6.5](../skills/features/instructions-publish-rollback.md#decisions) IS3) — promoting the plan that answered a question well ([7.4](../workflows/features/promote-a-plan.md)) is how it is answered well, permanently. |
| AS3 | **Understanding is a bounded loop** ([clarifying-questions](features/clarifying-questions.md) CQ8–CQ10): several rounds of clarification are iterations of one run, and the thread shows one exchange. |
| AS4 | **The session is not the unit of governance; the run is.** Budget, lens, envelope and approval all attach to the run — so two asks in one thread can be grounded differently and billed separately, and neither inherits the other's spend. |
| AS5 | **A session carries the default bounds for its asks; the run still freezes them.** `sessions.lens_id` is the world every ask in the thread starts in (null = *Everything*, inside the guardrails) and `sessions.max_tokens_run` its tokens per run, capped by the agent's own `max_tokens_run`. One ask may narrow either for itself. At open, `freeze_lens` composes the ask's world — else the session's — with the agent's standing limits and every guardrail, and the tasks read only that frozen copy, so AS4 holds: two asks in one thread can still be grounded differently ([AG24](../agents/features/author-an-agent.md#decisions) · [AG25](../agents/features/author-an-agent.md#decisions)). |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| Free-form model-authored markup | rendering is a template's job; the model supplies values |
| Answers that mix graph facts with model knowledge | the whole claim is that answers are grounded |
| A second run UI for imports | an import run is a run and uses this one |
| Multi-turn memory inside a run | context is assembled per run, from rules, skills and the graph |
