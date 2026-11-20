---
id: AC-F06
title: History — what people and agents did, and every change
product: AC
status: idea
personas: [admin, modeller, builder, analyst]
stories: [AC-16, AC-17, AC-48]
journeys: [J09]
boards: [settings.history, agents.runs, shell.access, settings.agent_access, access.signin, shell.avatar.access]
nfrs: [NFR-REL-4, NFR-SEC-2, NFR-PERF-3, NFR-PERF-7]
depends_on: [AC-F05, AC-F09, AC-F12, CP-F10, AC-F01, AC-F03, AC-F10, AC-F11, CP-F08]
---

# History — what people and agents did, and every change

> Every act by a person or an agent in the deployment — who, through which agents, what it touched, allowed or
> refused, by which rule — in one append-only chain nobody can edit, and every new version of anything versioned
> with why it changed and what happened after.
> The decision it helps make: *can I trust what happened here — who did it, was it allowed, and did the change make
> things better or worse?*

## User journey

Journeys this feature is a step of: [J09 · Audit what an agent touched](../../../../journeys/J09-audit-what-an-agent-touched-and-what-left-the-platform.md)

```mermaid
flowchart TD
  ad([The header lock · Admin only]) --> acc["AC-48 · The Access dropdown · tiles · what each one is touching · last hour"]
  acc -->|a blocked act| now["AC-48 · History · Refused · Today · blocked today"]
  acc -->|an agent| dl["AC-48 · the agent's page · Delegations in force"]
  acc -->|Access › Record| s
  dl -->|Revoke · password again| rvk(["A key ends · History row"])
  s([Access › Record › History]) -->|nothing yet| e["No acts yet — a run or a person's act writes the first row"]
  s --> rows["AC-16 · Every act: when · who, through which agents · what · touched · allowed or refused · run"]
  rows -->|Everything · People · Agents · Refused · a window| f{"Matches?"}
  f -->|no| z["0 of N match · Clear all"]
  rows -->|a row| d["AC-16 · Its chain of custody, the rule that allowed or refused it, its hash, the acts around it"]
  d -->|a run the reader may not read| wh["Arguments withheld · AC-31"]
  d -->|Open the step| run(["CP-50 · the run's page, on that step"])
  rows -->|by person or agent| ba["AC-16 · What one actor did, and through whom"]
  rows -->|by record| br["AC-16 · Every act on one record, and which agents may read it now"]
  rows -->|Refused| rf["AC-16 · What was refused, why, by which rule"]
  rows -->|Export| ex(["AC-16 · A file of the rows shown, with their hashes"])
  s -->|Changes| ch["AC-17 · Every new version: who · when · why · effect after"]
  ch -->|Compare| cmp["AC-17 · Two versions side by side · fields · workflow · model · policy"]
  ch -->|first version| one["Nothing to compare"]
  s -->|Operator| op["Own acts and the runs they may read · the rest counted, not shown"]
  s -->|the chain fails to verify| bk["History unedited? No — broken at row N; rows still read"]
  pr([An Admin's retention period passes · AC-F12]) --> hold{"History on hold?"}
  hold -->|yes| none(["No prune"])
  hold -->|no| cut["AC-16 · A whole window removed · a signed checkpoint of the last row removed"]
  cut --> ver(["The chain verifies from the checkpoint"])
```

