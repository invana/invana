---
id: EX-08
title: Write the query myself
feature: EX-F03
status: idea
personas: [analyst]
boards: [explore.board, explore.queries]
---

# EX-08 · Write the query myself

**As** an analyst fluent in Cypher or Gremlin **I want** to type the query on one graph database in the assistant's
composer with the model at hand, and read its rows in the console **so that** nothing is out of reach — even what a
typed plan cannot express — and every query I run is still checked and recorded.

Tasks: [task.md](task.md) · Feature: [EX-F03](../../feature.md)

## Who can

A typed query runs as the built-in **Query console** agent: it reads, asks first before a write, and records every
query it runs ([AG-F02](../../../../../agents/features/AG-F02-the-agents-catalogue/feature.md)). It is granted like any
agent. It passes four layers — a static check, a read-only session, a result filter, and for Gremlin steps only —
which are [GP-05](../../../../../../os/graph/features/GP-F01-data/stories/GP-05-run-a-raw-query-within-what-the-agent-may-read/story.md)'s.

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Type and run read queries on any graph database the Query console may read; send a write, which waits on the Query console's approvers and runs only on a read + write graph database | A write to a read-only graph database: refused — *{name} is read-only — {why}* |
| Operator | Type and run read queries, with Run on `agent/query-console`; with Edit on `data/<graph database>`, also sends a write, as Admin | A write: refused — *Needs Edit on data/{graph database} — ask {who can grant}* ([permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)). Not granted the Query console: Cypher and Gremlin disabled — *Needs Run on agent/query-console — ask {who can grant}* |

## Flow

