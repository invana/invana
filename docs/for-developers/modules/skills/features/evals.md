# Evals

Each skill and agent keeps an eval set — fixed questions with the traits a good answer must have. The
set replays against live and draft before anything publishes, re-runs when something it depends on
changes and nightly, and spends its own token budget.

| | |
|---|---|
| Index | [6.6](../../../README.md#6--skills) · Slice **B02** (P-15) |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | ✅ / 🟡 / ✅ |
| Related | [instructions-publish-rollback](instructions-publish-rollback.md) · [pinned-model-versions](../../agents/features/pinned-model-versions.md) · [change-log](../../operate/features/change-log.md) · [schedules](../../operate/features/schedules.md) · products: agents.md AG-08 · AG-15 |

Product spec: [AG-F04 · Skills](../../../../../specs/capabilities/agents/features/AG-F04-skills/feature.md) — AG-20; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

| Surface | Shape |
|---|---|
| CLI | `invana evals list` · `run [--draft] [--version N] [--pin <address>]` · `promote <run> --as passing\|failing` · `drift [--trigger]`, each `--graph` and `--skill`/`--agent`. A run is worked in the CLI's own process and scored before it returns; `run` exits 1 when the gate blocks and 3 when it warns |

## Engine

| Table | Columns |
|---|---|
| `eval_sets` | `id` · `graph_id` · `subject_kind` (`skill` · `agent`) · `subject_id` · `judge_model_pin` (address, nullable) · `rubric` (Text, nullable) · `created_at` — unique on (`subject_kind`, `subject_id`) |
| `eval_cases` | `id` · `eval_set_id` · `question` · `checks` (JSON list of `{kind, value}`) · `label` (`passing` · `failing`) · `status` (`proposed` · `active` · `retired`) · `source_run_id` (nullable) · `created_by_id` · `created_at` |
| `eval_results` | `id` · `eval_run_id` (FK `task_runs`) · `eval_case_id` · `side` (`live` · `draft`) · `hard` (JSON `{check: pass\|fail}`) · `judged` (Float, nullable) · `tokens` · `latency_ms` · `answer_digest` |
| `eval_budgets` | `graph_id` (PK) · `monthly_tokens` (nullable = no ceiling) |

| An eval run | Is |
|---|---|
| Its record | A root `TaskRun` `role=evaluate`, `flow_key=eval`, `triggered_by` `user` (publish, manual) or `system` (drift, nightly), `params.trigger` naming why |
| Its children | One replayed ask per case and side, `parent_run_id` the eval run; their tokens count on the eval budget, never on production |
| Its candidate | `params.candidate` — `draft`, a `version` (a rollback) or a `model_pin` (an agent's pin move) — and `params.candidate_digest`, the sha256 of the candidate's text and pin |
| Its summary | `result.eval` — per side: hard passed / total, p95 ms, tokens, tokens per case, judged mean; changed answers; `versus_live` (the draft's `p95_ms` and `tokens_per_case` against live, each a `Change`, null on a one-side run); the gate's verdict (`clean` · `warn` · `blocked`) with its reasons |

| Check `kind` | Passes when |
|---|---|
| `cites_records` | the answer cites at least one record |
| `names_world` | the run froze the world named in `value` — *Everything* when it froze none — so the answer's header names that world |
| `cannot_answer` | the run's outcome is `cannot_answer` |
| `guardrail_holds` | no refusal was overridden and no denied layer was read |
| `expected_records` | every id in `value` appears as a record `id` in the run's emissions |
| `max_tokens` | tokens ≤ `value` |
| `max_latency_ms` | latency ≤ `value` |

| Route | Does |
|---|---|
| `GET\|PUT …/evals/{subject_kind}/{subject_id}` | The set — judge pin, rubric |
| `POST\|PATCH\|DELETE …/evals/{subject_kind}/{subject_id}/cases[/{case_id}]` | Cases; `PATCH` accepts a proposed case |
| `POST …/evals/{subject_kind}/{subject_id}/runs` `{side: draft\|live\|both}` | An eval run — 202 |
| `POST …/evals/{subject_kind}/{subject_id}/propose` | The assistant's starter set, written as `proposed` cases — 201 |
| `GET …/evals/{subject_kind}/{subject_id}/runs[/{run_id}]` | Runs and their results |
| `POST …/evals/promote` `{run_id, subject_kind, subject_id, label}` | A case from a real ask |
| `GET\|PUT …/evals/budget` | The Graph's monthly eval tokens and what is spent |
| `POST …/evals/drift` `{trigger}` | The drift pass over every live set — what `invana evals drift` and the nightly schedule call |

## Decisions

Engine rows, and rows that stay until they are settled; the product decisions are AG-F04's.

| # | Decision |
|---|---|
| EL1 | **An eval run is a `TaskRun` with `role=evaluate`**, its cases replayed as child runs — the same machinery, trace and token count as any run. Only the per-case verdicts need a table, `eval_results`. |
| EL2 | **Hard checks are rule checks, counted from the run's own record** — citations, outcome, lens, tokens, latency. Nothing hard asks a model. |
| EL7 | **Drift runs re-run the live version** when its model pin or cast changes, the Graph's model publishes, or a world bound to it changes, and nightly. The nightly pass is a shared schedule when [10.1](../../operate/features/schedules.md) exists; until then `invana evals drift` runs the same pass for an external cron. |
| EL8 | **Degradation is an event**, `eval.degraded`, naming the eval run, the trigger and the numbers, so it lands in Activity and Performance without a second store. |
| EL10 | **The gate reads a settled eval run over the exact candidate.** Publish, rollback and an agent's pin move each name a candidate — the draft, the version rolled back to, the new pin — and the gate looks for the newest settled eval run whose `candidate_digest` is that candidate's. None, while the set has active cases, refuses `409 eval_required`; a set with no active case passes and says *nothing checked*. An eval run never runs inside the publish request: replays take minutes, and the request would hold them. |
| EL11 | **A skill's eval runs with no agent; an agent's runs as the agent.** A skill case replays as an ask offered every published skill of the Graph, the subject's text swapped for the candidate's and the candidate's pin resolved first. An agent case replays as that agent, its draft instructions in place of its instructions and the candidate pin first. Neither writes a session or a reply. |
| EL12 | **The drift pass is one call**, `POST …/evals/drift {trigger}`: a live eval run for every set with active cases. The nightly schedule, `invana evals drift`, a Graph model publishing and a guardrail or world changing all call it; an agent's pin move needs no drift run, because the gate already replayed the new pin. A drift run is compared with the subject's last settled live run; `eval.degraded` fires on fewer hard passes, or p95 or tokens past 1.5× that run. |
| EL13 | **The judge reads a written answer.** The answer handed to the judge is the run's emissions as text — prose verbatim, a table's first rows, a subgraph's counts — capped at 4,000 characters; it scores 0–5 against the rubric. Its tokens are the eval run's own and count on the eval budget. |
| EL14 | **The starter set is one model call, and every case it writes waits.** `POST …/propose` hands the subject's text — its draft when one is open, else what is live — to the subject's own pinned model (the Graph's decide model when it has no pin), which writes up to five questions, each with rule checks it can state without the graph (`cites_records`, `cannot_answer`, `guardrail_holds`). Every case lands `proposed`, created by the person who asked; the exact model version is on each case's `eval_case.create` event. It is not an eval run, so it is not on the eval budget. |
| EL15 | **Studio draws the gate's answer, never predicts it.** A publish, a restore or a pin move goes to the engine as it is; a `409` whose `detail.error` is `eval_required` · `eval_running` · `eval_failed` · `eval_warned` is drawn as a refusal card, with *Run the evals* on `eval_required`. The evals view is a mode of the skill's Instructions tab, not a tab of its own (agents.md › Decisions *Skill evals*). |
| EL16 | **The draft's change against live is written into the summary when the run settles.** `score` stores each side's `tokens_per_case` (tokens over cases, rounded) and `versus_live` — the draft's p95 and tokens per case against live, read by the same `Change` helper as Performance ([FP17](../../agents/features/fleet-performance.md#decisions)): a ratio, `flat` within ±2%, up reading `worse`. Studio prints `▲ 11% vs live` · `same as live` from it and never divides; a run with one side carries `versus_live: null` and says *no live side* or *live only*. |
