# Runs and the run page

Every run in a Graph is listed in one place — **Activity › Runs** — and read on one page, the same for one
agent, nine or seven hundred: **Overview · Agents · Stages · Assets · Data touched · Ledger**. A run can
be rerun as it was, on today's versions, or retuned.

| | |
|---|---|
| Index | [5.14](../../../README.md#5--agents) · Slice **F05** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [see-what-ran](../../operate/features/see-what-ran.md) (the journal's records and the step drill-in) · [delegation](delegation.md) (escrow, ceilings, exit reasons) · [approvals](../../operate/features/approvals.md) · [the-ledger](../../operate/features/the-ledger.md) · [the-agent-page](the-agent-page.md) · [list-contract](../../platform/features/list-contract.md) |

Product spec: [AG-F03 · Runs and how the agents are doing](../../../../../specs/products/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md) — AG-23, AG-25, AG-27, AG-32, AG-41 and AG-43; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `activity.runs` | `/agents/runs` — `SectionPage` *Runs* with the five tiles (`MetricTile`), `SegmentedControl` `All · Live · Waiting · Ended` (`?f.state=`), three `FilterSelect` chips (`?f.agent_id=` · `?f.started_by=` · `?f.origin=`), each showing its value or *any*, the strip, a kit `Table`. A row opens `?page=run:<id>` as a workbook tab titled `Run #N` |
| `activity.runs.filtered` | the list the assistant opened (`&via=assistant`): the head reads *N of M runs match*, then the strip with its chips marked *set by the assistant*, then the table — no tiles, no filter row. Removing a chip drops `via` and the full list returns |
| `agents.run.*` | `?page=run:<id>&tab=overview|agents|stages|assets|touched|ledger` — `RecordHeader variant="page"` with the crumb `Runs`, then `Tabs` |
| `activity.run.step` | `&tab=stages&step=<step run id>` — the step panel under the stage canvas; `&lane=all` for every lane |
| `activity.run.rerun` | the Rerun `Dialog` over the run page (`&rerun=1`) |
| `agents.run.many*` | the same page for a run past 50 agents; `&view=role` on Agents for *By role* |
| Activity › Runs | the shell's journal; a row opens the run page in Agents |

## Engine

| Thing | Shape |
|---|---|
| `task_runs.number` | a per-Graph number for a root run, `1, 2, 3…`, unique with `graph_id`; set when the run is created. Steps and child runs carry none |
| `task_runs.exit_reason` | why a run ended, set when it settles: `served · cannot_answer · budget_declined · time_limit · step_limit · no_progress · loop · parent_ended · stopped · failed` |
| `task_runs.escrow_tokens` · `escrow_returned` | on a child run: tokens moved from its parent's remaining budget, and what went back when it ended ([delegation](delegation.md)) |
| `GET …/runs` | `Page[TaskRunSummary]`; items add `number` · `agent_name` · `origin` · `started_by_name` · `agents` · `exit_reason`. Filters add `state` (`live · waiting · ended`) and `exit_reason` (a reason, or `not_served` for every ended run that did not serve) |
| `GET …/runs/stats` | adds `served` · `not_served` · `not_served_by_reason {reason: n}` · `served_share` · `waiting_approvals` over the window, and `largest_live_run_id` · `largest_live_agents` standing now |
| `GET …/runs/{id}/overview` | `RunOverview` — head, tiles, `agents_over_time[]`, `steps_per_minute[]`, `waiting[]`, and for a large run `finished_per_minute[]` · `live_over_time[]` · `live_limit` · `eta_s` · `by_role[]` |
| `GET …/runs/{id}/agents` | `RunAgents` — `nodes[]` (run id, parent, agent, role, depth, status, exit reason, tokens, escrow, state words), `asks[]` (pending delegation), `roles[]` |
| `GET …/runs/{id}/stages` | `RunStages` — `stages[]` in plan order: function, status, calls, lanes, duration, p95, tokens, `in_count`, `out_count`, `line`, `step_ids[]` |
| `GET …/runs/{id}/assets` | `RunAssets` — `items[]`: name, kind, produced by, size, where, `step_run_id` |
| `GET …/runs/{id}/touched` | `RunTouched` — `graph[]` · `web[]` · `llm[]` · `secrets[]` |
| `POST …/runs/{id}/rerun` | `versions: same · current · retune`; a retune takes `agent_version` · `model_version` · `max_tokens_run` · `lens_id` |
| `POST …/runs/{id}/cancel` | Stop run |

## Decisions

Engine and Studio rows; the product decisions are AG-F03's.

| # | Decision |
|---|---|
| RP4 | **`state` groups statuses for the list's tabs.** `live` is queued or running, `waiting` is held on a person (`awaiting_input` · `needs_input` — a question, or a step held on an approval), `ended` is every terminal status. |
| RP10 | **Stages are the plan's functions in order, each stage the steps of one step key.** Counts on an edge are the stage's `out_count`, the rows or items its steps returned. The stages read as one row left to right; a long plan pans rather than wrapping. |
| RP15 | **A run's workbook tab is titled `Run #N`**, with the run icon; the uuid stands in only until the number is read. The assistant's pill reads the same title |
| RP16 | **The Agents Tree and the Stages canvas draw cards**, not circles: an agent card carries its state line and its tokens against its escrow; a stage card carries its function, calls, lanes and time. Both canvases carry the board's view chip and its zoom · fit · lock controls. An agent card prints its tokens against its escrow as text — a canvas card has no meter element — and neither canvas draws a minimap |
| RP19 | **A link to a step opens its run on Stages with that step under the canvas**; a link that names a tab keeps it |