```mermaid
flowchart LR
  a([Composer · Cypher or Gremlin · a graph database]) --> g{May use the Query console?}
  g -->|no| ng["Disabled — ask an Admin"]
  g -->|yes| hd{"Do the person's policies hide anything on this graph database?"}
  hd -->|yes| hr["Refused · Raw queries are not available · Ask still works"]
  hd -->|no| t["Type · completions from the model"]
  t -->|⌘↵| p{Parses?}
  p -->|no| pe["The parser's message, at its position"] --> t
  p -->|yes| k{Only kinds the model has?}
  k -->|no| ke["Names the unknown one, and what the model has"] --> t
  k -->|yes| rd{Every kind readable by its policies?}
  rd -->|a policy hides it| ke
  rd -->|yes| ul{"Unlabelled pattern · Read on data/db/*?"}
  ul -->|no| ur["Refused — the rule named"]
  ul -->|yes| gs{"Gremlin: a script, lambda or eval?"}
  gs -->|yes| gr["Refused — the construct named"]
  gs -->|no| w{Writes?}
  w -->|yes| wa{Edit on the data · read + write database?}
  wa -->|no| wr["Refused — the permission or the mode named"]
  wa -->|yes| ask["Asks first · waits on the Query console's approvers"]
  ask -->|declined · expired| dx(["Refused · nothing written"])
  ask -->|approved| r
  w -->|no| r["Runs in read mode · elapsed time · Cancel"]
  r -->|zero rows| z["Graph Data does not hold this — an answer"]
  r -->|failed| f["The reply says why · the console opens on Log"]
  r --> fl["Result filter · what the agent may not read left out, with no trace"]
  fl --> ans(["Rows in the console · the answer in the thread · a ledger row"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-08.1 | A person who may use the Query console and a graph database that speaks Cypher | they open the ask kind and pick it | it offers Ask · Cypher, and not Gremlin |
| EX-08.2 | The ask kind on Cypher | the person types a node label | completions offer the kinds, relationship kinds and property keys the published model places in that graph database |
| EX-08.3 | A query in the composer | the person presses ↵ | a new line is added; ⌘↵ runs it, and the status bar names both keys |
| EX-08.4 | A query that does not parse | the person runs it | the parser's message is shown at its position and nothing runs |
| EX-08.5 | A query naming a kind or property the model lacks | the person runs it | it is refused before it runs, naming the unknown one and what the person can see of the model; a kind or property a policy hides is unknown the same way |
| EX-08.6 | A query with a write clause, from a person with Edit on its data, on a read + write graph database | the person runs it | it asks first: the run waits on the Query console's named approvers in the Inbox; approved, it runs; declined or expired, nothing is written and the reply says who decided |
| EX-08.7 | A read query that mentions *offset*, *settings* or a quoted *merge* | the person runs it | it runs, in a read-only session (GP-04), without asking |
| EX-08.8 | A valid query | it runs | the query and its outcome are turns in the thread, its rows are in the console's Data, and the call is recorded in *What left the platform* (AC-F09), naming the Query console and the person |
| EX-08.9 | A query that returns zero rows | it finishes | the reply says Graph Data does not hold this, as an answer, not an error |
| EX-08.10 | A slow query | it runs | the elapsed time shows with *Cancel* |
| EX-08.11 | A very large result | it runs | it is counted first, and capped with the cap stated |
| EX-08.12 | A query that fails in the graph database | it fails | the reply states the error's first line and *Open the log*; the console opens on Log at the failing step; the board is untouched |
| EX-08.13 | A person without Edit on the data | they run a query with a write clause | it is refused before it runs — *Needs Edit on data/{graph database} — ask {who can grant}* — and nothing is asked |
| EX-08.14 | A query with a write clause on a read-only graph database | the person runs it | it is refused before it runs — *{name} is read-only — {why}* — and nothing is asked |
| EX-08.15 | A query reading a kind the Query console's policies hide | the person runs it | it fails before it runs as an unknown kind, as in EX-08.5; nothing names the rule |
| EX-08.16 | A person not granted the Query console | they open the ask kind | Cypher and Gremlin are disabled — *Needs Run on agent/query-console — ask {who can grant}*; Ask still works |
| EX-08.17 | A query with a node or relationship pattern that has no label, and a Query console that may not Read `data/{graph database}/*` | the person runs it | it is refused before it runs, naming the rule — *An unlabelled pattern reaches every kind* (GP-05.3) |
| EX-08.18 | A Gremlin query with a Groovy script, a lambda or `eval` | the person runs it | it is refused before it runs, naming the construct — a Gremlin query is steps only; nothing is sent (GP-05.9) |
| EX-08.19 | A read whose result holds kinds or property levels the Query console may not Read | the person runs it | they are left out, never shown; neither the console nor the reply counts or names them (GP-05.7) |
| EX-08.20 | A read whose result is all left out by the person's policies | the person runs it | it reads as zero rows — *Graph Data does not hold this* — with no hint that anything was left out (GP-05.8) |
| EX-08.21 | Queries the person typed | they open Explore › Queries | their typed queries list newest first, each naming its graph database, its language and when it ran; opening one opens its conversation at that query |
| EX-08.22 | A person with typed queries who is not granted the Query console | they open Queries | their queries list; running one again is disabled — *Needs Run on agent/query-console — ask {who can grant}* |
| EX-08.23 | A graph database where the person's own policies, or the Query console's ceiling for a run an agent starts, hide anything — a Deny Read on a kind or a property, an entry of *Hidden from agents* included | the person types Cypher or Gremlin on it | it is refused before it runs with *Raw queries are not available on {graph database}*, naming no kind and no rule; Ask, which makes a typed plan, still works ([AC-27.27](../../../../../../os/access/features/AC-F02-access-policies/stories/AC-27-keep-a-kind-or-a-sensitive-property-from-agents/story.md)) |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The composer in a query | Admin | explore.board · Console · Empty query | — | explore.board · Console · Running | explore.board · Console | explore.board · Console · Query error | explore.board · Console · Write waiting on approvers | explore.board · Console · Write refused |
| The composer in a query | Operator | explore.board · Console · Empty query | — | explore.board · Console · Running | explore.board · Console | explore.board · Console · Query error | — | explore.board · Console · Write refused |
| A query refused before it runs | Admin | — | — | — | explore.board · Console · Query refused | explore.board · Console · Query refused | — | — |
| A query refused before it runs | Operator | — | — | — | explore.board · Console · Query refused | explore.board · Console · Query refused | — | explore.board · Console · Query console not granted |
| The rows in the console | Admin | — | explore.board · Console · Zero rows | explore.board · Console · Running | explore.board · Console · Rows | explore.board · Console · Log | — | — |
| The rows in the console | Operator | — | explore.board · Console · Zero rows | explore.board · Console · Running | explore.board · Console · Rows | explore.board · Console · Log | — | explore.board · Console · Query console not granted |
| Queries on the left | Admin | explore.queries · No queries yet | explore.queries · No query matches | explore.queries · Loading | explore.queries | explore.queries · Could not load | — | — |
| Queries on the left | Operator | explore.queries · No queries yet | explore.queries · No query matches | explore.queries · Loading | explore.queries | explore.queries · Could not load | — | explore.queries · Query console not granted |
