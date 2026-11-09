# Watch the fleet

What broke, what waits on a person, what slowed down and what changed — across every agent, skill,
plan and model of a Graph — with speed, success and tokens against each one's own baseline, and a
degradation named the day it ships.

| | |
|---|---|
| Index | [5.10](../../../README.md#5--agents) · Slice **C10** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [envelope-and-budget](envelope-and-budget.md) · [pinned-model-versions](pinned-model-versions.md) · [change-log](../../operate/features/change-log.md) |

Product spec: [AG-F03 · Runs and how the agents are doing](../../../../../specs/capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md) — AG-17, AG-22 and AG-28; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape, and who pins a model until RT-F01 is written.

## Capabilities

| # | Capability | Notes |
|---|---|---|

## Surfaces

| Surface | Shape |
|---|---|

## Engine

| Route | Returns |
|---|---|
| `GET …/agents/overview` | `FleetOverview` — `agents` · `skills` · `tiles` · `attention[]` · `daily[]` (30) · `changes[]` (≤ 5) |
| `GET …/agents/performance?window=7d\|30d\|90d` | `FleetPerformance` — `window_days` · `tiles` · `agents[]` · `skills[]` · `plans[]` · `models[]` · `trend` |
| `GET …/llm/pins` | `ModelPins` — `items[]`: `address` · `agents[]` · `skills[]` · `judges[]` |

| Shape | Fields |
|---|---|
| `Change` | `by` · `unit` (`ratio` · `points`) · `direction` (`up` · `down` · `flat`) · `tone` (`better` · `worse` · `neutral`) |
| `FleetMeasure` | `value` · `prior` · `change` (`Change` or null) |
| `OverviewTiles` | `runs_today` · `runs_week_ago` · `runs_change` (`Change` or null) · `failed_today` · `failed_latest` · `waiting` · `waiting_latest` · `p95_ms` (`FleetMeasure`) · `tokens_this_month` · `max_tokens_month` · `success` |
| `AttentionItem` | `kind` (`failing` · `waiting` · `degraded`) · `title` · `detail` · `run_id` · `approval_id` · `agent_id` · `at` |
| `DayCount` | `date` · `succeeded` · `failed` |
| `RecentChange` | `record_kind` (`agent` · `skill`) · `record_id` · `name` · `version` · `previous` · `at` · `actor_name` · `summary` · `runs` · `failed` · `p95_change` (`Change` or null) |
| `FleetTiles` | `success` · `p50_ms` · `p95_ms` · `runs` · `tokens_per_run` (each `FleetMeasure`) · `degraded` · `failing` |
| `PerformanceRow` | `id` · `name` · `version` · `runs` · `success` · `p50_ms` · `p95_ms` · `p95_prior_ms` · `p95_change` (`Change` or null) · `prior_version` · `tokens_per_run` · `tokens_per_run_prior` · `failing` · `signal` (`degraded` · `failing` · null) · `degradation` |
| `Degradation` | `p95_ms` · `baseline_p95_ms` · `since` · `change` (`RecentChange` or null) |
| `PerformanceTrend` | `subject_kind` · `subject_id` · `name` · `baseline_p95_ms` · `points[]` (`date` · `p95_ms`) · `marks[]` (`date` · `label`) |
| `ModelPin` | `address` · `agents[]` (`id` · `name`) · `skills[]` (`id` · `name` · `version`) · `judges[]` (`subject_kind` · `subject_id` · `name`) |

## Decisions

Engine rows, and the pages' old placement; the product decisions are AG-F03's.

| # | Decision |
|---|---|
| FP17 | **The dashboard is the Agent Builder's Overview, and LLMs are Settings › LLM providers.** Overview reads every agent version across Graphs from stored per-run columns; a Graph's own numbers are Graph settings › Usage and Activity › Runs ([5.16](install-wide-agents-and-skills.md) C11, WD19) |
| FP1 | **Computed at read, from the run rows.** No counter, no rollup table: the numbers come from `task_runs` roots in the window, the way the plan page's are, so they cannot disagree with the runs they count. Percentiles are computed in Python — SQLite has none, and dev and prod must agree. |
| FP2 | **A run is a root.** Steps never count as runs; a root's tokens are its own and its direct steps', with eval runs (`role = evaluate`) left out, as the agent meters count them. |
| FP7 | **Subjects.** An agent is `task_runs.agent_id`; a skill is each skill version id in `skills_applied` on the root or its direct steps (the union), at the version the run applied; a plan is one row per ref `key@version` — the Flow's key, else `plan_origin` `template:<ref>`, and a keyless one-off plan is absent; a model is `task_runs.model_version` on the root or its steps. A run with none of one is absent from that table, not filed under *unknown*. |
| FP9 | **Waiting on a person** is pending approvals plus roots paused on a question (`needs_input` · `awaiting_input`), among the roots of the last 90 days — the window the page loads; *Changed recently*'s p95 change reads the same 90 days. |
| FP10 | **The month budget on Overview is the sum of the agents' `max_tokens_month`.** Null when no agent declares one — *no month budget*, never zero. Budgets are declared, not enforced ([EB7](envelope-and-budget.md#decisions)). |
| FP13 | **Overview, Performance and LLMs are pages, not panels.** Their rail items open no `leftSection`; the page fills `mainSection` in place of the Workbook, as an expanded Settings does. The Workbook's pages come back with the next rail item that has a panel. |
| FP15 | **The LLMs page is the endpoint list.** The Agents panel is one section — agents; LLMs is a rail item and a page of its own. An endpoint's detail and the new-endpoint form open in a sheet over the page, at `/agents/llms/<provider>` and `/agents/llms/new`. |
