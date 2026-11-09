# Clarifying questions

When *Understand* cannot settle what is being asked, it asks back — as a closed question with grounded
options, not a request for another paragraph.

> ⚠ **Rewritten for orchestration § 0** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> task-model-migration.md.

| | |
|---|---|
| Index | [3.6](../../../README.md#3--ask) · Slice **S9c** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [projections](projections.md) (how it is asked) · when-it-cannot-answer |

Product spec: [EX-F03 · Ask a question](../../../../../specs/capabilities/explore/features/EX-F03-ask-a-question/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Thread | `ClarifyCard variant="inline"` in the reply: the question, its options as rows (a heading, and a description only where one was written), *Something else — let me type*. Once answered it folds to `Answered · <choice>` and opens to the question with the options not taken dimmed |
| Task | `needs_input` with the question on the task itself |
| Review | Questions sit first in the queue — they block a run |

## Engine

| Thing | Shape |
|---|---|
| `task_prompts` | `run_id` · `step_seq` · `template_id` · `value` · `answered_by` |
| Parking | the run suspends with its context; answering resumes it |
| Routes | `POST …/task_runs/{id}/answer` |
| Option descriptions | `option_descriptions` beside `options` on the Understand and Translate tool calls — one per option, `""` where the label says enough; kept on `session_messages.clarification_descriptions` (null when none says more) and on `clarification.requested` |
| Events | `clarification.requested · answered` |

## Decisions

| # | Decision |
|---|---|
| CQ8 | **Understanding is a loop, not one question.** `understand` runs under `loop: {until: understood, max_iterations: n}` — it may ask, be answered, and ask again when the answer opened a new ambiguity. Every round is an **iteration of the same run**, not a new run and not a new Task: the thread reads as one exchange and the trace stays one row with three iterations under it (orchestration § 6). |
| CQ9 | **The loop is bounded by the envelope, and the bound is `max_clarifications`.** Hitting it is not a failure: the run states what it still does not know and answers on the reading it can defend, or parks for a person (when-it-cannot-answer). An unbounded clarifier is a way to spend a person's attention without a ceiling. |
| CQ11 | **The options are read under the run's lens.** When the model grounds its choices in the graph, the `options_query` it wrote crosses `graph_data` like any other read the run makes — the run's own lens is composed into it and the read is recorded as a touch — so a world that excludes a carrier never offers it as a choice. A refusal, a lens violation or a failed query falls back to the fixed options: the question still stands, its choices are only less grounded. |

