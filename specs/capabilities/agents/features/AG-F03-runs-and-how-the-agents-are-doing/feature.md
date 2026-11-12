---
id: AG-F03
title: Runs and how the agents are doing
product: AG
status: idea
personas: [builder, analyst, owner, admin]
stories: [AG-17, AG-22, AG-28, AG-23, AG-25, AG-27, AG-32, AG-41, AG-43, AG-45]
journeys: [J04]
boards: [agents, agents.runs, agents.run, agents.run.answer, agents.skill, inbox]
nfrs: [NFR-PERF-3, NFR-COST-2, NFR-OPS-3, NFR-UX-2]
depends_on: [AG-F01]
---

# Runs and how the agents are doing

> Every run in a graph in one list and read one way, at any size — its numbers, who did what, each step's input and
> output, what it produced and touched — and every agent, skill, plan and model version against its own baseline, with
> the change that made it worse named. The decisions it helps make: *does anything need me now, is this agent getting
> worse, and is this run worth re-running, comparing or turning into a better skill?*

## User journey

Journeys this feature is a step of: [J04 · Build an agent and improve it from what runs teach](../../../../journeys/J04-build-an-agent-and-improve-it-from-what-runs-teach.md)

```mermaid
flowchart TD
  start([Agents]) --> dash["AG-17 · Runs: runs today · failed · needs you · tokens against the budget"]
  dash -->|nothing ran yet| empty["What a run is, and that a question, a task or a schedule starts one"]
  dash -->|a run failing| run
  dash -->|an ask waiting| inbox(["Inbox › Needs you"])
  dash -->|an agent got slower| perf
  start --> agent["AG-22 · An agent: its runs, served, p95, tokens today and this month"]
  agent --> perf["AG-28 · How they are doing: agents · skills · plans · model versions over 7, 30 or 90 days"]
  perf -->|too few runs| few["Says there were too few runs, never a flat line"]
  perf -->|degraded| change["The change before the first slow run, opened to compare"]
  perf -->|a figure| list
  dash --> list["AG-23 · Every run, newest first: All · Live · Waiting · Ended, filters shown"]
  list -->|no run matches| none["0 of N runs match · Clear all"]
  list -->|cannot open it| nf["Not listed; a link reads not found"]
  list --> run["AG-23 · A run: numbers, who did what, steps, what it produced and touched, its history"]
  run -->|past 50 agents| big["AG-25 · The same run, grouped by role, with its rates and time left"]
  run -->|an answer from Explore| ans["AG-27 · The answer's run, with its conversation one click away"]
  run -->|Stop run| stop["Stopped · its helpers end, each saying why"]
  run -->|Re-run| rr{"AG-32 · As it was · on today's versions · retuned"}
  rr --> newrun(["A new run with its own number"])
  newrun --> cmp["AG-41 · Compare the two runs"]
  run -->|failed| imp["AG-43 · Improve this skill — a draft with this run as a test"]
  imp -->|cannot build agents| req["Request a change — to the skill's builder"]
  imp --> back(["Back to the run once the fix is published"])
  inb([Inbox › Running]) --> r45["AG-45 · What is running now and what ended today, helpers nested"]
  r45 -->|nothing running| e45["Nothing is running — a question, a load, a task or a schedule starts a run"]
  r45 -->|Stop · their own run or Admin| stop
  r45 -->|open a run| run
  r45 -->|See every run| list
```

```mermaid
sequenceDiagram
  actor P as Person
  participant S as Studio
  participant E as Engine
  P->>S: open a run
  S->>E: the run's numbers, agents, steps, what it touched
  E-->>S: every number as stored · refreshed while it runs
  P->>S: Re-run — retuned
  S->>E: a new run on the chosen versions, view of the graph and budget
  E-->>S: run #N+1 · its own sheet
  P->>S: Compare
  E-->>S: what differs — versions, view of the graph, answer, time, tokens
```

