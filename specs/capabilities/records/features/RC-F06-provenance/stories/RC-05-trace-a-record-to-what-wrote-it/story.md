---
id: RC-05
title: Trace a record to what wrote it
feature: RC-F06
status: idea
personas: [analyst, curator]
boards: [data.record]
---

# RC-05 · Trace a record to what wrote it

**As** an analyst **I want** to see what wrote each value of a record — which load, edit, person or agent, in which
run, and when — and trace a loaded value back to its file **so that** I know whether to trust it.

Tasks: [task.md](task.md) · Feature: [RC-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read any record's provenance and open its loads and runs | — |
| Operator | Read the provenance of any record their default agent may read; open loads and runs they may read. A Modeller the same | A run they may not read is named, not opened; a value at a level their agent may not Read: *Withheld — your agent may not read {resource}* |

## Flow

```mermaid
flowchart LR
  a([A record › Provenance]) --> v["Each value: what wrote it · when"]
  v --> l{Written by?}
  l -->|a load| ld(["The load · file · content hash · licence · run"])
  l -->|an edit, a fix or a merge| r(["The run · who · when"])
  l -->|inference| dv(["Derived — the rule and its premises"])
  l -->|nothing in Invana| d(["Present in the database before Invana"])
  v -->|a run not readable| na["Named, not opened"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| RC-05.1 | A record whose values were written by a load and later edited on a board | *Provenance* opens | each value names what wrote it — the load or the board's save — the person or agent, the run and when; the run opens from it |
| RC-05.2 | A value a load wrote | the person opens its load | it names the load's id, file, content hash, licence and run |
| RC-05.3 | A value inference added | *Provenance* opens | it is labelled *derived*, naming its rule and premises |
| RC-05.4 | A record Invana never wrote | *Provenance* opens | it reads *Present in the graph database before Invana wrote to it* |
| RC-05.5 | A value whose load was undone and a later write kept | *Provenance* opens | it names the later write and flags the load *load undone* |
| RC-05.6 | A run by an agent the Operator may not read | *Provenance* opens | the run is named, not opened |
| RC-05.7 | Provenance cannot be read | the tab opens | *Could not load provenance* shows with *Try again* |
| RC-05.8 | A value saved from a simulation's result | *Provenance* opens | it is labelled *derived*, naming the run it came from and the loads that run was pinned to |
| RC-05.9 | A property whose level the person's default agent may not Read | *Provenance* opens | the value reads *Withheld — your agent may not read {resource}*, with the resource in Access Policies' grammar; what wrote it and when stay readable, and the count of withheld values shows |
| RC-05.10 | A copy of a record's values — an answer, a finding, a report, a snapshot, a note or an export | someone asks where it came from | its sources are the records and loads this provenance names, recorded as lineage ([GP-F02](../../../../../../os/graph/features/GP-F02-memory/feature.md#engine)); provenance is where a value came from, lineage what a copy was read from |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A record · Provenance | Admin | — | — | data.record · Loading | data.record · Provenance | data.record · Could not load | — | — |
| A record · Provenance | Operator | — | — | data.record · Loading | data.record · Provenance | data.record · Could not load | — | data.record · Run not readable |
| A record · Provenance, a value withheld | Admin | — | — | — | data.record · Provenance · Redacted | — | — | — |
| A record · Provenance, a value withheld | Operator | — | — | — | data.record · Provenance · Redacted | — | — | data.record · Provenance · Redacted |