```mermaid
sequenceDiagram
  actor P as Person
  participant A as Agent
  participant E as Engine
  participant H as History
  P->>A: asks, assigns, schedules
  A->>E: each step, each refusal, each helper it starts
  E->>H: one row per act — the actor chain as it was, allowed or refused, hashed with the row before
  P->>E: publishes, stops a run, decides an ask, saves a policy
  E->>H: one row per act
  E->>E: re-checks the one chain every 10 minutes
  P->>H: reads, filters, exports with the hashes
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-16 | [Read what people and agents did, and prove it](stories/AC-16-read-what-people-and-agents-did-and-prove-it/story.md) | idea |
| AC-17 | [See every change and compare two versions](stories/AC-17-see-every-change-and-compare-two-versions/story.md) | idea |
| AC-48 | [See who is acting and what was blocked, from the header](stories/AC-48-see-who-is-acting-and-what-was-blocked-from-the-header/story.md) | idea |

## Access

| Act | Permission ([the permission catalogue](../AC-F02-access-policies/feature.md#the-permission-catalogue)) | Everyone else sees |
|---|---|---|
| Read every row, the counts over the deployment, by actor, by record and refusals | Admin | — |
| Read a row's arguments | Whoever may read its run ([AC-31](../AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)) — an Admin included, by the same rule | Who, the act, the verdict and the rule; arguments *withheld* |
| Read their own acts and the rows of runs they may read | None — every signed-in person | The rest is counted, not shown — a line says how many |
| Export the rows the reader can see | Every signed-in person | — |
| Read every change and compare two versions of a record the reader can open | Every signed-in person | A record the reader cannot open reads as absent |
| Read the event list and its live tail | Admin — every event; everyone else — their own acts and the change events of records they can open ([What a reader of `events` gets](#mechanisms)) | Another person's sign-ins, keys, clients and refusals are never sent |
| Restore an earlier version | Not here — the record's own page, by the permission it needs (Edit on its resource) | — |
| Read the Access dropdown — its tiles and what each person and agent touched in the last hour | Admin | No *Access* button in the header |
| Read acting now in the Access dropdown, blocked today in History · Refused, delegations in force on an agent's page | Admin | *Ask {Admin}* |
| Revoke a key acting for a person or a project, from the agent's page · Delegations | Admin, with the password again ([AC-F10](../AC-F10-keys/feature.md) · [AC-F11](../AC-F11-connect-an-mcp-client/feature.md)) | — |
| Read *Your access* — one's own policies, agents and delegations — and revoke one's own | Every signed-in person, for themselves | Another person's is absent |

## States

| State | What the person sees |
|---|---|
| First use | *No acts yet — a run or a person's act writes the first row*. Changes with nothing versioned: *No changes yet* |
| Empty after a filter | *0 of N match*, with *Clear all*; *Export* disabled, *no rows match* |
| Loading | The head, filters and table drawn at once; rows load in place |
| Has data | Rows newest first, today unless a window is chosen; the head says History is unedited, when that was last checked, how long rows are kept and whether History is on hold |
| Failed | The rows could not load, saying why, with *Try again*. The chain failing to verify: *broken at row N*, in red; rows still read |
| Agent working or proposing | Rows arrive as acts happen; an agent's rows name the person it acted for |
| No access | A person without Read on `access/history` reads their own acts and the rows of runs they may read, a line counting the rest; the counts over the deployment are not shown |

## Rules

| Rule | Detail |
|---|---|
| One chain for the deployment | Every act in the deployment is a row in one append-only chain with a gapless sequence; there is no chain per part of the deployment |
| One row per act | A step an agent took, a refusal, a helper it started, an ask and its decision, and every act of a person — publish, stop a run, save a policy, attach it or take it off, switch a graph database — is a row |
| Nothing is unrecorded | Every write in the product — a graph database, the model, a skill, a workflow, a policy, an agent, a task, a load — is in History; there is no silent write |
| Never edited | Rows are never edited or deleted one by one; a correction is a new row |
| Provably unedited | Each row is hashed with the one before; the chain is re-checked every 10 minutes from the latest checkpoint and the head says when it last held. An export carries each row's hash and the previous one |
| The actor and on whose behalf | Who acted and for whom are two names, never one — *Sam ▸ Reporting agent ▸ Order checker*; names are as they were when the row was written, and a departed person's read as their code when names are pseudonymised ([AC-F12](../AC-F12-leaving-and-keeping/feature.md)) |
| What caused what | A row links to the act that caused it, so a chain is followed up to the person who started it |
| Secrets never enter | A credential is removed before the row is written, not hidden when read |
| Arguments follow run privacy | A row's arguments read to whoever may read its run ([AC-31](../AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)) — no permission grants it by itself; anyone else who may see the row reads who, the act, the verdict and the rule |
| A row about a deleted record | Still reads, with the record's name as it was |
| A refusal names its reason and its rule apart | The reason — a permission the person lacks · may not use the agent · an Access Policy rule · switched off · a read-only graph database · a sensitive property · over a limit · the site's robots.txt — and the rule in words (*Deny reading Order in sales, for Finance*). `refused_by`, `rule`, `policy_id` and `set_by_id` read only to a person with Read on `access/policies`; anyone else reads *refused* and the reason's sentence without the rule, the policy or who set it, and a name a Deny hides is never a row's `touched` — it failed at lookup as one that does not exist ([AC-F02 › Property access](../AC-F02-access-policies/feature.md#property-access)) |
| Kept until an Admin sets a period | Rows are kept until an Admin sets History's period ([AC-F12](../AC-F12-leaving-and-keeping/feature.md)); none is removed while History is on legal hold. Removing old rows removes a whole window, never chosen rows, and the removal is itself a row |
| A prune leaves a signed checkpoint | Each prune keeps a checkpoint — the last removed row's number and hash, signed — so the chain that stays still proves it follows on from what was removed |
| Every number is the engine's | Counts, per-day bars and top lists are counted over the stored rows, over the whole window |
| A change is the act that made a version | Changes are History narrowed to the acts that made a new version of a skill, rule, workflow, agent, model or Access Policy, and every load; the versions stay where they are kept |
| Why is never invented | A reason given when a version is made is kept (500 characters); none given reads empty, never inferred |
| Effect after is counted | Runs, failed runs and tokens on a version — what runs recorded they used; a model's is the deployment's runs while it was published, labelled *while published*, so nobody reads it as cause. Tokens only |
| A draft is not a version | Drafts never appear in Changes or a compare |
| One compare | Every product's History tab and *Compare* open the same compare |
| Restore is not here | Restoring makes a new version from the record's own page; History only reads |
| Running is not History | History is what people and agents did; what executed is Runs (CP-F10), and what left is the ledger (AC-F09) |
| Leans on | Runs and their steps (CP-F10) · asks and their decisions (AC-F05) · the ledger (AC-F09) · a record's own History tab — agents (AG-F01), skills (AG-F04), models (SE-F10), records and loads (RC-F06) · Access Policies (AC-F02) |

## Data touched

| Record | Read or write |
|---|---|
| History rows — when, the actor chain, the act, what it touched, allowed or refused and why, the rule, the run and step, where it ran, its hash and the previous one | Read |
| Checkpoints — the last row each prune removed, its hash and its signature | Write · read |
| History's period and hold ([AC-F12](../AC-F12-leaving-and-keeping/feature.md#engine)) | Read |
| Writes and their causes — actor, on whose behalf, what, the act that caused it | Read |
| Live sessions (AC-F01) · runs going (CP-F10) · connected clients (AC-F11) · keys (AC-F10) · people's policies (AC-F03) · asks waiting (AC-F05) | Read |
| The chain's last check — when, whether it held, where it broke | Read |
| Exports — who, the filters, the format, how many rows | Write · read |
| Versions of skills, rules, workflows, agents, models and Access Policies, loads, and why each was made | Read |
| Runs on each version — runs, failed, tokens | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in. This feature owns the event
store: every feature's *Events* table names what it writes here, and links this section.

### Records

| Table | Columns | Notes |
|---|---|---|
| `events` | `id` · `created_at` · `actor_kind` (`user` · `agent` · `system` · `external` — a key's or an MCP client's call · `anonymous`) · `actor_id?` · `on_behalf_of_user_id?` · `key_id?` · `client_id?` · `parent_event_id?` · `action` (`<package>.<records>.<verb>`) · `target_kind?` · `target_id?` · `database_id?` · `project_id?` · `task_id?` · `run_id?` · `node_run_id?` · `skill_ids[]` · `details` (redacted at write) · `trace_id?` · `span_id?` | The event store: one append-only record of every write in the deployment |
| `access_history_rows` | `seq` (from 1, gapless) · `at` · `actor_kind` (`person` · `agent` · `system` · `external`) · `actor_user_id?` · `actor_agent_id?` · `actor_key_id?` · `actor_client_id?` · `actor_chain` (user ids, in order) · `actor_names` (names as they were — outside the hash) · `behind_user_id?` · `caused_by_seq?` · `act` · `layer` (`data` · `skill` · `workflow` · `agent` · `plugin` · `tool` · `model` · `access` · `run`) · `touched` · `verdict` (`allowed` · `refused` · `asked` · `held`) · `refused_by?` (`permission` · `agent_not_granted` · `policy` · `switched_off` · `read_only` · `sensitive` · `limit` · `robots`) · `rule?` · `effect?` · `policy_id?` · `policy_version?` · `set_by_id?` · `run_id?` · `step_run_id?` · `run_number?` · `where` · `args` (redacted) · `hash` · `prev_hash` | One History row per act; unique `seq` |
| `access_history_checks` | `verified_at` · `ok` · `last_seq` · `broken_seq?` · `from_checkpoint_seq?` | The chain's checks |
| `access_history_checkpoints` | `at` · `last_removed_seq` · `last_removed_hash` · `rows_removed` · `signature` (HMAC-SHA-256 under the ledger key) · `key_version` | One row per prune; never removed |
| `access_history_exports` | `requested_by_id` · `filters` · `format` (`csv` · `jsonl`) · `rows` · `created_at` | One row per export |

### Reads

| Record | Owner |
|---|---|
| Skill versions — published, with the publish event's `why` | [AG-F04](../../../../capabilities/agents/features/AG-F04-skills/feature.md#engine) |
| Rule versions | [SE-F07](../../../../capabilities/semantics/features/SE-F07-rules/feature.md#engine) |
| Workflows by name and version, and the approval event's `why` | [AG-F06](../../../../capabilities/agents/features/AG-F06-plans-and-workflows/feature.md#engine) |
| An agent's create and update events, each with the changed fields before and after | [AG-F01](../../../../capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) |
| Model versions and their schema diff | [SE-F02](../../../../capabilities/semantics/features/SE-F02-change-and-publish-a-model/feature.md#engine) |
| Access Policy versions | [AC-F02](../AC-F02-access-policies/feature.md#engine) |
| Loads — the records each added, removed and changed, and the records failing | [RC-F02](../../../../capabilities/records/features/RC-F02-bring-records-in/feature.md#engine) |
| Runs, their steps and tokens — the effect after a version, *Open the step* | [CP-F10](../../../control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Which agents may read a record's kind now — Access Policies and the one evaluator | [AC-F02](../AC-F02-access-policies/feature.md#engine) |
| Asks and their decisions | [AC-F05](../AC-F05-asks-and-approvals/feature.md#engine) |
| Who may read a run's content — `may_read_run()` · the ledger key | [AC-F09](../AC-F09-what-left-the-platform/feature.md#mechanisms) |
| History's period, its hold, a departed person's pseudonym | [AC-F12](../AC-F12-leaving-and-keeping/feature.md#engine) |

### Routes

| Route, after `/api/v1/access/history` | Does | Story |
|---|---|---|
| `GET /rows` | A page of rows, newest first. Filters `since` (`today` default · `24h` · `7d` · `30d` · `all`) · `actor` · `act` · `layer` · `run_id` · `verdict` · `refused_by` · `preset` (`refused` · `writes` · `outside` · `secrets` · `people`); `hidden` counts the rows the reader may not see | AC-16 |
| `GET /rows/stats?since=` | `acts` · `acts_change_pct` · `people` · `agents` · `spawned` · `refused` · `refused_by` · `waiting_asks` · `presets` · `hidden` | AC-16 |
| `GET /rows/{seq}` | The row · its chain of custody · `args` (withheld unless the reader may read its run) · `hash` · `prev_hash` · `verified` · `verified_at` · `around[]` (two rows before and two after in its run) | AC-16 |
| `GET /actor?actor=agent:<id> \| person:<id>&since=` | `acts` · `writes` · `writes_refused` · `outside` · `secrets` · `secret_names` · `refused_by` · `data` · `tools` · `models` · `acted_through` | AC-16 |
| `GET /record?address=&since=` | `reads` · `writes` · `refused` · `people` · `agents` · `rows` · `readable_by {agents, teams}` | AC-16 |
| `GET /refusals` | `refused_today` · `acts_today` · `share_pct` · by reason · `by_day[30]` · `top_functions[]` · `by_rule[]` (`refused_by` · `rule` · `policy` · `refused` · `today`) | AC-16 |
| `GET /export?format=csv \| jsonl` · `GET /exports` | Stream the filtered rows, each with its hash and the previous one, and write an exports row · the exports, newest first | AC-16 |
| `GET /integrity?full=` | `{verified_at, ok, last_seq, broken_seq?, keep_days?, held, checkpoint?, rows}`; `full` re-verifies from the latest checkpoint, or row 1 when none | AC-16 |
| `GET /summary?tz=` | The Access dropdown, Admin only; `tz` an IANA zone: `tiles` — `people_signed_in` · `agents_acting` · `requests_waiting` · `blocked_today`; `window` — `from` · `to` (the last hour); `actors[]`, the most recent first — `actor_kind` (`person` · `agent`) · `actor` · `on_behalf_of?` (an agent's) · `run_id?` · `blocked` (refused in the window) · `bars[]` — `layer` (`model` · `graph_data` · `graph_database` · `outside`) · `touched` · `from` · `to` · `refused`; `more_actors` (actors not sent) | AC-48 |
| `GET /now?tz=` | The Access dropdown's acting now, History · Refused's blocked today and an agent's Delegations, Read on `access/history`; `tz` an IANA zone: `acting_now[]` — `actor_kind` (`person` · `agent`) · `actor` · `on_behalf_of?` · `run_id?` · `last_acted` (`now` · `within_15_min` · `today`); `blocked_today[]` — `seq` · `at` · `actor` · `agent` · `act` · `touched` · `rule` · `policy`; `delegations[]` — `kind` (`key`; `client` when AC-F11 is built) · `id` · `name` · `acts_for` (a person or a project) · `ends_at?` (none — never expires) · `verified` (`false` for a self-registered client) · `redirect_host?` (a client's) | AC-48 |
| `GET /changes/{kind}/{id}` | One record's changes: `{record_kind, record_id, name, items[ChangeEntry]}` | AC-17 |
| `GET /changes/{kind}/{id}/compare?a=&b=` | Two versions; `a` omitted compares `b` with the one before | AC-17 |
| `GET /events` · `GET /events/stream` | The events the reader may read ([What a reader of `events` gets](#mechanisms)) by the list contract, every filter composing with `?changes=true` · the live tail, by the same rule | AC-17 |

### Events

| Event | When |
|---|---|
| `access.history.export` | An export is made |
| `access.history.prune` | Rows older than History's period are removed, a whole window — itself a History row, naming its checkpoint |
| `access.history.broken` | A check finds the chain broken, naming the row |
| `access.history.summary_read` | An Admin reads the access summary — at most one per Admin per hour |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 404 | A row the reader may not see is opened | *Not found.* | AC-16.21 |
| 404 | A record's changes or compare, for a record the reader cannot open | *Not found.* | AC-17.17 |
| 422 | A compare naming a version the record does not have | *{record} has no version {v}.* | API only — Studio offers only versions the record has |
| 403 | The access summary or the refusals read without Read on `access/history` | *This needs Read on access/history — ask {who can grant}.* | AC-48.19 |
| 401 | *Revoke* without the password, or a wrong one | *Enter your password again to do this.* | AC-48.15 |
| 422 | The access summary with a `tz` that is not an IANA zone | *tz: {value} is not a time zone.* | AC-48.27 |

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
| The live tail | A database trigger notifies every insert into `events`; the engine fans it out to the streams Studio holds open — the counts stream ([CP-F08](../../../control/features/CP-F08-the-inbox/feature.md#mechanisms)) among them |
| The access summary | Composed on read, storing nothing: *people signed in* — people with a live refresh row ([AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md#engine)); *agents acting now* — runs queued or running ([CP-F10](../../../control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine)); *requests waiting* — open asks ([AC-F05](../AC-F05-asks-and-approvals/feature.md#engine)); *blocked today* — `GET /refusals`' `refused_today`; the timeline — the History rows of the last hour (below) |
| The timeline | From the History rows whose `at` falls in the last hour, by person or agent: an agent's entry names `behind_user_id` as whom it acts for. A row's layer maps to a timeline layer — `model` → `model`; `data` on one named graph database → `graph_database`, on Graph Data joined across them → `graph_data`; an act the `outside` preset counts → `outside`; other layers draw no bar. Rows of one actor, one timeline layer and one `touched` less than 60 s apart join one bar; a refused row is its own bar with `refused: true`. At most 20 actors are sent, the most recent first; `more_actors` counts the rest |
| Acting now, blocked today, delegations | Composed on read, storing nothing: *acting now* — people with a live refresh row and runs queued or running, each with when it last acted (below); *blocked today* — `GET /refusals`' rows; *delegations in force* — live keys ([AC-F10](../AC-F10-keys/feature.md#engine)), project keys among them, each with the person or project it acts for ([AC-F03](../AC-F03-directory/feature.md#engine)) |
| When one last acted | From that person's or run's writes and run starts only — never a sign-in, a token renewal or a read — as `now` (the last 2 minutes) · `within_15_min` · `today`. Nothing stores presence: no table, no event, never an address, a device or a user agent |
| Names are untrusted | Client, key, agent and rule names and `touched` are sent as data; a self-registered client carries `verified: false` and its `redirect_host` ([AC-F11](../AC-F11-connect-an-mcp-client/feature.md#rules)) |
| Reading the summary is recorded | The first read of the summary by an Admin in each clock hour writes `access.history.summary_read` and its History row; later reads in that hour write nothing |
| `tz` | Checked against the IANA zone list before anything is read; *today* is midnight to now in that zone |
| Revoke from an agent's Delegations | Calls the owning feature's revoke — `DELETE /api/v1/access/clients/{id}` or `DELETE /api/v1/access/keys/{id}` — with its password check; nothing is revoked here |
| *Your access* | The person's own policies and agents from `GET /api/v1/access/auth/me`, and their own clients and keys from the owning routes |
| Who reads `events` | The change list and the live tail, notification rules ([CP-F08](../../../control/features/CP-F08-the-inbox/feature.md#engine)), provenance ([RC-F06](../../../../capabilities/records/features/RC-F06-provenance/feature.md#engine)), a task's tree ([PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine)), the outbox relay that rebuilds the system graph, and traces — each a reading; none copies it |
| One writer of History | `record()` takes the last row under a row lock, sets `seq` and the hash, inserts. The Control Plane calls it for each step it settles and each refusal; delegation for each helper and refusal; every manager for each act a person, an agent, a key or an MCP client causes. Nothing updates or deletes a row |
| The hash chain | `hash = sha256(prev_hash ‖ canonical JSON of the row without actor_names)`; the first `prev_hash` is 64 zeros. Names live outside the hash, so pseudonymising a departed person changes `actor_names` and every row still verifies; who acted is proven by `actor_chain`'s ids. The shared clock tick ([AG-F07](../../../../capabilities/agents/features/AG-F07-schedules/feature.md#mechanisms)) re-verifies every 10 minutes from the last verified row into `access_history_checks`; `?full=` re-verifies from the latest checkpoint |
| What a reader of `events` gets | An Admin every event. Anyone else: events whose actor or `on_behalf_of_user_id` is them, and the change events of records they can open. Another person's `access.auth.*`, `access.keys.*`, `access.clients.*` and refusal events are never sent to them — on `GET /events` or on any stream fed by the live tail |
| What a reader sees | An Admin every row; anyone else their own acts and the rows of runs `may_read_run()` allows; the rest is counted as `hidden`. `args` is withheld on a row the reader sees but whose run they may not read — an Admin's too. Counts over the whole deployment need Read on `access/history` |
| Counts | Counts, per-day bars and top lists are SQL over the whole window; table rows read from the newest 20,000 |
| A change with no percentage | `acts_change_pct` is absent while the 7-day daily mean is under 10 acts |
| Export | `csv` or `jsonl` of the filtered rows with each row's hash and the previous one; a CSV cell that would run as a formula is written as text |
| Retention | History's period from [AC-F12](../AC-F12-leaving-and-keeping/feature.md#engine), none by default; skipped while History is on hold. A prune removes every row older than the period, a whole window, and in the same transaction writes an `access_history_checkpoints` row — the last removed `seq` and `hash`, signed — and its own History row; `events` keeps the same window |
| Verifying past a prune | A check starts from the latest checkpoint: its signature must verify under the ledger key of its `key_version`, and the first kept row's `prev_hash` must equal `last_removed_hash`; then the chain runs as before. A checkpoint that fails reads *broken at the checkpoint of {date}* |
| What a change is | A version-minting event of a skill, rule, workflow, agent, model or Access Policy, or a load — the versions stay where their owner keeps them; there is no change table. `?changes=true` narrows the event list to those events |
| Each kind's versions | `skill` — published versions, a number, `why` from the publish event, effect pinned (runs offered that version) · `rule` — its versions, a number, pinned · `workflow` — by name, a number, `why` from the approval event, pinned · `agent` — its create and update events, `details.diff {field: {before, after}}`, a number, pinned · `model` — published versions, a number, effect over the window it was published · `policy` — its saved versions, a number, `why` from the save · `load` — the load, its records added · removed · changed and rows failing |
| `ChangeEntry` | `version` (a string) · `version_id?` (null for an agent) · `at` · `action` · `event_id` · `actor_id` · `actor_kind` · `actor_name` · `why` · `summary` · `effect` |
| `ChangeEffect` | `basis` (`pinned` · `window`) · `runs` · `failed` · `tokens_in` · `tokens_out` · `tokens` · `tokens_per_run` · `since` · `until` · `loads[{load_id, name, rows_failing}]` · `rows_failing` — tokens only |
| `ChangeCompare` | `record_kind` · `record_id` · `a` · `b` · `summary` · `fields[{field, before, after, lines}]` (text as unified lines) · `records {added, removed, changed}` (a load's) · `workflow` (a workflow's, or a skill's whose versions drew workflows) · `schema_diff` (a model's) · `rules` (a policy's rules added, removed and changed) · `tokens_per_run_change` (`b` against `a`; null when either ran nothing) |
| `why` on a write that mints | An optional `why` (500 characters) on each owner's minting write lands in its event's `details.why`; none given stays empty |
| Read-only everywhere | The deployment's `/admin` console shows `events` and History rows read-only |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | The event store `events` and four History tables in Postgres; History kept until an Admin sets a period, each prune leaving a signed checkpoint | NFR-REL-4 |
| § 8 APIs and events | The `…/access/history` routes, the access summary among them; the event store is where every feature's events land, and its live tail feeds the counts stream | NFR-PERF-7 |
| § 9 Distributed execution | The one chain is re-verified on the shared clock tick; one writer under a row lock keeps `seq` gapless | NFR-PERF-3 |
| § 12 Qualities | Security: append-only, hash-chained, verified every 10 minutes from a signed checkpoint, credentials redacted before the write; arguments read only as run privacy allows; names outside the hash, so pseudonymising edits no proof | NFR-REL-4 · NFR-SEC-2 |

## Decisions

| Decision | Detail |
|---|---|
| History is one place | People's acts, agents' acts, refusals and changes are filters of one History — *Everything · People · Agents · Changes · Refused* — not four pages |
| Rows read today | Until a window is chosen — today · last 24 hours · 7 days · 30 days · any time; an export takes the same window |
| A preset chip names its window | *Refused today*, *Writes in the last 7 days* — each preset says its window, with the engine's count beside it |
| A row opens beside the list | Its detail opens over the right of History; the list still takes clicks, so another row moves it |
| Others read less, and are told | A person without Read on `access/history` sees their own acts and the runs they may read; a line counts what they cannot see. Counts over the whole deployment need Read on `access/history` |
| By an actor includes its helpers | Every row whose chain names the actor — helpers of one kind grouped as *Order checker ×4*, a delegated agent its own row |
| Who may read a record now | Read from Access Policies — the agents whose rules allow Read on the record's kind and graph database, and for which teams — never from History |
| A change shows no percentage on an empty week | The change in acts against the 7-day daily mean is absent while that mean is under 10 acts a day |
| Compare carries tokens per run | The compare reads *Tokens per run* of one version against the other, as the engine counted it |
| A model's change names its loads | A model version's effect lists the loads it touched and how many records fail |
| History lives in Access | History is read in Access › Record › History; the Admin's glance at access now is the header's Access dropdown; blocked today is History · Refused · Today and delegations are on the agent's page |
| Access is an Admin's glance | The dropdown is an Admin's alone; an Operator reads their own access under *Your access* in the avatar menu, and has no *Access* button |
| Delegations are clients and keys | What acts for a person or a project until a time is a connected client or a key; the agent's page lists keys, a project key with its project, and revokes through their own feature; connected clients join when AC-F11 is built |
| Events read as History does | The event list and its tail follow who may read what; presence and refusals are never rebuilt from them by anyone but an Admin |
| Last acted is coarse | *Now · within 15 min · today*, from writes and runs only — enough to catch access going wrong, never a record of a person's day |
| An Admin's look is recorded | Reading who is signed in leaves a History row, one per Admin per hour |
| Requests stay in the Inbox | The dropdown counts asks waiting; deciding them is the Inbox's |
| The dropdown shows touching, not lists | The Access dropdown draws what each person and agent touched in the last hour as a timeline, a row per actor and one layer a bar, a blocked act struck through; who acts, delegations and recent changes are read in History and Record |
| The engine sends the timeline | Actors, bars, layers and blocked counts are the engine's; Studio places the bars on the axis and derives nothing |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Editing or deleting a row | A correction is a new row; a whole window goes only by retention |
| Scheduled exports and an archive to the blob store | An export on demand is the proof now |
| A History CLI | The export is the portable form |
| A change table or a copy of versions | The versions already exist; a copy drifts |
| Currency in effect after | Tokens only |
| Restore from History | A restore is the record's own write, which makes a new version |
| Filling in a reason or a diff for old versions | An empty field is honest; an inferred one is not |
| Versions of boards and reports | A frozen reading, not a change to a definition |
| A chain per team or per graph database | One deployment, one chain; a filter narrows it |
| Sending History to an outside log tool | That belongs to the deployment's own platform |
| A switch to hide who is signed in | No present need; reading it is Admin only and recorded |
| A presence table or a presence event | Last acted is read from writes and runs already recorded |
