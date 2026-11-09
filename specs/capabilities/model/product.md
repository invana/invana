---
id: MO
title: Model
status: idea
owner: Ravi
personas: [modeller, curator]
---

# Model

> Give the Graph's data meaning: shape its models, link them, decide what agents may see and what must always hold.
> The decision it helps make: *what the data means, what agents may see and what must always hold?*

Pillar: **Ontology** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

Everything downstream — what can be asked, what can be loaded, what an agent is grounded in — resolves against the
models shaped here. One Graph binds to one graph database and holds many models, each named for its domain.

## Problem

A graph whose kinds nobody chose cannot be asked reliably: questions drift, loads break silently and agents see
everything. Without a model a person owns, publishes and can roll forward safely, nobody can say what the data means.

## Users

| Persona | Comes here to |
|---|---|
| Modeller | Shape, link and publish models; set views of the graph and rules |
| Data curator | See which model a dataset fits and what breaks it |

## Goals

| Goal | Measured by |
|---|---|
| A model is drafted for the person, from a database, files or a starter, never from a blank page | Open — set at the spec review |
| A breaking change never reaches the Graph unreviewed | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| MO-F01 | [Start a model](features/MO-F01-start-a-model/feature.md) | MO-04 · MO-06 · MO-15 | idea |
| MO-F02 | [Change and publish a model](features/MO-F02-change-and-publish-a-model/feature.md) | MO-05 · MO-08 | idea |
| MO-F03 | [Link and share models](features/MO-F03-link-and-share-models/feature.md) | MO-01 · MO-02 · MO-03 · MO-16 | idea |
| MO-F04 | [Model health and history](features/MO-F04-model-health-and-history/feature.md) | MO-07 · MO-09 | idea |
| MO-F05 | [Views of the graph and what must always hold](features/MO-F05-views-of-the-graph-and-what-must-always-hold/feature.md) | MO-10 · MO-11 · MO-13 | idea |
| MO-F06 | [Rules agents work by](features/MO-F06-rules-agents-work-by/feature.md) | MO-12 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| The model map — Map · Health · History | mode | `model.board` |
| A kind | peek | `model.board.kind` |
| A draft and its publish | mode · modal | `model.board.draft` · `model.board.draft.publish` |
| Health and history | mode | `model.health` |
| A new model · export and import | modal | `model.new` |
| Rules and views | sheet | `model.rules` |

## Decisions

| Decision | Detail |
|---|---|
| Model owns meaning | Models, links between models, property constraints, views of the graph and rules live here; datasets and loads live in Data; the Graph's connection and members live in Settings |
| One Graph, one graph database | Set once; the database kind cannot change after the first save, since everything modelled is against it |
| Models are per domain and portable | A Graph holds many; they meet only through declared links between models |
| A published version never changes | Changes publish the next version; answers and loads that used an older one still resolve to it |
| The whole model is derived | Every published model and its active links, computed when read and never stored — it is what every question is grounded in: its kinds, properties, their descriptions and its active links. What the database holds is compared against it and never grounds an answer |
| Declared, never inferred | A link between models is declared by a person; linking never merges records |
| Reading the database only drafts | It never writes a published version |
| A breaking publish needs a review | A change that only adds publishes; one that breaks goes through a preview, another owner's yes, then the run that publishes (MO-F02) |
| What bounds what | A *constraint* bounds one property's values, in a model, checked when a record is written, loaded or checked · a *view of the graph* narrows what a run may see, picked per question, on the Graph · a *rule* says what must always hold — on the install, a Graph or a project, checked when it applies; a rule on what a run may see, use or send is checked while the run runs, on the Graph or an agent |
| Rule scope | A rule is scoped to the install, a Graph or a project; the install is the widest scope |
| Standards are Data's | A constraint references a standard's values; standards are authored in Data |
| What a run may see, use and send | Declared before it runs, proved after: every run records what it read, what it called and what it was refused, so a person narrows or widens by reading the difference — the edit is to the view or the rule, never to the plan |
| Narrowing is enforced, never filtered | A hidden kind or property is left out of what the AI model is told and refused by the database's connector; a slice is composed into the query that runs. Nothing is dropped after it comes back |
| Composed once, at run open | The Graph's rules on properties, the agent's own bound and the run's view are composed when a run opens — a load included, with no view — and frozen on it. A view from another Graph is refused before the run is written |
| Deny wins at any level | A narrower allow never punches through a broader deny. Across the Graph, the agent and the work, allows intersect and denies add up |
| Reading is not sending | A query may filter on a property whose value never enters a prompt — used to compute, not to reason. What may leave is said per destination, on the rule that reached it |
| An outside service is allowed or denied whole | It carries no slice; data worth slicing is brought in as a model |
| The internet is an outside service | A search and each fetched site are addresses a rule can allow or deny; what an AI model adds from its own knowledge is off unless the rule on that AI model allows it |
| A plan names a role, the view names the model | A plan says *decide* or *extract*; the view says which AI model plays it, checked against the rules |
| A refusal is an answer | A refused source is recorded and the run carries on without it; a run refused the AI model it thinks with, or the model version it is grounded on, ends *cannot answer* naming the rule — never an error |
| A write is governed like a read | Loading into a model is checked against the same rules before it writes; one rule decides both, and a refused target writes nothing |
| Who edits views and rules | *Can shape the model* — which an owner has — so every Graph has someone who may; *Everywhere* rules are the install Admin's |
| Semantic imports, in order | Invana keeps its own model and every import maps into it: SKOS (in Data), then RDFS and an OWL subset with schema.org, then SHACL, then GQL graph types. Import only — source addresses kept on every kind make export cheap later |

## Depends on

| Product or capability | For |
|---|---|
| Graph › This graph | The connection to the graph database |
| Data | The datasets loaded into a model, and the standards constraints name |
| Access | The approval a breaking publish waits for |

## Not building

| Item | Why not |
|---|---|
| A model registry | A model exports as one file; files and git are the registry |
| Inferred links between models · merging linked records | Links are declared, never guessed; a merge is lossy with no undo |
| A Graph over several databases | The Graph is the reasoning boundary, and one boundary is one database |
| Writing records from Model | The model describes; loads write |
| OSI (Open Semantic Interchange) | It standardises BI metrics, not graph models |
| Ontology reasoning and inference | Open-world reasoning does not fit validation that rejects what is not allowed |
| An ontology editor | Protégé and similar tools already do it; Invana imports |
| A second record for what a run was allowed | Every fact is on the view, the rule or the run's own trace; a parallel store can disagree with the trace |
| Automatic switching to a cheaper AI model | A silent switch changes what produced an answer; changing the view is a person's recorded act |
