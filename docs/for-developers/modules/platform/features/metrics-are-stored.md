# Metrics are stored, not derived

System design: [architecture.md](../../../../../specs/system-design/architecture.md) — the stored columns, the fields served, the rules and what is not built (§ Metrics are stored). This file keeps the build phases and their Studio sites.

## Phases

The audit found about 90 derived metrics across Studio. Each phase is one change set.

| # | Phase | Engine | Studio | Status |
|---|---|---|---|---|
| 1 | Durations | MS1–MS4 columns, backfill, API fields; plan performance and fleet read the columns | Delete `totalDuration` · `durationMs`; `stepDuration` · `elapsedOf` keep only the live clock; the simulation reads `duration_ms` | ✅ |
| 2 | Totals the API already returns | — | The list `total` on the run journal, sessions, projects, todos, decisions, skills, plans and LLM endpoints | ✅ |
| 3 | Tokens | MS9–MS10: `tokens` on every row, the root's roll-up, backfill; `tokens`/`tokens_per_run` on change effects, touches and activity nodes; a step's share of the run's tokens | Every `tokens_in + tokens_out` reads `tokens`; the step board reads `share_of_run_tokens`; the change history reads `tokens_per_run`; the Todos thread reads the run's stored spend | ✅ |
| 4 | Changes, rates, shares | One `Change` shape (`by` · `unit` ratio or points · `direction` · `tone`) from `core/metrics.py`, on fleet and performance measures, eval draft-vs-live, plan-version p95 with its `prior_version`, model growth; rates and shares (`applied_rate`, `error_rate`, `caller_share`, `per_day`); classifications (`wide` · `rare` · `slow`); the totals and counts those endpoints already held (drift, draft added/changed/removed, compare, lens rules and people, skill offered/applied, `prompt_chars`) | Delete `relChange` · `arrowPct` · the flat threshold · `readsAs` math · `versus` math · `WIDE_SPREAD`/`RARE_BRANCH` · `callerSplit` math · `grewBy` math · the drift and draft counts; `Change` is one type in `@invana-studio/core` | ✅ |
| 5 | Aggregates Studio builds from partial data | **Shipped:** `runs/stats` per Graph and across the reader's Graphs — the Runs board tiles and the journal's live count, the Imports counts, median time and imports a day ([SR77](../../operate/features/see-what-ran.md#decisions)); the journal's `total` is a count (SR78); the run read's `steps_done`/`steps_total` (SR79); `run_tokens` on every finished-step frame ([SW5](../../ask/features/streaming-and-the-workflow.md#decisions)). Counts of a subset beside `total` — todos `by_status`, decisions `current`, plans `packaged`, agents `persistent`/`ephemeral` — and the Graph's `total_nodes`/`total_edges` on the type counts, which hiding a type does not change. The Validation queue and its totals (`GET /api/v1/datasets/validation`), provenance exceptions counted over the whole version, a dataset's `lowest_score` and a standard's claims (`GET /api/v1/datasets/claims`); a project's counts in one `…/projects/{key}/summary`; a run's touches classified and tallied per participant and layer; a change compare's `tokens_per_run_change`. The Models page's records read Growth's stored counts and its model and type counts read the insights `catalog` ([MP44](../../connect-and-model/features/the-model-page.md#decisions)). **Still open:** Impact reach (and its *person-reviewed* count) | Read them | 🟡 — each open endpoint is designed in its own feature file first |

| 6 | Fleet and Performance | The Fleet overview's tiles, attention list, runs a day and recent changes, and every Performance tab's rows, trend and marks, served by `agents/overview` and `agents/performance` from the stored columns | Formats them; what it still computes is a meter's fill, a chart's scale and ticks, and the count of the fully shown *Needs attention* list (MS8) | ✅ |
| 7 | List totals | Every Agents list answers `total` and `unfiltered_total` as counts ([list-contract](list-contract.md)) | *N of M match* reads the two counts | ✅ |

### Phase 1 sites

| Studio | Replaced by |
|---|---|
| `assistant/SessionSteps.tsx` `stepDuration` · `StepTrace` | step `duration_ms` |
| `assistant/SessionSteps.tsx` `totalDuration` · `SessionTurn.tsx` meta line | message `work_ms` |
| `projects/TodosSection.tsx` *Ask for …* | run `work_ms` |
| `shell/activity/runs/RunsList.tsx` `elapsedOf` · `RunsBoardPage` Elapsed column | `TaskRunSummary.duration_ms` |
| `shell/activity/runs/boards/runBoards.ts` `durationMs` fallbacks · `offsetOf` | `duration_ms` · `offset_ms` |
| `shell/activity/runs/runSummary.ts` work · asking · waiting | `work_ms` · `ask_ms` · `wait_ms` |
| `shell/activity/runs/boards/stepBoardSpec.ts` *% of the run* | `share_of_run` |
| `shell/activity/runs/boards/taskFlowFromRun.ts` | step `duration_ms` |
| `datasets/imports/ImportsPage.tsx` Elapsed column | run `duration_ms` |
| `projects/simulation/specForm.ts` | `SimulationRead.duration_ms` |
