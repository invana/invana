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

Product spec: [IN · Inbox](../../../../specs/foundation/inbox/product.md) — its features IN-F01–F03 hold the stories, rules and product decisions of this module. This file keeps the domain words, the engine shape and the rows other products have not moved yet.

System design: [operate.md](../../../../specs/system-design/modules/operate.md) — every write is an event, schedules and the clock, the tables it owns, observability. This file keeps the vocabulary, the decisions and what it does not build.

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

## 7. Cross-feature decisions

| # | Decision |
|---|---|
| O3 | One kind of schedule: an agent and instructions on a cron. Whether a firing creates work is the run's business, not the schedule's. |
| O4 | A firing that did nothing is still recorded, with the reason. |
| O9 | **The Graph's Activity page is the shell's, at `/u/:user/:graph/activity/<tab>[/:id]`** ([shell.md › Activity](../../../products/shell.md#activity)). It has seven tabs in this order: Inbox · Approvals · Runs · Schedules · Events · Rules · Channels. The tab is a path level, so it is also a crumb. **Runs** is the journal ([O7](#7-cross-feature-decisions), [10.5](features/see-what-ran.md)) and **Events** is the Graph's writes ([O8](#7-cross-feature-decisions), [10.2](features/audit-and-activity.md)). They keep separate tabs, and neither is derived from the other. A tab whose engine records do not exist yet draws the kit's `EmptyState`, saying what it will hold, with one `EmptyStateLock` per thing that unlocks it. It never draws a table with no rows. The page fills `mainSection`, the left, right and bottom regions close, and `leftNav` stays. The bare `/activity` opens Runs, the first tab with records. The header's bell opens Inbox, from any screen inside a Graph |
| O10 | **Everything that happens later happens on one clock.** Schedules, deliveries, notification rules and approval deadlines are steps of one `tick(now)`, each idempotent on a unique key, so a restart or a second engine process repeats nothing ([NT1](features/notifications.md#decisions)). |

## 8. Deliberately absent

| Not built | Because |
|---|---|
| External write access | writes have contracts; a general write API has none |
