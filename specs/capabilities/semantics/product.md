---
id: SE
title: Semantics
status: idea
owner: Ravi
personas: [modeller, curator, researcher, investigator]
---

# Semantics

> Everything Graph Data means, published as one versioned contract — drafted, reviewed, then published: its
> models, their meaning, taxonomies, standards, links and mappings, rules and derived facts.
> The decision it helps make: *what does the data mean, and what must always hold?*

Pillar: **Ontology** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

Everything downstream — what can be asked, what can be loaded, what an agent is grounded in, what is derived — resolves
against the contract shaped here. The deployment holds many models across its graph databases, each named for its
domain.

## Problem

A graph whose kinds nobody chose cannot be asked reliably: questions drift, loads break silently and agents see
everything. Without a contract a person owns, publishes and can roll forward safely — what each kind means, which
terms and standards it follows, what must always hold and what may be derived — nobody can say what the data means.

## Users

| Persona | Comes here to |
|---|---|
| Modeller | Shape, link and publish models; give kinds their meaning; set rules and derivations |
| Data curator | Keep the standards and value hierarchies a model's properties are held to; see what breaks them |
| Researcher | Reuse the standards and taxonomies a field agreed, so results are comparable and citable |
| Investigator | Write the rules and alerts that notice a pattern in the records |

## Goals

| Goal | Measured by |
|---|---|
| A model is drafted for the person, from a database, files, a standard or a starter, never from a blank page | Open — set at the spec review |
| A breaking change never reaches Graph Data unreviewed | Open — set at the spec review |
| Every derived fact names the rule and the facts it came from | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| SE-F01 | [Start a model](features/SE-F01-start-a-model/feature.md) | SE-04 · SE-06 · SE-15 | idea |
| SE-F02 | [Change and publish a model](features/SE-F02-change-and-publish-a-model/feature.md) | SE-05 · SE-08 | idea |
| SE-F03 | [Meaning](features/SE-F03-meaning/feature.md) | SE-20 | idea |
| SE-F04 | [Taxonomies](features/SE-F04-taxonomies/feature.md) | SE-21 | idea |
| SE-F05 | [Standards](features/SE-F05-standards/feature.md) | SE-17 · SE-18 | idea |
| SE-F06 | [Links and mappings](features/SE-F06-links-and-mappings/feature.md) | SE-01 · SE-02 · SE-03 · SE-16 | idea |
| SE-F07 | [Rules](features/SE-F07-rules/feature.md) | SE-12 · SE-13 · SE-19 | idea |
| SE-F08 | [Inference](features/SE-F08-inference/feature.md) | SE-22 | idea |
| SE-F09 | [Lenses of the graph](features/SE-F09-lenses-of-the-graph/feature.md) — parked | SE-10 | later |
| SE-F10 | [Health and history](features/SE-F10-health-and-history/feature.md) | SE-07 · SE-09 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Models — the list and the map; one model · its links | mode | `model.models` · `model.models · Detail` |
| Kinds — the list; a kind · Properties · Meaning · Standards | mode | `model.kinds` · `model.kinds · Detail` · `model.kinds · Detail · Meaning` |
| Relationships — the list; a relationship on its model | mode | `model.relationships` · `model.relationships · Detail` |
| A draft and its publish | mode · modal | `model.models · Draft` · `model.models · Publish` |
| Taxonomies — broader kinds and value hierarchies | mode | `model.taxonomies` |
| Standards — the install's library; a standard; a new one | mode · modal | `model.standards` · `model.standards · Detail` · `model.standards · New` |
| Health and history | mode | `model.health` |
| A new model · export and import | modal | `model.models · New` · `model.models · Export` · `model.models · Import` |
| Rules — rules on kinds, requests | mode | `model.rules` |
| Derivations and derived facts | mode | `model.inference` |

## Decisions

