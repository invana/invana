---
id: AC-F06
title: History — what people and agents did, and every change
product: AC
status: idea
personas: [owner, modeller, builder, analyst]
stories: [AC-16, AC-17]
journeys: []
boards: [inbox.history, agents.run]
nfrs: [NFR-REL-4, NFR-SEC-2, NFR-PERF-3]
depends_on: [AC-F05, AG-F03]
---

# History — what people and agents did, and every change

> Every act by a person or an agent in a Graph — who, through which agents, what it touched, allowed or refused — in
> one record nobody can edit, and every new version of anything versioned with why it changed and what happened after.
> The decision it helps make: *can I trust what happened here — who did it, was it allowed, and did the change make
> things better or worse?*

## User journey

```mermaid
flowchart TD
  s([Inbox › History]) -->|nothing yet| e["No acts yet — a run or a person's act writes the first row"]
  s --> rows["AC-16 · Every act: when · who, through which agents · what · touched · allowed or refused · run"]
  rows -->|Everything · People · Agents · Refused · a window| f{"Matches?"}
  f -->|no| z["0 of N match · Clear all"]
  rows -->|a row| d["AC-16 · Its chain of custody, the rule that allowed or refused it, its hash, the acts around it"]
  d -->|Open the step| run(["AG-23 · the run's sheet, on that step"])
  rows -->|by person or agent| ba["AC-16 · What one actor did, and through whom"]
  rows -->|by record| br["AC-16 · Every act on one record, and who can see it now"]
  rows -->|Refused| rf["AC-16 · What was refused, why, by which rule"]
  rows -->|Export| ex(["AC-16 · A file of the rows shown, with their hashes"])
  s -->|Changes| ch["AC-17 · Every new version: who · when · why · effect after"]
  ch -->|Compare| cmp["AC-17 · Two versions side by side · fields · plan · model"]
  ch -->|first version| one["Nothing to compare"]
  s -->|Operator| op["Own acts and the runs they can open · the rest counted, not shown"]
  s -->|the chain fails to verify| bk["History unedited? No — broken at row N; rows still read"]
```

