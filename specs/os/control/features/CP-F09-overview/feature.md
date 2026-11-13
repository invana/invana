---
id: CP-F09
title: Overview — workloads by user, agent and team
product: CP
status: idea
personas: [admin, builder, analyst]
stories: [CP-47]
journeys: [J08]
boards: [control.overview]
nfrs: [NFR-PERF-3, NFR-COST-2]
depends_on: [CP-F10, CP-F04, CP-F11, AC-F09]
---

# Overview — workloads by user, agent and team

> One page for what the deployment's agents are doing: runs going, waiting and failed, and tokens spent — grouped by
> the person behind each run, the agent and the team — each against its limit, with the ops alerts still open. The
> decision it helps make: *whose work is moving, whose is stuck or spending too much, and where do I look first?*

## User journey

Journeys this feature is a step of: [J08 · Watch agent workloads and act on an alert](../../../../journeys/J08-watch-agent-workloads-and-act-on-an-alert.md)

```mermaid
flowchart TD
  s([Control Plane › Overview]) --> o["CP-47 · Tiles: running · waiting · failed today · tokens today and this month against the deployment's limit"]
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
| CP-47 | [See workloads by user, agent and team](stories/CP-47-see-workloads-by-user-agent-and-team/story.md) | idea |

## Access

The role × feature table is [AC-F02 › The role table](../../../access/features/AC-F02-access-policies/feature.md#the-role-table); this is what it means here.

| Act | Role | Everyone else sees |
|---|---|---|
| Read the overview — tiles, groups, open ops alerts | Operator · Modeller · Admin | — |
| Open the runs behind a figure | Operator · Modeller · Admin; a run's content as [AC-31](../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md) | Content withheld, naming who may read it |
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
| No access | — every role reads the overview |

## Rules

| Rule | Detail |
|---|---|
| One reading of the runs | The overview counts the runs record ([CP-F10](../CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine)); it stores nothing of its own |
| Group by | *User* — the person behind the run · *Agent* — the root run's agent · *Team* — each team the person behind was on when the run opened. A run counts once per team, so team rows may add up to more than the total, and the page says so |
| Windows | Today (the reader's day) · 7 · 30 days; *this month* is the limits' month |
| Each row against its limit | Tokens this month against the row's limit from [CP-F04](../CP-F04-limits/feature.md); a row with no limit reads *No limit*, never an empty meter |
| Every figure opens its runs | A count opens Runs filtered to that user, agent or team, that state and that window |
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

### Routes

| Route, after `/api/v1/control` | Does | Story |
|---|---|---|
| `GET /overview?window=today·7d·30d&tz=` | `tiles` — `running` · `waiting` · `failed` · `tokens` · `tokens_this_month` · `monthly_tokens` (the deployment's limit, null when none) · `alerts_open` (by kind) | CP-47 |
| `GET /overview/groups?by=user·agent·team&window=&tz=` | By the list contract, busiest first: `subject_kind` · `subject_id` · `name` · `running` · `waiting` · `failed` · `runs` · `tokens` · `tokens_this_month` · `monthly_tokens` (null — no limit) · `at_limit`; `team_overlap` true when `by=team` and a run counts under more than one team | CP-47 |

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

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 8 APIs and events | Two read routes under `/api/v1/control/overview` | — |
| § 12 Qualities | Performance: grouped counts over the runs record answer within the read budget; cost in tokens only | NFR-PERF-3 · NFR-COST-2 |

## Decisions

| Decision | Detail |
|---|---|
| Overview opens the Control Plane | It is the first page an Admin reads; graph databases, limits and workers are one click from it |
| A run counts under each of its teams | Teams are flat and a person may be on several; splitting a run across them would invent a share nobody set |
| Everyone reads the counts | Counts and tokens are never content; who may read a run's content is [AC-31](../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)'s |

## Open questions

| Question | Who answers |
|---|---|
| — | — |

## Not building

| Item | Why not |
|---|---|
| Custom dashboards or charts | One page answering *whose work, and how much* beats a builder |
| A cost figure | Tokens only |
| Grouping by graph database | A run may cross several; Runs filters by graph database instead (CP-F10) |
| Acting on many runs at once | Stopping is one run at a time, from the run (CP-58) |