| Decision | Detail |
|---|---|
| Semantics owns meaning | Models, meaning, taxonomies, standards, links and mappings, constraints, derivations, act rules and derived-fact rules live here; records and loads live in Records; graph databases and their connections live in the Control Plane |
| One contract, one lifecycle | Every part is changed only as a draft, reviewed when it breaks something, and published as the next version; what used an older version still resolves to it |
| A kind lives in one graph database | Set once; the graph database cannot change after the first save, since everything modelled is against it |
| Models are per domain and portable | The deployment holds many; they meet only through declared links and mappings |
| A published version never changes | Changes publish the next version; answers and loads that used an older one still resolve to it |
| The whole model is derived | Every published model, its meaning and its active links, computed when read and never stored — it is what every question is grounded in. What the database holds is compared against it and never grounds an answer |
| Declared, never guessed | A link or a mapping is declared by a person, or proposed by an agent and accepted by a person; linking never merges records |
| Reading the database only drafts | It never writes a published version |
| A breaking publish needs a review | A change that only adds publishes; one that breaks goes through a preview, an approver's yes, never the requester's, then the run that publishes (SE-F02) |
| What bounds what | A *constraint* refuses data that breaks it, checked when a record is loaded or changed · a *derivation*, written only in Inference, adds facts · an *act rule* blocks, warns on or reports what people and agents do, enforced by Access · an *alert* notices a pattern and opens a lead in a project · what a person or an agent may see is never a rule here: it is an Access Policy ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md#property-access)) |
| Rule scope | A rule is scoped to *Everywhere* — the deployment — or a project |
| Standards are install-wide | A standard is kept once in the install's library and held by a kind or a property of any model (SE-F05) |
| Broader kinds are meaning only | A kind may name a broader kind; storage and queries stay flattened — each kind carries its own properties (SE-F04) |
| Inference is rule-based | Derivations run as a queue worker, rule-based only; each derived fact is stored as a record labelled *derived*, with its rule and premises (SE-F08) |
| What a run may see, use and send | Declared before it runs, proved after: every run records what it read, what it called and what it was refused, so a person narrows or widens by reading the difference — the edit is to the Access Policy, never to the plan |
| Narrowing is enforced, never filtered | A hidden kind or property is left out of what the AI model is told and refused by the database's connector; a slice is composed into the query that runs. Nothing is dropped after it comes back |
| Composed once, at run open | The policies that reach the run — the project's, each agent's ceiling and the person's — are composed when a run opens, a load included, and frozen on it |
| Deny wins at any level | Across the deployment, the agent and the work, a narrower allow never punches through a deny ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md#rules)) |
| Reading is not sending | What may leave Invana is the outbound check — confidential and personal values never leave — and *Outside Invana* on the destination ([AC-F09](../../os/access/features/AC-F09-what-left-the-platform/feature.md)); a property an agent may not read is hidden from it altogether ([AC-F02](../../os/access/features/AC-F02-access-policies/feature.md#property-access)) |
| An outside service is allowed or denied whole | It carries no slice; data worth slicing is brought in as a model |
| The internet is an outside service | A search and each fetched site are addresses a rule can allow or deny; what an AI model adds from its own knowledge is off unless the rule on that AI model allows it |
| A plan names a role, the agent names the model | A plan says *decide* or *extract*; the AI model pinned on the agent plays it, checked against the agent's Access Policies |
| A refusal is an answer | A refused source is recorded and the run carries on without it; a run refused the AI model it thinks with, or the model version it is grounded on, ends *cannot answer* naming the rule — never an error |
| A write is governed like a read | Loading into a model is checked against the same rules before it writes; one rule decides both, and a refused target writes nothing |
| Who edits | Shaping a model is the Modeller's and the Admin's ([the role table](../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)); a shipped pack and an index suggestion are the Admin's alone |
| Outside formats are imported | Invana keeps its own contract and every import maps into it: SKOS, OWL/RDFS with schema.org, SHACL and CSV code lists, each by its own importer (SE-F05 · SE-15). Import only — source addresses kept on every kind and term make export cheap later |

## Depends on

| Product or capability | For |
|---|---|
| Settings › Connections › Graph databases | The connections to the graph databases |
| Records | The loads checked against a model, the records rules and derivations read, and where derived facts are kept |
| Access | The approval a breaking publish waits for, and the enforcement of act rules |
| Control Plane | The queue worker that runs derivations |

## Not building

| Item | Why not |
|---|---|
| A model registry | A model exports as one file; files and git are the registry |
| Merging linked records | A merge is lossy with no undo; a person merges two records in Graph Data |
| Writing records from Semantics | The contract describes; loads write, and derived facts are written by Inference into Records |
| OSI (Open Semantic Interchange) | It standardises BI metrics, not graph models |
| Full OWL DL reasoning in core | Only as an outside plugin; rule-based inference is SE-F08 |
| An ontology editor | Protégé and similar tools already do it; Invana imports |
| A second record for what a run was allowed | Every fact is on the policy or the run's own trace; a parallel store can disagree with the trace |
| Automatic switching to a cheaper AI model | A silent switch changes what produced an answer; changing the agent's AI model is a person's recorded act |