```mermaid
sequenceDiagram
  actor P as Person
  participant A as Agent
  participant E as Engine
  participant H as History
  P->>A: asks, assigns, schedules
  A->>E: each step, each touch, each helper it starts
  E->>H: one row per act — the actor chain as it was, allowed or refused, hashed with the row before
  P->>E: publishes, stops a run, decides an ask, changes a rule
  E->>H: one row per act
  E->>E: re-checks the chain every 10 minutes
  P->>H: reads, filters, exports with the hashes
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-16 | [Read what people and agents did, and prove it](stories/AC-16-read-what-people-and-agents-did-and-prove-it/story.md) | idea |
| AC-17 | [See every change and compare two versions](stories/AC-17-see-every-change-and-compare-two-versions/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read every row, the counts over the Graph, by actor, by record and refusals | Admin | — |
| Read their own acts and the rows of runs they can open | Operator — every member | The rest is counted, not shown — a line says how many |
| Export the rows the reader can see | Operator — every member — a read; carrying confidential or personal data, or made by a key or an agent, a send ([An export](../../product.md#decisions)) | — |
| Read every change and compare two versions of a record the reader can open | Operator — every member | A record in another Graph, or one the reader cannot open, reads as absent |
| Restore an earlier version | Not here — the record's own page, by its own role | — |

## States

| State | What the person sees |
|---|---|
| First use | *No acts yet — a run or a person's act writes the first row*. Changes with nothing versioned: *No changes yet* |
| Empty after a filter | *0 of N match*, with *Clear all*; *Export* disabled, *no rows match* |
| Loading | The head, filters and table drawn at once; rows load in place |
| Has data | Rows newest first, today unless a window is chosen; the head says History is unedited, when that was last checked and how long rows are kept |
| Failed | The rows could not load, saying why, with *Try again*. The chain failing to verify: *broken at row N*, in red; rows still read |
| Agent working or proposing | Rows arrive as acts happen; an agent's rows name the person it acted for |
| No access | An Operator reads their own acts and the rows of runs they can open, a line counting the rest; the counts over the Graph are not shown |

## Rules

| Rule | Detail |
|---|---|
| One row per act | A step an agent took, a touch it was refused, a helper it started or was refused, and every act of a person — publish, stop a run, decide an ask, change a rule, pause — is a row |
| Nothing is unrecorded | Every write in the product — graph, model, skill, rule, agent, task, load, connection — is in History; there is no silent write |
| Never edited | Rows are never edited or deleted one by one; a correction is a new row |
| Provably unedited | Each row is hashed with the one before; the chain is re-checked every 10 minutes and the head says when it last held. An export carries each row's hash and the previous one |
| The actor and on whose behalf | Who acted and for whom are two names, never one — *ravi ▸ Route analyst ▸ Hub checker*; names are as they were when the row was written |
| What caused what | A row links to the act that caused it, so a chain is followed up to the person who started it |
| Secrets never enter | A credential is removed before the row is written, not hidden when read |
| A row about a deleted record | Still reads, with the record's name as it was |
| A refusal names its reason and its rule apart | The reason — no grant · outside the lens · outside the view of the graph · over its limit · the site's robots.txt · an access rule — and the rule in words (*no grant for graph/Fare*) |
| Kept for a year | Rows are kept 365 days. Removing old rows removes a whole window, never chosen rows, and the removal is itself a row |
| Every number is the engine's | Counts, per-day bars and top lists are counted over the stored rows, over the whole window |
| A change is the act that made a version | Changes are History narrowed to the acts that made a new version of a skill, rule, plan, agent or model, and every load; the versions stay where they are kept |
| Why is never invented | A reason given when a version is made is kept (500 characters); none given reads empty, never inferred |
| Effect after is counted | Runs, failed runs and tokens on a version — what runs recorded they used; a model's is the Graph's runs while it was published, labelled *while published*, so nobody reads it as cause. Tokens only, never currency |
| A draft is not a version | Drafts never appear in Changes or a compare |
| One compare | Every product's History tab and *Compare* open the same compare |
| Restore is not here | Restoring makes a new version from the record's own page; History only reads |
| Running is not History | History is what people and agents did; what executed is AG-F03 |
| Leans on | Runs and their steps (AG-F03) · asks and their decisions (AC-F05) · a record's own History tab — agents (AG-F01), skills (AG-F04), models (SE-F10), records and loads (RC-F06) · access rules and views of the graph (AC-F02 · SE-F09) |

## Data touched

| Record | Read or write |
|---|---|
| History rows — when, the actor chain, the act, what it touched, allowed or refused and why, the rule, the run and step, where it ran, its hash and the previous one | Read |
| Writes and their causes — actor, on whose behalf, what, the act that caused it | Read |
| The chain's last check — when, whether it held, where it broke | Read |
| Exports — who, the filters, the format, how many rows | Write · read |
| Versions of skills, rules, plans, agents and models, loads, and why each was made | Read |
| Runs on each version — runs, failed, tokens | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in. This feature owns the event
store: every feature's *Events* table names what it writes here, and links this section.

### Records

| Table | Columns | Notes |
|---|---|---|
| `events` | `id` · `created_at` · `graph_id?` (empty for an install act; kept when the Graph goes) · `actor_kind` (`user` · `agent` · `system` · `external` — a key's call, the id the key's · `anonymous`) · `actor_id?` · `on_behalf_of_user_id?` · `parent_event_id?` · `action` (`<package>.<records>.<verb>`) · `target_kind?` · `target_id?` · `project_id?` · `task_id?` · `run_id?` · `node_run_id?` · `skill_ids[]` · `details` (redacted at write) · `trace_id?` · `span_id?` | The event store: one append-only record of every write, install-wide and per Graph. A scope is a column; a new scope is a new column, never a scope table |
| `access_ledger_rows` | `graph_id` · `seq` (per Graph, from 1) · `at` · `actor_kind` (`person` · `agent` · `system` · `external`) · `actor_user_id?` · `actor_agent_id?` · `actor_key_id?` · `actor_chain` (names as they were) · `caused_by_seq?` · `act` · `layer` · `touched` · `touched_line` · `verdict` (`allowed` · `refused` · `approval` · `held`) · `refused_by?` (`grant` · `lens` · `world` · `ceiling` · `robots` · `policy`) · `rule?` · `value?` · `level?` · `line_version?` · `set_by_id?` · `run_id?` · `step_run_id?` · `run_number?` · `where` · `args` (redacted) · `hash` · `prev_hash` | One History row per act. Unique (`graph_id`, `seq`). `layer` is `graph` · `web` · `llm` · `secret` · `agent` · `run` · `lens` · `access` · `rule` |
| `access_ledger_checks` | `graph_id` · `verified_at` · `ok` · `last_seq` · `broken_seq?` | The chain's last check, per Graph |
| `access_ledger_exports` | `graph_id` · `requested_by_id` · `filters` · `format` (`csv` · `jsonl`) · `rows` · `created_at` | One row per export |

### Reads

| Record | Owner |
|---|---|
| Skill versions — published, with the publish event's `why` | [AG-F04](../../../../capabilities/agents/features/AG-F04-skills/feature.md#engine) |
| Rule versions | [SE-F07](../../../../capabilities/semantics/features/SE-F07-rules/feature.md#engine) |
| Plans by key and version, and the promote event's `why` | [AG-F06](../../../../capabilities/agents/features/AG-F06-plans-and-functions/feature.md#engine) |
| An agent's create and update events, each with the changed fields before and after | [AG-F01](../../../../capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) |
| Model versions and their schema diff | [SE-F02](../../../../capabilities/semantics/features/SE-F02-change-and-publish-a-model/feature.md#engine) |
| Loads — the records each added, removed and changed, and the records failing | [RC-F02](../../../../capabilities/records/features/RC-F02-bring-records-in/feature.md#engine) |
| Runs, their steps and tokens — the effect after a version, *Open the step* | [AG-F03](../../../../capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Who can see a record now — views of the graph and access rules | [SE-F09](../../../../capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md#engine) · [AC-F02](../AC-F02-access-rules/feature.md#engine) |
| Asks and their decisions | [AC-F05](../AC-F05-asks-and-approvals/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/access` | Does | Story |
|---|---|---|
| `GET /ledger` | A page of rows, newest first. Filters `since` (`today` default · `24h` · `7d` · `30d` · `all`) · `actor` · `act` · `layer` · `run_id` · `verdict` · `refused_by` · `preset` (`refused` · `writes` · `third_party` · `secrets` · `granted` · `people`); `hidden` counts the rows the reader may not see | AC-16 |
| `GET /ledger/stats?since=` | `acts` · `acts_change_pct` · `people` · `agents` · `spawned` · `refused` · `refused_by` · `waiting_approvals` · `presets` · `hidden` | AC-16 |
| `GET /ledger/{seq}` | The row · its chain of custody · `args` · `hash` · `prev_hash` · `verified` · `verified_at` · `around[]` (two rows before and two after in its run) | AC-16 |
| `GET /ledger/actor?actor=agent:<id> \| person:<id>&since=` | `acts` · `writes` · `writes_refused` · `third_party` · `secrets` · `secret_names` · `refused_by` · `graph` · `web` · `llm` · `acted_through` | AC-16 |
| `GET /ledger/record?address=&since=` | `reads` · `writes` · `refused` · `people` · `agents` · `rows` · `can_see {worlds, people, agents, can_write}` | AC-16 |
| `GET /ledger/refusals` | `refused_today` · `acts_today` · `share_pct` · by reason · `by_day[30]` · `top_functions[]` · `by_rule[]` (`refused_by` · `rule` · `what` · `who` · `refused` · `today`) | AC-16 |
| `GET /ledger/export?format=csv \| jsonl` · `GET /ledger/exports` | Stream the filtered rows, each with its hash and the previous one, and write an exports row · the exports, newest first | AC-16 |
| `GET /ledger/integrity?full=` | `{verified_at, ok, last_seq, broken_seq?, retention_days, rows}`; `full` re-verifies from row 1 | AC-16 |
| `GET /history/{kind}/{id}` | One record's changes: `{record_kind, record_id, name, items[ChangeEntry]}` | AC-17 |
| `GET /history/{kind}/{id}/compare?a=&b=` | Two versions; `a` omitted compares `b` with the one before | AC-17 |
| `GET /events` · `GET /events/stream` | The Graph's events by the list contract, every filter composing with `?changes=true` · the live tail | AC-17 |

