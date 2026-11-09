# The ledger

Every act by a person or an agent in a Graph — who, through which agents, what it touched, allowed or
refused — as one append-only log whose rows hash the one before. It changes nothing; it is read by row,
by actor, by record and by refusal, and exported with its hashes.

| | |
|---|---|
| Index | [10.9](../../../README.md#10--operate) · Slice **F05** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [audit-and-activity](audit-and-activity.md) (events — the writes) · [see-what-ran](see-what-ran.md) · [the-run-page](../../agents/features/the-run-page.md) · [approvals](approvals.md) (alert rules read the ledger) · [govern spec](../../govern/spec.md) (touches, the per-run stream) · products: [agent-fabric.md](../../../../products/agent-fabric.md) AF-14 |

Product spec: [IN-F03 · History](../../../../../specs/foundation/inbox/features/IN-F03-history/feature.md) — IN-02; the story, its criteria, journey, states and product decisions live there. This file keeps the Studio layout and the engine shape.

## Surfaces

| Surface | Shape |
|---|---|
| `agents.ledger` | `/agents/ledger` — `SectionPage` *Ledger* with `append-only` · `hash chain verified HH:MM · 365 days kept` in the head and *Export*; tabs Rows · By actor · By record · Refusals · Export; filters in the URL (`?f.since=` · `?f.actor=` · `?f.act=` · `?f.layer=` · `?f.run_id=` · `?f.verdict=`) |
| `agents.ledger.entry` | `?row=<id>` — the row drawer: a kit `FloatingPanel` over the right of the open workbook page (Rows, or a run's Ledger tab), inside `mainSection`; *Open step in run #N* opens the run's page on Stages with `&step=<step_run_id>` |
| `agents.ledger.actor` | `/agents/ledger/actor?actor=agent:<id>&since=7d` |
| `agents.ledger.record` | `/agents/ledger/record?address=graph/Airport:LHR&since=30d` |
| `agents.ledger.refusals` | `/agents/ledger/refusals` |
| `agents.ledger.export` | `/agents/ledger/export` |
| `agents.ledger.member` | the Rows tab signed in as a member |
| A run's Ledger tab | the Rows table with `f.run_id` |

## Engine

| Thing | Shape |
|---|---|
| `ledger_rows` | `id` · `graph_id` · `seq` (per Graph, from 1, unique) · `at` · `actor_kind` (`person · agent · system`) · `actor_user_id` · `actor_agent_id` · `actor_chain` `[{kind, id, name}]` · `act` · `layer` (`graph · web · llm · secret · agent · run · lens · access · rule`) · `touched` · `touched_line` · `verdict` · `refused_by` · `rule` · `run_id` · `step_run_id` · `run_number` · `where` · `args` · `hash` · `prev_hash` |
| `ledger_exports` | `id` · `graph_id` · `requested_by_id` · `filters` · `format` · `rows` · `created_at` |
| `ledger_checks` | `graph_id` (key) · `verified_at` · `ok` · `last_seq` · `broken_seq` |
| Writer | `invana.core.ledger.record(db, …)` — the one writer: takes the Graph's last row under a row lock, computes `seq` and the hash, inserts. Called by the interpreter for every step it settles and every touch it refuses, by delegation for every spawn, escrow return and refusal, and by `emit_event` for every event a person or an agent causes |
| Hash | `sha256(prev_hash + canonical JSON of the row's content fields)`, hex; the first row's `prev_hash` is 64 zeros |
| `GET …/ledger` | `Page[LedgerRowRead]` on the list contract; filters `since · actor · act · layer · run_id · verdict · refused_by`; `hidden` — rows the reader may not see, counted |
| `GET …/ledger/stats` | tiles and preset counts for `since` (default today) |
| `GET …/ledger/{id}` | `LedgerRowDetail` — the row, its chain of custody, the rule, `around[]` (two before, two after in its run), `verified` |
| `GET …/ledger/actor` | `?actor=agent:<id>|person:<id>&since=` → `LedgerActorRead` |
| `GET …/ledger/record` | `?address=&since=` → `LedgerRecordRead` with `can_see` |
| `GET …/ledger/refusals` | `LedgerRefusalsRead` — tiles, `by_day[30]`, `top_functions[]`, `by_rule[]` (`refused_by` the badge · `rule` as stored · `the_rule` the bound in words · `refused` over 30 days · `today` · `what` · `who`) |
| `GET …/ledger/export` | `?format=csv|jsonl` + the Rows filters → the file; records a `ledger_exports` row |
| `GET …/ledger/exports` | `Page[LedgerExportRead]` on the list contract, newest first; `?format=csv·jsonl` |
| `GET …/ledger/integrity` | `{verified_at, ok, last_seq, broken_seq, retention_days}` |

## Decisions

| # | Decision |
|---|---|
| LG1 | **The ledger is one table, written by one function.** `core.ledger.record` is the only writer; nothing updates or deletes a row. The per-run `task_stream` stays the run's own record and `run_touches` its projection; a ledger row is the Graph-wide fact that an act happened. |
| LG4 | **Rows hash the one before.** `hash = sha256(prev_hash ‖ canonical JSON)`, `seq` per Graph; the writer takes the Graph's head under a row lock so two writers never fork the chain. |
| LG5 | **The chain is re-verified every 10 minutes** by the activity clock, from the last verified row on; the result is `ledger_checks` and the head reads it. A full re-verify runs on demand from the integrity route. |
| LG17 | **Every tile is counted in SQL over the whole window.** By actor, By record and Refusals count their tiles, per-day series and grouped counts in the database; only table rows, the lines beside them and the distinct people and agents are read from the newest 20,000 rows |
| LG18 | **A preset chip names its window** — *Refused today*, *Writes in the last 7 days* — with the engine's count beside it; the applied-filters strip keeps the filter's own word (`showing refused`) |
