---
id: CP-F09
title: Overview — Operations and workloads
product: CP
status: idea
personas: [admin, builder, analyst]
stories: [CP-70]
journeys: [J08]
boards: [shell.operations]
nfrs: [NFR-PERF-3, NFR-COST-2, NFR-PERF-7, NFR-UX-2]
depends_on: [CP-F10, CP-F04, CP-F11, AC-F09, CP-F03, CP-F01, CP-F05, CP-F08]
---

# Overview — Operations and workloads

> What the deployment is doing, at a glance from the header's *● n running*: runs going and queued, the queue, workers
> busy and lost, and this month's tokens against the budget — an Operator's own runs going.
> Then the workloads page: runs going, waiting and failed, and tokens spent — grouped by the person behind each run,
> the agent and the team — each against its limit. The decision it helps make: *whose work is moving, whose is stuck
> or spending too much, and where do I look first?*

## User journey

Journeys this feature is a step of: [J08 · Watch agent workloads and act on an alert](../../../../journeys/J08-watch-agent-workloads-and-act-on-an-alert.md)

```mermaid
flowchart TD
  h([The header ● n running · the footer's]) --> od["CP-70 · The Operations dropdown · Running · Queue · Workers · Tokens this month · Running now with Stop"]
  od -->|Operator| odo["CP-70 · My runs only"]
  od -->|Agents › Runs| runs(["Agents › Runs (CP-F10)"])
  od -->|Workers| set(["Settings › Workers in the large modal"])
  s([Settings › Workers › Limits › Usage]) --> o["CP-34 · Tiles: running · waiting · failed today · tokens today and this month against the deployment's limit"]
  o -->|nothing ran yet| e["What a run is, and that a question, a task or a schedule starts one"]
  o --> g{"Group by"}
  g -->|User| u["Each person behind runs: running · waiting · failed · tokens against their limit"]
  g -->|Agent| a["Each agent: the same, against the agent's limit"]
  g -->|Team| t["Each team: the same, against the team's limit"]
  u --> f["A figure opens Runs filtered to what it counts (CP-F10)"]
  a --> f
  t --> f
  o -->|ops alerts open| al(["Ops alerting (CP-F11)"])
  u -->|at or near a limit| lim(["Limits (CP-F04)"])
  o -->|could not load| fl["What could not be read, in the engine's words · Retry"]
  o -->|Operator| op["The same figures; a run they may not read opens as that it ran, its status and its tokens (AC-31)"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| CP-70 | [See what the deployment is doing from the header](stories/CP-70-see-what-the-deployment-is-doing-from-the-header/story.md) | idea |

## Access

The permission each act needs is in [AC-F02 › The permission catalogue](../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue); this table names the acts.

| Act | Permission ([the permission catalogue](../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)) | Everyone else sees |
|---|---|---|
| Read the overview — tiles, groups, open ops alerts | None — every signed-in person, their own runs going · Read on `worker/<group>` for the rest | — |
| Read the Operations dropdown on the deployment — every run going, the queue, workers, tokens this month against the budget | Read on `worker/<group>` and `run/*` | Their own runs going; the other tiles and the *Workers* link are absent |
| Open the runs behind a figure | None — every signed-in person; a run's content as [AC-31](../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md) | Content withheld, naming who may read it |
| Act from a figure — stop a run, change a limit | As [CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md#access) and [CP-F04](../CP-F04-limits/feature.md#access) | As there |

## States

| State | What the person sees |
|---|---|
| First use | Tiles read `0` or `—`; *Nothing ran yet* and what starts a run |
| Empty after a filter | *No {user · agent · team} ran anything in {window}* · *Clear* |
| Loading | The tiles and the group switch drawn at once; rows fill in place |
| Has data | The tiles, then one row per user, agent or team, busiest first, each with its meters |
| Failed | What could not be read, in the engine's words, and *Retry* |
| Agent working or proposing | Running counts move as runs start and end, repainted at most once a second |
| No access | — every signed-in person reads the overview |

## Rules

| Rule | Detail |
|---|---|
| One reading of the runs | The overview counts the runs record ([CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine)); it stores nothing of its own |
| Group by | *User* — the person behind the run · *Agent* — the root run's agent · *Team* — each team the person behind was on when the run opened. A run counts once per team, so team rows may add up to more than the total, and the page says so |
| Windows | Today (the reader's day) · 7 · 30 days; *this month* is the limits' month |
| Each row against its limit | Tokens this month against the row's limit from [CP-F04](../CP-F04-limits/feature.md); a row with no limit reads *No limit*, never an empty meter |
| Every figure opens its runs | A count opens Runs filtered to that user, agent or team, that state and that window |
| Operations is a quick overview | A dropdown of about 720 px: four tiles — Running · Queue · Workers · Tokens this month — then *Running now*. The header's *● n running* and the footer's open it; it reads *Idle* with a grey dot when nothing runs and keeps its place. It links to Agents › Runs in the Agents mode and Settings › Workers in the large modal, where every deeper act happens and where agents against their budgets, workers by group, AI models, graph databases and alerts are read — add workers, change a limit, tune an alert, drain; in place it offers only *Stop* on a run (CP-58). It is never a summoner |
| Only system state | Operations holds what the deployment is doing; what waits on a person is the Inbox's ([CP-F08](../CP-F08-the-inbox/feature.md)) |
| Near a budget is the engine's | The engine marks the *Tokens this month* tile `near_limit` at 80% or more of the deployment's budget; Studio colours it amber and computes nothing |
| Counts, never content | A row counts every run, including those the reader may not read; their content stays withheld ([AC-31](../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)) |
| Open ops alerts | The number still open, by kind, opening [CP-F11](../CP-F11-ops-alerting/feature.md) |
| The engine counts | Every tile, count and meter is the engine's; Studio formats and derives nothing |
| Tokens, never currency | Every figure counts tokens ([glossary › Token budget](../../../../glossary.md#what-may-happen)) |
| Leans on | Runs (CP-F10) · Limits (CP-F04) · Ops alerting (CP-F11) · teams (AC-F03) · run privacy (AC-F09) |

## Data touched

| Record | Read or write |
|---|---|
| Runs — status, the person behind, agent, teams at open, tokens, times | Read |
| Limits per team, user and agent, and spend this month | Read |
| Open ops alerts | Read |
| Workers and their state, and the queue (CP-F03) | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| — | — | Stores nothing; reads `control_runs` (with its `team_ids[]` written at open) and the limits |

### Reads

| Record | Owner |
|---|---|
| Runs, their per-run numbers and `team_ids[]` | [CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Limits per team, user and agent, and spend this month | [CP-F04](../CP-F04-limits/feature.md#engine) |
| Open ops alerts | [CP-F11](../CP-F11-ops-alerting/feature.md#engine) |
| Teams and users | [AC-F03](../../../access/features/AC-F03-directory/feature.md#engine) |
| Workers and their state — busy, lost — the queue and its oldest step | [CP-F03](../CP-F03-workers-and-the-queue/feature.md#engine) |
| Who may stop a run — `may_stop` | [CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) |

### Routes

| Route, after `/api/v1/control` | Does | Story |
|---|---|---|
| `GET /overview?window=today·7d·30d&tz=` | `tiles` — `running` · `waiting` · `failed` · `tokens` · `tokens_this_month` · `monthly_tokens` (the deployment's limit, null when none) · `alerts_open` (by kind) | CP-34 |
| `GET /operations?tz=` | The Operations dropdown, scoped by permission (below): `tiles` — `running` · `queued` · `queue_waiting` · `queue_oldest_at` · `workers {busy, total, lost}` · `tokens_this_month` · `monthly_tokens` (null — no limit) · `near_limit`; `running[]` — `run_id` · `agent` · `behind` · `step` · `steps` · `may_stop` | CP-70 |
| `GET /overview/groups?by=user·agent·team&window=&tz=` | By the list contract, busiest first: `subject_kind` · `subject_id` · `name` · `running` · `waiting` · `failed` · `runs` · `tokens` · `tokens_this_month` · `monthly_tokens` (null — no limit) · `at_limit`; `team_overlap` true when `by=team` and a run counts under more than one team | CP-34 |

### Events

| Event | When |
|---|---|
| — | Reads only |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 422 | `window` or `by` outside the offered values | *{field}: one of {values}.* | API only — Studio offers the choices |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| Counting | Root runs only, eval runs left out; `running` — queued or running · `waiting` — held on a person · `failed` — ended `failed` in the window, *cannot answer* not counted. Tokens are each run's stored `run_tokens`, helpers included |
| Teams at open | A run's `team_ids[]` is the person's teams when the run opened; a later team change never moves a past run |
| Spend this month | Read from CP-F04's month counters, never summed here |
| Live | Studio refreshes the tiles while open, repainting at most once a second |
| Operations by permission | A person with Read on `worker/<group>` and `run/*` reads every tile and `running[]` on the deployment. Anyone else reads `tiles.running`, `tiles.queued` and `running[]` for runs they are behind; the other tiles are absent, never empty |
| Near a budget | `near_limit` is true at 80% or more of the deployment's *Tokens a month* ([CP-F04](../CP-F04-limits/feature.md)); false when no budget is set |
| Workers | `total` counts workers joined and not removed; `busy` those running a step; `lost` those with no heartbeat for 30 s ([CP-F03](../CP-F03-workers-and-the-queue/feature.md#rules)) |
| The header count | *● n running* reads `running` from the one counts source ([CP-F08](../CP-F08-the-inbox/feature.md#engine)), never this route |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 8 APIs and events | Two read routes under `/api/v1/control/overview` and the Operations read `/api/v1/control/operations` | NFR-PERF-7 |
| § 12 Qualities | Performance: grouped counts over the runs record answer within the read budget; cost in tokens only; every figure the engine's | NFR-PERF-3 · NFR-COST-2 · NFR-UX-2 |

## Decisions

| Decision | Detail |
|---|---|
| Operations is the header's glance | The deployment's state is one dropdown from every screen, never a page or a summoner; Agents › Runs in the Agents mode and Settings › Workers in the large modal are the depth behind it |
| Workloads is Usage on Limits | *Settings › Workers › Limits › Usage*, in the large modal, reads runs and tokens by user, agent and team ([CP-34](../CP-F04-limits/stories/CP-34-read-what-each-team-user-and-agent-spends-against-its-limits/story.md)). How each agent performs is a tab of Agents › Runs ([CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| An Operator sees their own | Their own runs going; the deployment's queue, workers and tokens need Read on `worker/<group>` |
| A run counts under each of its teams | Teams are flat and a person may be on several; splitting a run across them would invent a share nobody set |
| Everyone reads the counts | Counts and tokens are never content; who may read a run's content is [AC-31](../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)'s |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| CP-47 — merged into CP-34 | One story reads usage by team, user and agent: [CP-34](../CP-F04-limits/stories/CP-34-read-what-each-team-user-and-agent-spends-against-its-limits/story.md) |
| The Fleet map | No story reads it; the agent, skill and function chain reads on each agent and skill |
| Custom dashboards or charts | One page answering *whose work, and how much* beats a builder |
| A cost figure | Tokens only |
| Operations as a summoner | It links into Agents › Runs and Settings › Workers |
| Grouping by graph database | A run may cross several; Runs filters by graph database instead (CP-F10) |
| Acting on many runs at once | Stopping is one run at a time, from the run (CP-58) |
