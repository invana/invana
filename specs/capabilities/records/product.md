---
id: RC
title: Records
status: idea
owner: Ravi
personas: [analyst, curator, modeller]
---

# Records

> The instances of the models and how each got there — every node and relationship, each a record of a kind in a
> published model: bring them in, browse them, see which break the model, fix and merge them, trace each value to
> what wrote it, and keep what people say about them.
> The decision it helps make: *which records can be trusted, and what must be fixed before anyone relies on them?*

Pillar: **Intelligence** — the facts gathered, checked and traceable ([Pillars and capabilities](../../vision.md#pillars-and-capabilities))

## Problem

A model says what the data should be; nothing shows what it is. Records that break the model, duplicates and
silent fixes stay hidden until an answer rests on them, and nobody can say who changed a value or which load it came
from.

## Users

| Persona | Comes here to |
|---|---|
| Analyst | Browse the records of a kind, read one record whole, read and manage annotations |
| Data curator | Bring records in, see what breaks the model, fix many records at once, merge duplicates, trace a value to what wrote it |
| Modeller | See how the records sit against a model they are changing |

## Goals

| Goal | Measured by |
|---|---|
| Every record that breaks its model is found before an answer rests on it | Open — set at the spec review |
| No value is silent: each names the load, edit, person or agent that wrote it, and when | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| RC-F01 | [Records by kind](features/RC-F01-records-by-kind/feature.md) | RC-01 | idea |
| RC-F02 | [Bring records in](features/RC-F02-bring-records-in/feature.md) | RC-08 · RC-09 · RC-10 · RC-11 | idea |
| RC-F03 | [Quality against the model](features/RC-F03-quality-against-the-model/feature.md) | RC-02 · RC-12 | idea |
| RC-F04 | [Bulk fixes](features/RC-F04-bulk-fixes/feature.md) | RC-03 | idea |
| RC-F05 | [Merge duplicates](features/RC-F05-merge-duplicates/feature.md) | RC-04 | idea |
| RC-F06 | [Provenance](features/RC-F06-provenance/feature.md) | RC-05 · RC-06 | idea |
| RC-F07 | [Annotations](features/RC-F07-annotations/feature.md) | RC-07 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Records — by kind | modal | `data.records` |
| A record — Values · Provenance · History · Annotations | sheet | `data.record` |
| Bring records in — upload, add by hand, every load and what it rejected | modal | `data.upload` · `data.collect` |
| Quality — what breaks the model and the standards | modal | `data.quality` |
| A fix across records — preview and run | modal | `data.fix` |
| Merge two records | modal | `data.merge` |
| Annotations — every annotation in the Graph | modal | `data.annotations` |

## Rules

| Rule | Detail |
|---|---|
| Structured data only | A record is only ever imported into a model: a load takes rows that conform to one kind of one model, and every value lands in a property that kind declares. Nothing else becomes a record |

## Decisions

| Decision | Detail |
|---|---|
| Records are the instances of the models | Every node and relationship in the Graph's graph database, each a record of a kind in a published model. Scope is the Graph |
| Semantics says what should be; Records shows what is | Semantics owns kinds, constraints, standards and rules; Records reads records against them. Semantics' health compares a model with what the database holds, kind by kind; Records' quality is record by record |
| Records come in three ways | What the connected graph database already holds; a load into one model by upload, CLI or API ([RC-F02](features/RC-F02-bring-records-in/feature.md)); and what people and agents write in Invana — a board's save, a fix, a merge |
| A load is the citable anchor | Each load has a stable id, its file's content hash and a licence field, and exports with its provenance. Findings, reports and simulations cite a load; undoing a load flags everything that cites it with a *load undone* notice |
| Every write is a run | A load, a fix, a merge or a board's save is one recorded run, checked against the published model and Semantics' rules before it writes; the engine refuses what the model does not allow, record by record |
| Derived facts are records | Facts that inference adds (SE-F08, [Semantics](../semantics/product.md)) are stored as records labelled *derived*, each naming its rule and premises; the rules that produce them stay in Semantics |
| Provenance reads History | Who wrote each value is read from the Graph's one append-only event store, owned by [AC-F06](../../os/access/features/AC-F06-history/feature.md) and filtered to the record — never a second store |
| Annotations are instances of a built-in model | An annotation is a record of the built-in *Annotation* kind, kept by Invana, never in the customer's graph database. Explore creates them while investigating; Records keeps and manages them ([RC-F07](features/RC-F07-annotations/feature.md)) |
| Merging is chosen, never inferred | A person picks the records that are one; Invana never decides two records are the same |
| Screen words | *Records* and *Load* are on screen; *instance* is a vision and docs word |

## Depends on

| Product or capability | For |
|---|---|
| Semantics | The published kinds, keys, constraints, standards and rules every record is read and loaded against |
| Explore | Creating annotations and editing records on a board |
| Access | History, filtered to one record (AC-F06) |
| Control Plane | Workers that run each load (CP-F03) |

## Not building

| Item | Why not |
|---|---|
| A dataset catalogue · dataset versions · dataset licences · retraction · a registry | A load is the citable unit; the records are the Graph's, not a second catalogue beside them |
| Adding a dataset to a graph | Records are loaded into one model of one Graph; there is no install-wide copy to add |
| Datasets collected by an agent | An agent that gathers facts writes them through a load or a run like anyone else |
| Unstructured data — documents, papers, notices, free-text files | A record is a row that conforms to one model's kind; text without that shape is not a record. Something outside Invana extracts the rows first |
| Scheduled imports | The customer's pipeline calls the CLI or the API on its own schedule |
| Inferring that two records are one | Identity comes from the model's keys and a person's choice, never a guess |
| Writing annotations into the graph database | They are Invana's; a read-only database can still be annotated |
| A second change log per record | A record's history is History, filtered to it |
| Editing a record's kind or keys in place | A record that needs another kind or key is a model change, made in Semantics |