| Route, install-wide | Does | Story |
|---|---|---|
| `GET /api/v1/access/events` · `GET /api/v1/access/events/stream` | Every event on the install and its live tail — the install Admin's; no surface reads it | — |

### Events

| Event | When |
|---|---|
| `access.ledger.export` | An export is made |
| `access.ledger.prune` | Rows older than the retention are removed, a whole window — itself a History row |
| `access.ledger.broken` | A check finds the chain broken, naming the row |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 404 | An Operator opens a row they may not see | *Not found.* | AC-16.21 |
| 404 | A record's changes or compare, in another Graph or one the reader cannot open | *Not found.* | AC-17.17 |
| 422 | A compare naming a version the record does not have | *{record} has no version {v}.* | API only — Studio offers only versions the record has |

### CLI

| Command | Does |
|---|---|
| — | No command of its own — the export is the portable form |

### Mechanisms

| Mechanism | How |
|---|---|
| One emitter | A manager emits the event of its write inside the write's transaction; `trace_id` and `span_id` are filled from the current span by the emitter, never by a caller |
| Redacted at write | Credentials never reach `details`, `args` or a row — not even encrypted; a secret is named, never its value |
| Causality | `parent_event_id` links an event to the act that caused it; `caused_by_seq` does the same for a History row |
| The live tail | A database trigger notifies every insert into `events`; the engine fans it out to the streams Studio holds open |
| Who reads `events` | The change list and the live tail, the clock's notification rules ([GR-F05](../../../graph/features/GR-F05-the-inbox/feature.md#engine)), provenance ([RC-F06](../../../../capabilities/records/features/RC-F06-provenance/feature.md#engine)), a task's tree ([PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine)) and traces — each a reading; none copies it |
| One writer of History | `record()` takes the Graph's last row under a row lock, sets `seq` and the hash, inserts. The runtime calls it for each step it settles and each touch it refuses; delegation for each helper, escrow return and refusal; every manager for each act a person, an agent or a key causes. Nothing updates or deletes a row |
| The hash chain | `hash = sha256(prev_hash ‖ canonical JSON of the row)`; the first `prev_hash` is 64 zeros. The shared clock tick ([AG-F07](../../../../capabilities/agents/features/AG-F07-schedules/feature.md#mechanisms)) re-verifies every 10 minutes from the last verified row into `access_ledger_checks`; `?full=` re-verifies from the first |
| What a reader sees | An Operator their own acts and the rows of runs they can open; the rest is counted as `hidden`. Counts over the whole Graph are an Admin's |
| Counts | Counts, per-day bars and top lists are SQL over the whole window; table rows read from the newest 20,000 |
| A change with no percentage | `acts_change_pct` is absent while the 7-day daily mean is under 10 acts |
| Export | `csv` or `jsonl` of the filtered rows with each row's hash and the previous one; a CSV cell that would run as a formula is written as text |
| Retention | 365 days; a prune removes whole windows and writes its own row; `events` keeps the same window |
| What a change is | A version-minting event of a skill, rule, plan, agent or model, or a load — the versions stay where their owner keeps them; there is no change table. `?changes=true` narrows the event list to those events |
| Each kind's versions | `skill` — published versions, a number, `why` from the publish event, effect pinned (runs offered that version) · `rule` — its versions, a number, pinned · `plan` — by key, a number, `why` from the promote event, pinned · `agent` — its create and update events, `details.diff {field: {before, after}}`, a number, pinned · `model` — published versions, a number, effect over the window it was published · `load` — the load, its records added · removed · changed and rows failing |
| `ChangeEntry` | `version` (a string) · `version_id?` (null for an agent) · `at` · `action` · `event_id` · `actor_id` · `actor_kind` · `actor_name` · `why` · `summary` · `effect` |
| `ChangeEffect` | `basis` (`pinned` · `window`) · `runs` · `failed` · `tokens_in` · `tokens_out` · `tokens` · `tokens_per_run` · `since` · `until` · `loads[{load_id, name, rows_failing}]` · `rows_failing` — tokens only |
| `ChangeCompare` | `record_kind` · `record_id` · `a` · `b` · `summary` · `fields[{field, before, after, lines}]` (text as unified lines) · `records {added, removed, changed}` (a load's) · `plan` (a plan's, or a skill's whose versions drew plans) · `schema_diff` (a model's) · `tokens_per_run_change` (`b` against `a`; null when either ran nothing) |
| `why` on a write that mints | An optional `why` (500 characters) on each owner's minting write lands in its event's `details.why`; none given stays empty |
| Read-only everywhere | The install's generated admin shows `events` and History rows read-only |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | The event store `events` and three History tables in Invana's own store; History is kept 365 days | — |
| § 8 APIs and events | The ledger, history and events routes; the event store is where every feature's events land | — |
| § 9 Distributed execution | The chain is re-verified on the shared clock tick; one writer per Graph under a row lock keeps `seq` gapless | — |
| § 12 Qualities | Security: append-only, hash-chained, verified every 10 minutes, credentials redacted before the write | — |

## Decisions

| Decision | Detail |
|---|---|
| History is one place | People's acts, agents' acts, refusals and changes are filters of one History — *Everything · People · Agents · Changes · Refused* — not four pages |
| Rows read today | Until a window is chosen — today · last 24 hours · 7 days · 30 days · any time; an export takes the same window |
| A preset chip names its window | *Refused today*, *Writes in the last 7 days* — each preset says its window, with the engine's count beside it |
| A row opens beside the list | Its detail opens over the right of History; the list still takes clicks, so another row moves it |
| An Operator reads less, and is told | They see their own acts and the runs they can open; a line counts what they cannot see. Counts over the whole Graph are an Admin's |
| By an actor includes its helpers | Every row whose chain names the actor — helpers of one kind grouped as *Hub checker ×4*, a delegated agent its own row |
| Who can see a record now | Read from views of the graph and access rules, never from History |
| A change shows no percentage on an empty week | The change in acts against the 7-day daily mean is absent while that mean is under 10 acts a day |
| Compare carries tokens per run | The compare reads *Tokens per run* of one version against the other, as the engine counted it |
| A model's change names its loads | A model version's effect lists the loads it touched and how many records fail |

## Open questions

| Question | Who answers |
|---|---|
| Does History read across every Graph the person is on, as the board's subtitle does? Recommend: per Graph — a Graph is the reasoning boundary; the Inbox question in GR-F05 settles both | Ravi |

## Not building

| Item | Why not |
|---|---|
| Editing or deleting a row | A correction is a new row |
| Scheduled exports and an archive to object storage | Both need an object store an install configures; an export on demand is the proof now |
| A History CLI | The export is the portable form |
| A change table or a copy of versions | The versions already exist; a copy drifts |
| Currency in effect after | Tokens only |
| Restore from History | A restore is the record's own write, which makes a new version |
| Filling in a reason or a diff for old versions | An empty field is honest; an inferred one is not |
| Versions of boards and reports | A frozen reading, not a change to a definition |
| A feed per person | History is per subject — a run, an agent, a record, the Graph |
| Sending History to an outside log tool | That belongs to the install's own platform |
