---
id: DA
title: Data
status: idea
owner: Ravi
personas: [analyst, curator, modeller]
---

# Data

> The Graph's records — every node and relationship, each an instance of a kind in a published model: browse them,
> see which break the model, fix and merge them, trace where each came from, and keep what people say about them.
> The decision it helps make: *which records can be trusted, and what must be fixed before anyone relies on them?*

Pillar: **Ontology** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

A model says what the data should be; nothing shows what it is. Records that break the model, duplicates and
silent fixes stay hidden until an answer rests on them, and nobody can say who changed a record or where it came from.

## Users

| Persona | Comes here to |
|---|---|
| Analyst | Browse the records of a kind, read one record whole, read and manage annotations |
| Data curator | See what breaks the model, fix many records at once, merge duplicates, trace a record to what wrote it |
| Modeller | See how the records sit against a model they are changing |

## Goals

| Goal | Measured by |
|---|---|
| Every record that breaks its model is found before an answer rests on it | Open — set at the spec review |
| No change to a record is silent: each names who made it, in which run, and why | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| DA-F01 | [Records by kind](features/DA-F01-records-by-kind/feature.md) | DA-01 | idea |
| DA-F02 | [Quality against the model](features/DA-F02-quality-against-the-model/feature.md) | DA-02 | idea |
| DA-F03 | [Bulk fixes](features/DA-F03-bulk-fixes/feature.md) | DA-03 | idea |
| DA-F04 | [Merge duplicates](features/DA-F04-merge-duplicates/feature.md) | DA-04 | later |
| DA-F05 | [Lineage](features/DA-F05-lineage/feature.md) | DA-05 | idea |
| DA-F06 | [Record history](features/DA-F06-record-history/feature.md) | DA-06 | idea |
| DA-F07 | [Annotations](features/DA-F07-annotations/feature.md) | DA-07 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Records — by kind | modal | `data.records` |
| A record — Values · Lineage · History · Annotations | sheet | `data.record` |
| Quality — what breaks the model | modal | `data.quality` |
| A fix across records — preview and run | modal | `data.fix` |
| Merge two records | modal | `data.merge` |
| Annotations — every annotation in the Graph | modal | `data.annotations` |

## Decisions

| Decision | Detail |
|---|---|
| Data is the Graph's records | Every node and relationship in the Graph's graph database, each an instance of a kind in a published model. Scope is the Graph; Data sits in the Ontology pillar beside Model |
| Model says what should be; Data shows what is | Model owns kinds, constraints and rules; Data reads records against them. Model's health compares a model with what the database holds, kind by kind; Data's quality is record by record |
| Records come from the Graph's database and from Invana's own writes | v1 reads what the connected graph database holds and what people and agents write in Invana — a board's save, a fix, a merge. Loading files is [Datasets](../datasets/product.md), later |
| Every write is a run | A fix, a merge or a board's save is one recorded run, checked against the published model before it writes; the engine refuses what the model does not allow |
| A record's history is History | What changed a record is read from the Graph's one append-only History, filtered to the record — never a second store |
| Annotations are instances of a built-in model | An annotation is a record of the built-in *Annotation* kind, kept by Invana, never in the customer's graph database. Explore creates them while investigating; Data keeps and manages them |
| Merging is chosen, never inferred | A person picks the records that are one; Invana never decides two records are the same |
| Screen words | *Data* and *Records* are on screen; *instance* is a vision and docs word |

## Depends on

| Product or capability | For |
|---|---|
| Model | The published kinds, keys and constraints every record is read against |
| Explore | Creating annotations and editing records on a board |
| Datasets | Lineage back to a dataset version, once Datasets is taken up |

## Not building

| Item | Why not |
|---|---|
| Inferring that two records are one | Identity comes from the model's keys and a person's choice, never a guess |
| Writing annotations into the graph database | They are Invana's; a read-only database can still be annotated |
| A second change log per record | A record's history is History, filtered to it |
| Editing a record's kind or keys in place | A record that needs another kind or key is a model change, made in Model |
