# Operate — module spec

Running the thing: what happened, what it cost, what is scheduled, and what may be reached from
outside. Every write in the product is an event here, and every actor is a principal — which is what
makes "who recommended what, citing what, on behalf of whom" answerable.

> ⚠ **Rewritten for [orchestration § 0](../../orchestration.md#0-the-records)** — `Todo` · `Flow` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [§10 · Operate](../../README.md#10--operate) |
| Features | [schedules](features/schedules.md) · [notifications](features/notifications.md) · [approvals](features/approvals.md) · [audit-and-activity](features/audit-and-activity.md) · [observability](features/observability.md) · [external-agent-api](features/external-agent-api.md) · [see-what-ran](features/see-what-ran.md) · [change-log](features/change-log.md) |
| Depends on | every module emits into it |
| Depended on by | [Memory](../memory/spec.md) (evidence reads the record) |

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Event** | one append-only fact: actor, verb, target, time | a log line |
| **Activity** | events assembled into a tree for one subject | a feed |
| **Schedule** | an agent and instructions on a cron, with where the result is delivered | a background job |
| **Firing** | one occurrence of a schedule, recorded whether it ran or not | a run |
| **Notification rule** | which events reach whom, on which channels | an alert |
| **Channel** | a place outside the inbox to send to — email · Slack · webhook | the inbox |
| **Notification** | one row in one person's inbox | an event |
| **Delivery** | one send to one channel, with what was sent | a notification |
| **Approval** | something waiting to leave Invana until a named person decides | a verdict |
| **Scoped token** | credentials for an external agent, limited to named reads | an API key |
| **Runs** | the journal of every run in the Graph, children nested | a feed, a job queue, or Activity |
| **Chain** | a run and every run delegated beneath it | a workflow |

## 2. Every write is an event

```mermaid
flowchart LR
    W[Any write<br/>graph · model · skill · task · agent · import] --> E[(events<br/>append-only)]
    E --> A[Activity tree<br/>per task, per agent, per Graph]
    E --> L[Live tail]
    E --> EV[Evidence · Memory]
    E --> R[Retention]
```

| Rule | Detail |
|---|---|
| Append-only | Events are never edited or deleted; retention removes whole windows, never single rows |
| Actor is a principal | `user · agent · system · external · anonymous`, with `on_behalf_of` when they differ |
| Causality is kept | `parent_event_id` links a spawned action to what caused it |
| Sensitive fields are redacted at write | Credentials never reach the record, not even encrypted |
| One record, many readings | Audit, activity, evidence and observability all read this; none of them copies it |

## 3. Schedules

One kind: an agent and instructions on a cron, opening a run per firing, delivered when the run
settles ([schedules](features/schedules.md)).

```mermaid
flowchart LR
    C[The clock · one tick] --> F[Due schedules → firings → runs]
    C --> D[Settled scheduled runs → inbox + deliveries]
    C --> M[New events → rules → inbox + deliveries]
    C --> A[Approvals → reminder at half-time · expired at the deadline]
    C --> S[Pending deliveries → sent · retried · failed]
```

| Rule | Detail |
|---|---|
| A firing is recorded even when it does nothing | Skipped by an overlap or missed-firing policy is a firing with a stated reason |
| Missed firings follow the schedule's policy | `catch_up` once · `run_all` · `skip` |
| Outward deliveries wait for an approval | Unless the schedule switches it off; never auto-approved |

## 4. What this module owns

| Owns | Shape |
|---|---|
| `events` | append-only: actor principal, `on_behalf_of`, verb, target, payload, `parent_event_id`, time |
| `schedules` · `schedule_firings` | agent · instructions · cron · zone · missed and overlap policy · delivery · per-firing outcome |
| `notification_rules` · `notification_channels` · `notifications` · `notification_deliveries` · `notification_cursors` | who hears what, where; each inbox row; each send; how far the clock has read `events` |
| `approvals` | what waits to leave, its approvers and deadline |
| The clock | one loop per engine process: schedules, deliveries, rules, approvals ([NT1](features/notifications.md#decisions)) |
| Metrics | per query and per LLM call: latency, tokens, cost, errors — derived from the record |
| `api_tokens` | scoped tokens for external agents, with their allowed reads |
| Retention | how long task_runs, steps, emissions and events are kept, and what a purge removes |
| The runs journal | a reading of [Ask](../ask/spec.md)'s `todos` · `task_runs` · `task_runs` — Operate owns the *surface*, never the tables ([see-what-ran](features/see-what-ran.md)) |

## 5. Observability

| Question | Answered by |
|---|---|
| What is slow? | query latency per graph, per model, per step kind |
| What costs? | tokens and spend per agent, per project, per day |
| What fails, and where? | error rates by step and by failure kind |
| Is the budget going? | spend against each agent's ceiling, before it is reached |

Metrics are **derived from the record**. There is no second pipeline to disagree with it.

## 6. The external surface

| Rule | Detail |
|---|---|
| Read, with provenance | An external agent gets records and where they came from — never a bare answer |
| Scoped | A token names what it may read; anything else is refused, not filtered silently |
| Recorded as a principal | External calls appear in activity like any other actor |
| Never a write path | Imports are CLI and API with their own contract; the external surface does not write |

## 7. Cross-feature decisions

| # | Decision |
|---|---|
| O1 | Every write emits an event. Append-only, with the acting principal and `on_behalf_of`. |
| O2 | Audit, activity, evidence and observability are readings of one record, not copies of it. |
| O3 | One kind of schedule: an agent and instructions on a cron. Whether a firing creates work is the run's business, not the schedule's. |
| O4 | A firing that did nothing is still recorded, with the reason. |
| O5 | External access is read-only, scoped, and carries provenance. |
| O6 | Retention removes windows, never individual rows — history must stay coherent. |
| O7 | There is one journal of runs in a Graph — **Runs**. Imports and a Task's `Runs` tab are filters of it, not second implementations. |
| O8 | Runs lists **runs**; Activity lists **writes**. Neither is derived from the other. |
| O9 | **The Graph's Activity page is the shell's, at `/u/:user/:graph/activity/<tab>[/:id]`** ([shell.md › Activity](../../../products/shell.md#activity)). It has seven tabs in this order: Inbox · Approvals · Runs · Schedules · Events · Rules · Channels. The tab is a path level, so it is also a crumb. **Runs** is the journal ([O7](#7-cross-feature-decisions), [10.5](features/see-what-ran.md)) and **Events** is the Graph's writes ([O8](#7-cross-feature-decisions), [10.2](features/audit-and-activity.md)). They keep separate tabs, and neither is derived from the other. A tab whose engine records do not exist yet draws the kit's `EmptyState`, saying what it will hold, with one `EmptyStateLock` per thing that unlocks it. It never draws a table with no rows. The page fills `mainSection`, the left, right and bottom regions close, and `leftNav` stays. The bare `/activity` opens Runs, the first tab with records. The header's bell opens Inbox, from any screen inside a Graph |
| O10 | **Everything that happens later happens on one clock.** Schedules, deliveries, notification rules and approval deadlines are steps of one `tick(now)`, each idempotent on a unique key, so a restart or a second engine process repeats nothing ([NT1](features/notifications.md#decisions)). |
| O11 | **Nothing leaves Invana without a person** unless a schedule's owner switched it off for that schedule. An approval is never auto-decided; at its deadline what it held is *expired, not sent* ([AP1](features/approvals.md#decisions)). |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| A separate metrics pipeline | it would drift from the record it claims to describe |
| Editable or deletable events | an audit trail that can be edited is not one |
| On-call routing, escalation chains, quiet hours | a notification rule names its people and channels; paging policy is a monitoring platform's job |
| External write access | writes have contracts; a general write API has none |
| Per-user activity feeds | activity is per subject — a task, an agent, a Graph |
| A *job* concept | a run is a **TaskRun** and its parts are child runs of **Tasks**; a third word would name the same row twice |
| Retry or re-run from the journal | a run is re-opened where it was started, with its own inputs |