```mermaid
sequenceDiagram
  actor P as Person
  participant S as Studio
  participant E as Engine
  participant A as Agent
  P->>A: asks, loads, assigns a task — a run starts
  E-->>S: the run, live: steps done of total, time, tokens
  S-->>P: Inbox › Running, repainted at most four times a second
  A-->>E: delegates a helper — a child run
  E-->>S: the helper nests under its run
  E-->>S: the run ends — how and why
  S-->>P: it moves to Done, keeping its place in the order
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-17 | [See what needs me across every agent](stories/AG-17-see-what-needs-me-across-every-agent/story.md) | idea |
| AG-22 | [Read how one agent is doing](stories/AG-22-read-how-one-agent-is-doing/story.md) | idea |
| AG-28 | [See what got worse and the change that did it](stories/AG-28-see-what-got-worse-and-the-change-that-did-it/story.md) | idea |
| AG-23 | [Find a run and see where it stands](stories/AG-23-find-a-run-and-see-where-it-stands/story.md) | idea |
| AG-25 | [Read a run of hundreds of agents like any run](stories/AG-25-read-a-run-of-hundreds-of-agents-like-any-run/story.md) | idea |
| AG-27 | [Read an answer's run like any run](stories/AG-27-read-an-answers-run-like-any-run/story.md) | idea |
| AG-32 | [Re-run a run as it was, or retuned](stories/AG-32-re-run-a-run-as-it-was-or-retuned/story.md) | idea |
| AG-41 | [Compare two runs of one question](stories/AG-41-compare-two-runs-of-one-question/story.md) | idea |
| AG-43 | [Turn a failed run into a better skill](stories/AG-43-turn-a-failed-run-into-a-better-skill/story.md) | idea |
| AG-45 | [See what is running and what just ran](stories/AG-45-see-what-is-running-and-what-just-ran/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read Runs, every run, every agent's numbers and how they are doing | Operator — every member of the graph | — |
| Open the conversation behind an answer's run | The person who asked, or anyone it is shared with | The run reads; *Open the conversation* is absent |
| Stop a run | The person who started it — for a run a schedule, a task or an agent started, the person it runs on behalf of · Admin | *Stop run* disabled, naming who started it |
| Re-run a run — as it was, on today's versions, or retuned | The person who started it, or the person it runs on behalf of · Admin | *Re-run* disabled, naming who started it |
| Compare two runs | Operator | — |
| Improve this skill from a run | `builder` · shown as *Can build agents* · Admin | *Request a change* in its place, sent to the skill's builder |
| Answer an ask a run waits on | Whoever the ask is routed to (AC-F05) | The ask reads, with who it waits on |
| Read Running and Done — runs the reader can open | Operator — every member | A run the reader cannot open is not listed |

## States

| State | What the person sees |
|---|---|
| First use | Nothing ran: tiles read `0` or `—`, *Nothing ran in the last 30 days*, and what a run is — a question, a task or a schedule starts one |
| Empty after a filter | *0 of N runs match*, the filters named as chips, *Clear all* |
| Loading | The head and its acts drawn at once; the body loads in place |
| Has data | Tiles against the window before, the runs list, a run's sheet, each agent's and skill's numbers |
| Failed | What could not be read, in the engine's words; a refused act names why |
| Agent working or proposing | A run in flight: *running*, time so far, its agents and steps filling in, refreshed every few seconds |
| No access | A run the person cannot open is not listed and its link reads *not found*; acts they may not take are disabled, naming who may |

## Rules

| Rule | Detail |
|---|---|
| One runs list | Agents › Runs lists every run in the graph; an agent's runs, a person's runs and a schedule's runs are that list, filtered |
| A run has a number | `#2291` is how people quote a run; numbered per graph, never reused; a helper's run and a step carry none |
| Its status is why it ended | Once ended, a run reads its reason: served · cannot answer · out of tokens · out of time · out of steps · no progress · loop · stopped with its parent · stopped · failed. Running reads *running*; held on a person, *waiting* |
| From | Where a run started, in the reader's words: Explore · Task · Schedule · Project · API |
| One run, read one way | The same parts for one agent, nine or seven hundred; past 50 agents the numbers read as rates and agents group by role |
| Cannot-answer is not a failure | Counted on its own, never inside *failed* |
| Run time is what a person waits | From queued to finished; a run still going has none |
| Baselines | A subject's numbers are read against the same window before; degraded is its last 3 runs each slower than 1.5× its 7-day p95, with at least 5 runs in that baseline; failing is 2 or more latest runs failed, and outranks degraded |
| The change named | The newest agent or skill version published inside the baseline before the first slow run; none named when there is none |
| Every figure opens its runs | A tile, a row or a bar opens Runs filtered to what it counts |
| Runs filters | Status · agent · task · kind · where it started · who started it · since (24 hours · 7 · 30 · 90 days) · why it ended (and *not served*) · never promoted · interactive runs shown; the tabs All · Live · Waiting · Ended are the state filter — live is queued or running, waiting is held on a person |
| Too few runs is said | A subject with too few runs reads so, never as a flat line |
| Tokens, never currency | Every tile, meter and row counts tokens ([glossary › Token budget](../../../../glossary.md#what-may-happen)) |
| A number not recorded is `—` | Never `0` |
| The engine counts | Every tile, rate, percentile, change and time left is the engine's; Studio formats them and derives nothing |
| A run nobody can open is absent | It is not listed, and a link to it reads *not found* |
| An ended run holds no asks | Its pending asks close as expired and leave *Needs you* |
| The run sheet acts only to stop | *Stop run* is its one write; re-running makes a new run |
| One journal | There is one record of runs in a Graph. Agents › Runs (AG-23) is the full list; Inbox › Running and Done are readings of it, and Data's import history is the same journal filtered to loads — never a second record |
| Running is not History | A run is what executed — how it ended, what it spent; a History row is what a person or an agent did — who, on whose behalf. Neither is drawn from the other |
| Everything that runs is a run | A question, a typed query, a load, a link between models, an enrichment, a planner and a checker are each a run; a step is never a run of its own in a list |
| Helpers nest | A helper an agent delegated to, or a part a step fanned out, sits under the run that started it, never as a sibling; past the second level it collapses, showing how many it holds |
| A chain shows its worst | A run still going whose helper already failed shows that beside its own status; neither hides the other |
| Tokens add up the chain | A run's tokens include what its helpers spent |
| Interaction is hidden | Expanding a node on a board and a provider check are runs too, hidden unless *Show interactive runs* is on |
| A row leads with what was asked | The question as typed, the query, or the file and the model it loads into — then the agent, how far (*steps 4 of 9*, never a percentage), time so far, tokens |
| Live, but still | A run in flight updates in place and keeps its place in the order; a run that starts while the list is open joins the top; the list repaints at most four times a second |
| Stop is the one act | Running offers *Stop* while a run is going; nothing here retries, edits or re-runs — re-running is where the run was started (AG-32) |
| Leans on | Build an agent (AG-F01) · skills and their tests (AG-F04) · helpers and delegation (AG-F05) · the Inbox (GR-F05 · AC-F06) · the answer and *How it got here* (EX-F04) |

## Data touched

| Record | Read or write |
|---|---|
| Runs — number, agent, origin, who started it, agents used, tokens, time, why it ended | Read |
| A run's steps, helpers, what it produced and what it touched | Read |
| Per-run numbers stored when a run settles — run time, tokens, served | Read |
| Agent, skill and plan versions, with when they were published | Read |
| A re-run — the run it repeats, the versions, view of the graph and budget it used | Write |
| Stop — the run and each helper's reason | Write |
| A skill draft with a run added as a test (AG-F04) | Write |
| History rows of a run (AC-F06) | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `agents_runs` | `graph_id` · `number?` · `parent_run_id?` · `todo_id?` · `plan_id` · `task_id?` (the plan step a child row runs) · `task_key?` (its function) · `step_key?` (its plan step's key) · `agent_id?` · `agent_version` · `model_version` · `lens_id?` · `lens_snapshot` · `role` (`plan` · `execute` · `evaluate`) · `plan_snapshot` · `plan_revision` · `plan_origin` (`template:<key>@<v>` · `generated`) · `triggered_by` (`user` · `schedule` · `task` · `delegation` · `automation` · `canvas` · `mcp` · `system`) · `author_kind` · `author_id` · `on_behalf_of_user_id` · `session_id?` · `lane` · `iteration` · `attempt` · `status` · `outcome` · `exit_reason` · `cursor` · `args` · `input` · `output` · `result` · `error` · `idem_key` · `trace_id` · `queued_at` · `started_at` · `finished_at` · `queue_ms` · `work_ms` · `ask_ms` · `wait_ms` · `duration_ms` · `tokens_in` · `tokens_out` · `run_tokens_in` · `run_tokens_out` · `run_tokens` · `steps_done` · `steps_total` · `replans` · `clarifications` · `escrow_tokens` · `escrow_returned` · `skills_offered[]` · `skills_applied[]` · `rules_offered[]` · `rules_cited[]` · `rerun_of_run_id?` | One table for every run and every step: a root has no `parent_run_id` and a `number` per Graph, never reused; a step, a lane, an iteration and an attempt are rows under it — (`parent_run_id`, `task_id`, `lane`, `iteration`, `attempt`) unique. Every number is written when its fact settles |
| `agents_run_stream` | `seq` (the resume cursor) · `run_id` · `ts` · `frame_type` · `payload` | A run's frames in order, for the live sheet and Running |
| `agents_run_prompts` | `run_id` · `task_id` · `kind` (`clarification` · `approval` · `verdict`) · `question` · `options` · `deadline_s?` · `answered_by_kind?` · `answered_by_id?` · `answer?` · `answered_at?` | A question a run asks and its answer. A verdict may be answered by an agent or a person; an approval only by a person |
| `agents_run_artifacts` | `run_id` · `task_id` · `key` · `media_type` · `size_bytes` · `digest` (sha256) · `uri` | What a run produced, addressed by digest; the run row carries the digest, never the payload |

### Reads

| Record | Owner |
|---|---|
| The agent, its version, budget, effort and limits — where each is enforced and the `budget` ask at a ceiling | [AG-F01](../AG-F01-build-an-agent/feature.md#engine) |
| Plans, their steps and the check; `plan_origin`'s key; a function's `bound` and `layer` | [AG-F06](../AG-F06-plans-and-functions/feature.md#engine) |
| Skill versions and their eval runs (`params` · `result.eval`), left out of every number here | [AG-F04](../AG-F04-skills/feature.md#engine) |
| Helpers, escrow and the caller chain | [AG-F05](../AG-F05-delegation-and-outside-agents/feature.md#engine) |
| The schedule and firing a run opened from | [AG-F07](../AG-F07-schedules/feature.md#engine) |
| The project task a root run carries out, and who closes it | [PJ-F01](../../../projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |
| The view a run opens under, `lens_snapshot` and the touch record *Data touched* reads | [SE-F09](../../../semantics/features/SE-F09-views-of-the-graph/feature.md#engine) |
| Asks a run raises — approval, budget, delegation — and their verdicts | [AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine) |
| History rows of a run | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |
| The queue, its classes, worker groups and pools a step runs in | [RT-F03](../../../../os/runtime/features/RT-F03-workers-and-the-queue/feature.md#engine) |
| Runs at once and the Graph's ceilings | [RT-F04](../../../../os/runtime/features/RT-F04-limits/feature.md#engine) |
| The conversation behind an answer's run | [EX-F03](../../../explore/features/EX-F03-ask-a-question/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/agents` | Does | Story |
|---|---|---|
| `GET /runs` | Root runs only, newest first, by the list contract; `total` counts the roots the filters match. Filters: `status` · `agent_id` · `task_id` · `kind` · `origin` (`Explore` · `Task` · `Schedule` · `Project` · `API`) · `started_by` · `since` (`24h` · `7d` · `30d` · `90d`) · `state` (`live` — queued or running · `waiting` — held on a person · `ended`) · `exit_reason` (and `not_served`) · `candidates` · `interactive` · `plan` · `schedule_id` (through its firings). A row: `id` · `number` · `flow_key` · `status` · `kind` · `body` · `plan_origin` · `plan_revision` · `replans` · `agent_id` · `role` · `triggered_by` · `task_id` · `task_title` · `steps_done` · `steps_total` · `run_tokens` · `queued_at` · `started_at` · `finished_at` · `children` (count, worst status) | AG-23 · AG-45 |
| `GET /runs/stats?days=&tz=&kind=` | `days` · `since` · `live` · `waiting` · `runs` · `succeeded` · `failed` · `cannot_answer` · `tokens` · `spending_runs` · `median_ms` · `slowest {run_id, title, duration_ms}` · `by_day[{day, runs}]` (oldest first, empty days included) · `served` · `not_served` · `not_served_by_reason` · `served_share` · `waiting_approvals` · `largest_live_run_id` · `largest_live_agents` | AG-17 · AG-45 |
| `GET /runs/{id}` | The run — `body` (the question, the query, or the file and target) · its times, tokens, steps done of total · `trace_id` · `agent_version` · `model_version` · `rerun_of_run_id` · its steps | AG-23 |
| `GET /runs/{id}/overview` | `head` · `tiles` · `large` (past 50 agents) · `agents_over_time` · `steps_per_minute` · `waiting`; a large run adds `finished_per_minute` · `live_over_time` · `by_role` · `time_left_s` | AG-23 · AG-25 |
| `GET /runs/{id}/agents` | `origin_label` · `origin_line` · `nodes[{run_id, parent_run_id, agent_id, agent_name, role, depth, status, exit_reason, state_line, tokens, budget, how}]` · `asks` (delegation asks waiting) · `roles` (per role: `agents` · `by_state` · `line` · `cells`) | AG-23 · AG-25 |
| `GET /runs/{id}/stages` | Per plan step: `step_key` · `function` · `layer` · `status` · `calls` · `lanes` · `duration_ms` · `tokens` · `in_count` · `out_count` · `line` · `summary` · `step_ids`; `pruned` | AG-23 |
| `GET /runs/{id}/assets` | What it produced: `name` · `kind` · `produced_by` · `size_line` · `where`, each linking the step, emission or task that made it | AG-23 |
| `GET /runs/{id}/touched` | `graph[{type, read, written, refused, refused_line}]` · `web[{domain, pages, refused}]` · `llm[{model, calls, tokens_in, tokens_out}]` · `secrets[{name, used_by, where}]` · `records_touched` | AG-23 |
| `GET /runs/{id}/trace` | The run — `body` · `ask_kind` · `outcome` · `agent_version` · `plan_origin` · `plan_revision` · `triggered_by` · `trace_id` · `clarifications` · `replans` · times · tokens · `budget` (every ceiling, the run's as frozen) · `result` · `lens_id`; each step — `task_key` · `step_key` · `lane` · `attempt` · `max_attempts` · `args` (bound) · `bound` · `input` · `output` · `result` · `error` · times · tokens · share of the run · skills and rules offered and applied · `child_run_id` | AG-23 · AG-27 |
| `GET /runs/{id}/tasks/{task_key}` | One step: its resolved input, its result document, its artifacts and its log slice | AG-23 |
| `GET /runs/{id}/chain` | A run's descendant count, worst outcome and summed tokens | AG-45 |
| `GET /runs/{id}/stream?after=` | Frames from `seq` on — the live sheet resumes from its last cursor | AG-23 · AG-45 |
| `GET /runs/compare?a=&b=` | What differs — versions, view of the graph, answer, time, tokens | AG-41 |
| `POST /runs/{id}/cancel` | Stop the run; its helpers end *stopped with its parent* | AG-23 · AG-45 |
| `POST /runs/{id}/rerun` | `{versions: same · current · retune, retune?: {agent_version, model_version, max_tokens_run, lens_id}}` → `{run_id, rerun_of_run_id, model_version, stream_url}` | AG-32 |
| `POST /runs/{id}/resume` · `POST /runs/{id}/answer` | Resume after an approval · answer a question the run asked | AG-23 |
| `GET /fleet` | `FleetOverview` | AG-17 |
| `GET /fleet/performance?days=7·30·90` | `FleetPerformance` | AG-28 |
| `GET /fleet/pins` | `ModelPins` | AG-28 |
| `GET /{id}/overview?days=7·30·90` | `{agent_id, days, since, runs, runs_prior, served, served_rate, served_rate_prior, p95_ms, p95_prior_ms, tokens_this_month, max_tokens_month, spawned, daily[{date, runs, tokens}], exits[{exit, runs, last_run_id, last_title}], recent[{id, title, agents, tokens, duration_ms, exit, finished_at}], models[{model_version, first_at, runs, served_rate}]}` | AG-22 |

| Route, install-wide, after `/api/v1` | Does | Story |
|---|---|---|
| `GET /agents/runs/stats` | The same tiles over every Graph the reader is a member of; `days` defaults to 30 | AG-45 |

### Events

| Event | When |
|---|---|
| `agents.runs.open` | A root run is written |
| `agents.runs.finish` | A root run settles, with its `exit_reason` |
| `agents.runs.cancel` · `agents.runs.stop` | A person stops a run · a run ends because its parent stopped |
| `agents.runs.resume` | A run waiting on an approval resumes |
| `agents.runs.rerun` | A re-run opens, naming the run it repeats |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 404 | A run the reader cannot open — a conversation's run by anyone but its author or whom it is shared with | *Not found.* | AG-23.21 · AG-41.6 · AG-45.15 |
| 403 | Stop by anyone but its author, the person it runs on behalf of, or an Admin | *Only {person} or an Admin can stop this run.* | AG-23.20 · AG-23.30 · AG-45.10 |
| 403 | Re-run by anyone but its author, the person it runs on behalf of, or an Admin | *Only {person} or an Admin can re-run this run.* | AG-32.9 · AG-23.30 |
| 409 | `run_live` — a re-run of a run still going | *Re-run is offered once the run ends.* | AG-32.6 |
| 409 | `version_not_offered` — *As it was* with a recorded agent or model version the Graph does not offer, or a retuned version it does not offer | *{version} is not offered in this graph.* | AG-32.7 |
| 409 | `version_not_recorded` — *As it was* on a run that recorded no version | *This run recorded no version — choose Today's versions or Retune.* | AG-32.10 |
| 409 | `not_an_ask` — a re-run of a run that is not a question or a typed query | *Only a question or a query re-runs here — {kind} re-runs where it was started.* | AG-32.11 |
| 422 | `days`, `since` or `window` outside the offered values | *{field}: one of {values}.* | API only — Studio offers the windows |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| Run → run is the only execution record | A task opens root runs — one to plan, one to execute, one to evaluate; a plan step opens child rows, a `map_over` of 200 makes 200; a helper's run is a child root. There is no separate step table |
| Who writes each field | The runtime at open — `plan_snapshot` · `lens_snapshot` · `lane` · `iteration` · `attempt`, never changed after · workers — `status` · `outcome` · `cursor` · tokens · artifacts · stream · a person — an approval's answer · an agent or a person — a verdict's answer. An evaluator writes a verdict and stops; only a person closes a task ([PJ-F01](../../../projects/features/PJ-F01-projects-and-tasks/feature.md#mechanisms)) |
| Frozen on the run | `plan_snapshot` — the plan that ran, so editing a plan never rewrites a past run · `lens_snapshot` — the world it ran against, so publishing a model version never rewrites what an answer meant |
| The result document | `result` on every row, written by the runtime when the row settles, never by the function: `status` · `task_key` · `step_key` · `attempt` (from the second) · `outputs` (only what the function declares) · `artifacts` · `timing` (`started_at` · `finished_at` · `duration_ms`) · `tokens` (`in` · `out`) · `error`; a run's own adds `outcome` and `tasks` — one line per step, never a copy of the step's document. A key with nothing in it is absent; a function missing from the catalogue contributes no outputs |
| Not stored here | A log line goes to telemetry, correlated by `run_id`; an event to the event store ([AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine)); a metric to telemetry |
| Status and exit reason | Running reads `running`; held on a person `waiting` (`awaiting_approval` · `needs_input`); once ended `exit_reason` names why — `served` · `cannot_answer` · `out_of_tokens` · `budget_declined` · `out_of_time` · `step_limit` · `no_progress` · `loop` · `stopped_with_parent` · `stopped` · `refused` · `failed`. *Cannot answer* is never counted inside *failed* |
| Origin | `triggered_by` and the task, schedule or session map to the reader's words — Explore · Task · Schedule · Project · API |
| Who may open, stop, re-run | A conversation's run opens for its author or whom it is shared with; every other run for any member. Stop and re-run: its author; for a run a schedule, a task or an agent started, `on_behalf_of_user_id`; an Admin |
| Budget | The only bound that stops a run without ending it. The effective ceiling is the smallest of the agent's, the plan's and the task's, checked by the runtime between dispatches. At it, dispatch stops and in-flight work finishes — the final count may overshoot by the in-flight set — and a `budget` ask names the tokens spent, the ceiling, which bound and the next step's estimate; the run waits `awaiting_approval`, holding no slot. A run allowance or plan budget is lifted at the pause by anyone who can act in the Graph, recorded on the run; an agent's ceiling only by changing the agent. An extension never exceeds the agent's ceiling; an optional `hard_ceiling` above the budget cancels the run. Partial writes stay — a run is not a transaction; it resumes from its cursor |
| Approvals | An authored `approval` on a step and a raised budget ask wait the same way; an authored one expires at `deadline_s` and fails the run; a budget ask has no deadline unless set |
| A clarification | Parks the run on an `agents_run_prompts` row of `kind = clarification`; the answer resumes the same run at the next iteration, every earlier answer carried forward — one run, one trace |
| Re-run | A new root run with `rerun_of_run_id`, its own number, opened in no conversation so the original reply never changes, its plan drawn afresh. `same` — the recorded `agent_version` and `model_version` · `current` — today's · `retune` — the agent version, model version, run budget and view of the graph named. Only an ended root question or typed query re-runs here |
| Stop | Cancels the run; each helper ends `stopped_with_parent`; its pending asks close as expired; both are History rows |
| Numbers stored at settle | `queue_ms` · `work_ms` (running time of its steps, never waiting) · `ask_ms` · `wait_ms` · `duration_ms` (queued to finished) · tokens for the step and summed for the run including its helpers' · `replans` · `clarifications` · `steps_done` · `steps_total` |
| Time left | Agents still to finish over the last ten minutes' finishing rate; absent when none finished |
| Live | The stream is read from `seq`; Studio repaints at most four times a second; a run in flight keeps its place in the order |
| Interactive runs | A board's expand, a count and a provider check run as runs with `triggered_by` `canvas` or `system`; `interactive=false` hides them by default |
| Fleet overview | `FleetOverview` — `agents` · `skills` · `tiles` (`runs_today` · `runs_week_ago` · `runs_change` · `failed_today` · `failed_latest` · `waiting` · `waiting_latest` · `tokens_this_month` · `max_tokens_month` · `success`) · `attention[]` (`kind` `failing` · `waiting` · `degraded` · `title` · `detail` · `run_id?` · `approval_id?` · `agent_id?` · `at?`) · `daily[]` (30 days, `{date, succeeded, failed}`) · `changes[]` (at most five: `record_kind` agent · skill · `record_id` · `name` · `version` · `previous` · `at` · `actor_name` · `summary` · `runs` · `failed`) |
| Fleet performance | `FleetPerformance` — `window_days` · `tiles {success, runs, tokens_per_run, degraded, failing}` · `agents[]` · `skills[]` · `plans[]` · `models[]` (each `PerformanceRow`: `id` · `name` · `version` · `runs` · `success` · `prior_version` · `tokens_per_run` · `tokens_per_run_prior` · `failing` · `signal` (`degraded` · `failing` · null) · `degradation {since, change}`) · `trend` (`subject_kind` · `subject_id` · `name` · `points[]` · `marks[{date, label}]`) |
| Model pins | `ModelPins` — `items[{address, agents[{id, name}], skills[{id, name, version}], judges[{subject_kind, subject_id, name}]}]` |
| Each subject is identified | An agent by `agent_id` · a skill by each version id in `skills_applied` on the root or its direct steps · a plan by `key@version` — the plan it ran, else `plan_origin`'s key; a one-off plan is absent · a model by `model_version` on the root or its steps. A run with none of a kind is absent from that table, never *unknown* |
| Degraded and failing | Degraded — the last 3 runs each slower than 1.5× the 7-day p95, with at least 5 runs in that baseline · failing — 2 or more latest runs failed, outranking degraded. The change named is the newest agent or skill version published inside the baseline before the first slow run |
| A change | `{by, unit (ratio · points), direction (up · down · flat), tone (better · worse · neutral)}` — flat within ±2% or ±0.1 pt; run time and tokens up are worse, success up is better, counts neutral |
| Windows and percentiles | `days` UTC calendar days ending today (the reader's zone with `tz`); empty days zero; the prior window the same length before it; root runs only, eval runs left out. Percentiles are computed in the engine over stored times, never in SQL, so development and production stores agree |
| Waiting on a person | Pending approvals plus roots paused on a question, among the roots of the last 90 days |
| The month tile | `tokens_this_month` summed over live agents, drafts and retired left out, against the sum of their `max_tokens_month` |
| An agent's overview | `served_rate` — succeeded over settled, null when none settled · `p95` — queued to finished over settled · `recent` — the ten newest whatever the window · `models` grouped by `model_version` with its all-time `first_at` · an exit is the run's `outcome`, else its `status` |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Four tables in Invana's own store; `agents_runs` is the fastest-growing record after telemetry | — |
| § 8 APIs and events | The routes and events above | — |
| § 9 Distributed execution | A run is rows the runtime opens and workers settle; a waiting run holds no slot; a run resumes from its cursor | — |
| § 10 AI and agents | The loop lives outside the model; the budget is checked between dispatches and pauses, never discards | — |
| § 12 Qualities | Privacy: a conversation's run opens only for its author or whom it is shared with | — |

## Decisions

| Decision | Detail |
|---|---|
| Runs opens on what needs you | Tiles — runs today against the same day last week · failed today · needs you · p95 over 7 days · tokens this month against the agents' month budgets · success over 7 days — then *Needs attention*, runs a day over 30 days and what changed recently |
| Needs attention | Failing plans first, then agents, then degraded agents; an agent whose latest failure is a listed plan's run is not listed again; each item has one act that opens where it is answered |
| A run is a sheet | A run opens as a sheet over the work: its head (number, agent, status, what started it, tokens against its budget, *Re-run*, *Stop run*, *Compare*) and its parts — numbers, who did what, steps, what it produced, data touched, history |
| A step opens inside its run | Its input, output, what it touched and its log; a step that fanned out opens on its first part with *All parts* beside it |
| A step's detail reads by layer | Bands in order — Touches · Slice · What it sent · Attempts · Model · Cache; the run reads *Layers touched* and *This run's view of the graph*, with *Retune* (AG-32). A layer the run touched nothing in draws its band dark, never hidden |
| Queued behind a schedule | A run waiting its turn shows its place in the queue; one held on a person reads *a person is waiting* |
| Who did what is drawn | Who made whom, each agent with its state in words and its tokens against what it was given; an ask still waiting drawn dashed |
| Re-run is one dialog | Wherever a run reads: *As it was* (the versions it recorded, shown — *not recorded* when it pinned none) · *Today's versions* · *Retune* (agent version, model version, run budget, view of the graph). It is offered once the run has ended |
| Time left is a rate | Agents still to finish over the last ten minutes' finishing rate; absent when none finished |
| Stopping a run | Its helpers end *stopped with its parent*, the run *stopped*; both are history rows |
| An answer from Explore is a run | Run by the graph's assistant on behalf of whoever asked; its head names the conversation |
| A run's conversation stays with its author | Others read the run, its steps and history rows; the conversation opens only for its author, or when shared |
| Windows | 7, 30 or 90 days, in the URL with the tab; each tile compares the same length before it |
| A change is the engine's | `↑ 38%`, `▲ 1.2 pt` or *flat* — under 2% or 0.1 pt reads flat; run time and tokens up read worse, success up reads better, counts are neutral |
| A failed run is the way into a better skill | *Improve this skill* opens the skill's draft with the run added as a test and a way back to the run |
| Spend in tokens | No cost is shown anywhere, even when a provider prices tokens |
| Running is the Inbox's, the list is Agents' | Inbox › Running answers *what is moving now*; Agents › Runs is where every run is found, filtered and opened. A run opens as one sheet wherever it is listed |
| Done is today | Done lists the runs that ended today, the reader's day; older runs are in Agents › Runs |
| Mine first | Running lists the reader's runs first, then everyone else's they can open |

## Open questions

| Question | Who answers |
|---|---|
| May *Can build agents* stop or re-run a run someone else started, or only its starter and an Admin? The spec says its starter and an Admin meanwhile | Ravi |
| The canvas draws *Re-run this step* on a run's step; a step out of its plan has no inputs to trust. Draw a step re-run, or re-run the whole run only? The spec says the whole run meanwhile | Ravi |
| *Alert me when it degrades* — a notification when an agent degrades needs the engine to raise an event. Add it to GR-F05, or leave it out? | Ravi |
| Does Done keep runs the reader did not start, or only theirs? Recommend: every run they can open, theirs first, as Running does | Ravi |

## Not building

| Item | Why not |
|---|---|
| A cost per run, agent or model | Tokens only |
| Custom windows or date ranges | 7, 30 and 90 days answer *since it shipped* |
| *Roll back* from how agents are doing | A version rolls back on its own sheet, after its tests (AG-36) |
| A provider's release feed | Invana does not poll vendors; an Admin offers the version they want (RT-F01) |
| Who pins each model version | Settings › AI and connections (RT-F01) |
| An icicle of a big run | Who did what and by role answer *who made whom* and *how each role is doing* |
| Saved copies of a run | A settled run never changes; its sheet reads it any time |
| A section of its own for big runs | A run of hundreds of agents is a run, started like any other |
| An estimate before a big run starts | The engine stores none, and Studio never derives a number (AG-F01) |
| *Select them* on a big run's agents | Acting on many agents is a re-run, retuned |
| Custom dashboards, alerting, paging, exporting metrics | Four questions answered well beat a builder; the record is the source — export it, not a summary |
| A word for *job* | A run and its steps already name it |
| Retry or re-run from Running | A run is re-run where it was started, with its own inputs — a blind re-run of a load writes a graph twice |
| A step as a row of its own | Steps belong to their run and open inside it |
| Runs across Graphs | A Graph is the reasoning boundary |
| Alerting on a failed run here | A rule does that (GR-17) |
| Auto-approval or auto-acceptance | Nothing set to Ask decides itself; a raised pause waits for a person, and only a person closes a task |
| A run as a transaction | Partial writes stay and a run resumes from its cursor; rolling back a graph write is a new run |

