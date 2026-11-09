---
id: DS
title: Datasets
status: later
owner: Ravi
personas: [curator, modeller, admin]
---

# Datasets

> Gather data that is reusable across the install, labelled by where it came from, checked against standards, and
> added to a Graph by version.
> The decision it helps make: *which data, at which version, is fit to add to a Graph?*

Pillar: **Ontology** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

Data copied into each Graph by hand loses where it came from, who may use it and which version an answer rested on.
Nobody can retract a bad source or prove that a dataset meets the standard it claims.

## Users

| Persona | Comes here to |
|---|---|
| Data curator | Publish datasets and versions, label their origin and sensitivity, check them against standards |
| Modeller | Add a dataset version to this Graph and see what landed |
| Install admin | Retract a version, manage standards |

## Goals

| Goal | Measured by |
|---|---|
| Every record traces back to its dataset version and its authors | Open — set at the spec review |
| A retracted version flags everything that cites it | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| DS-F01 | [Datasets and their versions](features/DS-F01-datasets-and-their-versions/feature.md) | DS-01 · DS-02 · DS-03 · DS-12 · DS-14 · DS-17 | later |
| DS-F02 | [Bring data in](features/DS-F02-bring-data-in/feature.md) | DS-05 · DS-06 · DS-10 · DS-13 · DS-16 · DS-18 | later |
| DS-F03 | [Add a dataset to this graph](features/DS-F03-add-a-dataset-to-this-graph/feature.md) | DS-11 | later |
| DS-F04 | [Standards and checks](features/DS-F04-standards-and-checks/feature.md) | DS-07 · DS-08 · DS-09 · DS-15 | later |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Catalogue | modal | `data.catalogue` |
| Upload | modal | `data.upload` |
| Checks | modal | `data.checks` |
| Collect | modal | `data.collect` |
| A dataset | sheet | `data.dataset` |

## Decisions

| Decision | Detail |
|---|---|
| Parked | Datasets is `later`: v1 works on the records already in a Graph's graph database and on what people and agents write in Invana ([Data](../data/product.md)). Every feature and story here waits until it is taken up |
| Datasets are install-wide | A dataset sits above Graphs, named `publisher/name`; a Graph adds a version of it to one of its models |
| Core and experimental | Tables, versions, adding to a Graph and imports are core; collecting with an agent, observations, documents and standards are shown labelled *Experimental* |
| Invana is a destination | It does not extract: no source connectors, no cursors, no mapping grammar. What arrives already conforms to a model, or is rejected record by record |
| Records go into a model | A load names the one model its records conform to and belong to; the model is the container a person already thinks in. Two loads into one model are one body of data, matched by the model's keys; records that must not merge belong to another model |
| Provenance is model · record · file · run | Every node and relationship a load writes says what it conforms to, which record it was, which file it came in and which load wrote it — so an answer traces back to a dataset |
| Every load is a run | Validated or bulk, a load streams, retries, cancels and leaves a trace like any run; its kind says whether it checked anything |
| Two ways in, one version | A dataset version is made by *Upload* in the browser or by the import command; both mint the same version, and every dialog prints its command twin. Loads into a model from pipelines are the command line and the API |
| Datasets are tables and documents | A dataset is a versioned table from one source under one authorship; a documents dataset holds papers and notices |
| Versions are cited | A finding, an answer or an add to a graph cites an exact version; a fix is a new version, a withdrawn one is retracted |
| A dataset is written by its creator | Its creator or an install Admin publishes its versions, shares it, adds rows, attaches standards and fixes problems; anyone who can read it may export it, and someone who can shape a graph's model may add it there |
| Sensitivity is read by rules | Labels on a dataset and its columns are stored and served; rules on what a run may send read them once a rule names one |
| Registry seams | `publisher/name`, a content hash and references by version are what an open registry would need later |

## Depends on

| Product or capability | For |
|---|---|
| Model | The model a dataset conforms to |
| Data | The records a dataset version lands as, and their lineage back to it |
| Agents | Collecting data with an agent |

## Not building

| Item | Why not |
|---|---|
| Proprietary datasets · pricing · a marketplace | Datasets are reusable knowledge first |
| Provenance on every cell | Kept per dataset and per record; property changes live in the record's change log |
| An extractor | Invana is a destination; whatever pulls the data hands it over as a dataset |
| Inferring a model from a file | The dataset states its model; a guessed schema is one nobody chose |
| Streaming ingest | A batch with a report is what a person can audit |
| Deduplication or upsert heuristics | Identity comes from the model's keys, not a strategy setting |
| Sharing across installs · packing datasets as files | The open registry, later |
| Images, sequences, spectra | Each needs its own viewer |
