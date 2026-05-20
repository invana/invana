# Invana — System Design

> **Invana is a Graph Intelligence Operating System.**
>
> A platform where humans and AI collaborate inside *missions*, grounded in *knowledge graphs* that are stitched together from connector-ingested data and user-authored ontology, and reasoned over by agents and LLMs against the mission's declared objectives, goals, and success criteria.
>
> At its core, Invana does **context engineering for AI**: it turns scattered, heterogeneous data into curated, ontology-grounded, queryable context that agents and LLMs — inside or outside the platform — can reason over reliably.

This document describes Invana in terms of **what it is, who lives in it, and how work flows through it** — not schemas, APIs, or file layout. RFCs and module docs cite this document for vocabulary and flow; technical specifics live there.

---

## 1. What Invana is

Invana is an operating system for graph-shaped intelligence work — and, more concretely, a substrate for **context engineering**: producing the curated, grounded, queryable context that AI needs to be useful on real work.

The OS metaphor is load-bearing:

| OS concept            | Invana concept                                                |
|-----------------------|---------------------------------------------------------------|
| Workspace / desktop   | The user's account — holds global registries.                 |
| Project / window      | A **mission** — a bounded intent with its own knowledge graph.|
| Device drivers        | **Connectors** — typed adapters to external data sources.     |
| Filesystem            | **Graph models** — ontologies giving shape to ingested data.  |
| Processes             | **Agents** — workers that act inside a mission.               |
| Standard library      | **Skills** — reusable capabilities agents compose.            |
| Shell / REPL          | **LLMs** — the conversational interface to the graph.         |
| Application data      | The mission's **knowledge graph** — stitched, queryable.      |

A user opens a mission, declares what success looks like, points connectors at data, authors an ontology, and lets agents reason over the stitched knowledge graph. The mission tells the user when it has succeeded.

### 1.1 The use-case surface

Because Invana is an operating system — not a vertical tool — the same primitives (missions, connectors, graph models, skills, agents, LLMs) host a wide range of AI work. None of these are special cases in the platform; they are different *compositions* of the same primitives.

| Use case                        | How it composes in Invana                                                                                                       |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| **Context engineering for AI**  | Any mix of connectors + user ontology + stitching; the resulting knowledge graph is served as curated context to external agents/LLMs (IDE assistants, chat copilots, app backends) via query and retrieval. |
| **Coding agents**               | Git-repo connectors + code/AST skills + a code-aware LLM, reasoning over a repo-shaped knowledge graph.                          |
| **Deep search / research**      | Document connectors (PDF/DOCX/web) + entity-extraction skills, reasoning over a citation- and concept-linked knowledge graph.    |
| **Explainability**              | Any source + provenance-preserving stitcher + tracing skills; every answer is back-traceable to graph nodes and source records.  |
| **Analytics & BI**              | Tabular connectors (CSV/XLSX/MySQL) + aggregation skills, reasoning over a metrics-and-dimensions knowledge graph.                |
| **Knowledge management**        | Mixed connectors + a user-authored domain ontology; the stitcher unifies sources under shared concepts.                          |
| **Compliance & audit**          | System-of-record connectors + policy skills + read-only Closed-mission snapshots as durable audit artifacts.                     |
| **Decision support / simulation** | Graph + user ontology of decisions/actors/outcomes + simulation skills; agents propose and score interventions against success criteria. |
| **Customer / domain intelligence** | CRM / product / support connectors + user ontology of *Customer*, *Account*, *Risk*; agents synthesize across silos.            |
| **Personal AI workspace**       | File-system / notes / email connectors + user-authored personal ontology; private knowledge graph for grounding a personal LLM.   |

The list is not the platform — the primitives are. New use cases land by registering a connector, defining (or reusing) skills, binding them into a mission, and letting agents work. The OS does not need to know in advance what the mission is *about*.

---

## 2. Core concepts

This is the canonical vocabulary used everywhere else in the system.

- **User** — An identity that operates Invana. The first user is created via the CLI during bootstrap; all subsequent users are invited from the UI.

- **Mission** — A bounded intent. Every piece of intelligent work in Invana happens inside a mission. A mission has an explicit lifecycle: `Open` (active, ingesting, reasoning, mutable) or `Closed` (archived, read-only, inspectable). A mission holds instructions, bindings to global registries, and owns a knowledge graph.

- **Instructions** — The mission's contract with itself, declared up front and refined over time. Three parts:
  - **Objectives** — *what the mission is for.* Prose statements of intent.
  - **Goals** — *measurable targets* the mission is pursuing.
  - **Success Criteria** — *how we know the mission has succeeded.* Checkable conditions.

- **Skill** — A reusable, named capability ("summarize a document", "extract entities", "diff two graph snapshots"). Skills are global; missions opt-in to the skills their agents may use.

- **Agent** — An autonomous worker that, inside a mission, composes skills + connectors + an LLM to act. Agents are defined globally and bound into missions.

- **LLM Config** — A registered model endpoint with credentials, defaults, and guardrails. Global; missions select which LLM(s) their agents may speak to.

- **Connector** — A typed data-source adapter. Built-in examples: PDF / XLSX / CSV / DOCX / TXT readers, Git repository, MySQL importer. **Custom connectors** are first-class — anyone can register one. Each connector declares its inputs, outputs, and the shape of graph model it emits.

- **Task** — A single execution of a connector instance against a concrete target.

- **Pipeline** — An ordered or scheduled composition of tasks (sequence, fan-out, recurrence).

- **Dataset** — The output of a connector run. A dataset is the named pairing of (a) the **records captured** from the source and (b) the **system graph model** describing their shape. Connectors produce datasets; the stitcher consumes them. Re-running a task refreshes its dataset rather than producing a duplicate.

- **Graph Model** — The ontology describing node types, edge types, and their properties. Two flavors coexist in every mission:
  - **System Graph Model** — *derived automatically* by a connector and carried inside a **Dataset**. Reflects what was actually ingested.
  - **User Graph Model** — *authored by the user*. A semantic overlay describing the concepts the user wants to reason about, independent of data sources.

- **Knowledge Graph** — The live, queryable graph inside a mission. Produced by **stitching** the system graph model(s) with the user graph model and binding ingested data to that stitched ontology.

- **Stitcher** — The component that reconciles system and user models: maps system entity types to user ontology concepts, resolves identity across sources, and materializes the stitched knowledge graph.

---

## 3. Mental model — the layered OS

Invana is organized into eight conceptual layers. Each layer consumes only the layers below it.

```
┌──────────────────────────────────────────────────────────────────┐
│  8. Interfaces        CLI · Studio UI · API                       │
├──────────────────────────────────────────────────────────────────┤
│  7. Intelligence      Agents · LLM grounding · success scoring    │
├──────────────────────────────────────────────────────────────────┤
│  6. Knowledge Graph   Stitched, queryable graph per mission       │
├──────────────────────────────────────────────────────────────────┤
│  5. Modeling          User graph model · Stitcher                 │
├──────────────────────────────────────────────────────────────────┤
│  4. Ingestion         Tasks · Pipelines · Datasets (data + model) │
├──────────────────────────────────────────────────────────────────┤
│  3. Mission           Instructions · Bindings · Lifecycle         │
├──────────────────────────────────────────────────────────────────┤
│  2. Workspace         Global registries: Skills, Agents,          │
│                       LLM Configs, Connectors                     │
├──────────────────────────────────────────────────────────────────┤
│  1. Identity & Access Bootstrap · UI auth · Invites · Roles       │
└──────────────────────────────────────────────────────────────────┘
```

1. **Identity & Access** — bootstrap admin from CLI, UI authentication, invitations, role assignment.
2. **Workspace** — the global, reusable registries. Skills, Agents, LLM Configs, and Connectors are defined here once and bound into many missions.
3. **Mission** — where intent lives. Each mission picks what it needs from the workspace registries and declares its instructions.
4. **Ingestion** — connector tasks and pipelines pull data in; each run yields a **Dataset** (captured records + the system graph model describing their shape).
5. **Modeling** — the user authors a domain ontology; the stitcher reconciles it with the system models carried by the datasets.
6. **Knowledge Graph** — the stitched, queryable graph the mission reasons over.
7. **Intelligence** — agents, driven by an LLM and a skill set, grounded in the knowledge graph, evaluated against the mission's success criteria.
8. **Interfaces** — CLI, Studio UI, and API are projections of the layers below.

---

## 4. Flows

The system is best understood as a sequence of flows. Each flow names who triggers it, what happens, and what the user sees next.

### 4.1 Bootstrap — admin registration via CLI

An operator has just installed Invana on a host. There are no users yet.

1. Operator runs `invana init`.
2. CLI prompts for admin credentials and basic workspace details.
3. The system creates **the root user** and writes the initial workspace state.
4. CLI emits a first-login token / URL.

After bootstrap, the CLI **does not** register additional users. All subsequent users come in through UI-driven invitations issued by an authenticated user.

### 4.2 UI login

1. The admin (or an invited user) opens Studio and authenticates.
2. Studio fetches the workspace registries (Skills, Agents, LLM Configs, Connectors) and the user's missions.
3. The user lands in their mission dashboard.

### 4.3 Opening a mission

1. The user clicks **New Mission** → a mission is created in `Open` state.
2. The user gives it a name and declares its **instructions**:
   - **Objectives** — what the mission is for.
   - **Goals** — measurable targets.
   - **Success Criteria** — the conditions under which the mission can be marked done.
3. The mission now has: instructions, an empty knowledge graph, and no bindings yet.

### 4.4 Configuring the workspace (global settings)

These four flows happen at the workspace level, independent of any mission. They populate the registries that missions later draw from.

- **Skills** — the user registers (or authors) skills. Each skill declares what it does and when it should be used. Skills are reusable across all missions and agents.

- **LLM settings** — the user registers model providers (e.g., a hosted Claude endpoint, a self-hosted model), supplies credentials, sets defaults and guardrails (token budgets, allowed model families, etc.).

- **Agents** — the user defines agents by composing:
  - the **skills** they may use,
  - the **LLM** they speak to,
  - an operating policy (autonomy level, when they may fire, how they report).

- **Connectors** — the user enables built-in connectors (PDF / XLSX / CSV / DOCX / TXT readers, Git repo, MySQL importer, …) **and** registers **custom connectors** by describing each connector's:
  - inputs (what it needs to be pointed at),
  - outputs (what raw records it emits),
  - the shape of the **system graph model** it produces.

### 4.5 Binding workspace items into a mission

Global registries are inert until a mission binds them.

1. Inside an open mission, the user picks which Skills, Agents, LLM(s), and Connector instances the mission may use.
2. Bindings are explicit — a mission can only see what was bound to it. This is the unit of isolation between missions.

### 4.6 Running a connector — task or pipeline

1. The user configures a bound connector instance with a concrete **target** (a folder of PDFs, a Git URL, a MySQL DSN, …).
2. Executing it produces a **task**. Composing tasks (chain, fan-out, schedule) produces a **pipeline**.
3. Task execution yields a **Dataset** — the named output of the run, consisting of:
   - **Raw records** captured from the source.
   - A **system graph model** — automatically derived, describing what was ingested (entity types, relationships, properties).

The dataset is the unit that downstream layers consume; the stitcher reads from datasets, not directly from connectors. A connector's emitted system model is its honest description of the source — the user does not have to agree with its shape; that's what the user graph model and the stitcher are for.

Re-running the same task refreshes its dataset in place rather than producing a duplicate (idempotency, see §5).

### 4.7 Authoring a user graph model

At any point — before, during, or after ingestion — the user authors a **user graph model**: the domain ontology, the concepts the user wants to reason about (e.g., *Customer*, *Risk*, *Decision*, *Document*, *Repository*).

The user graph model has no data of its own initially. It is a **semantic overlay**: the user's view of the world, independent of which sources happen to feed it.

### 4.8 Stitching — datasets + user model → knowledge graph

The **stitcher** is what makes Invana more than a data pipeline. It takes the mission's **datasets** (each carrying its records and its system graph model) and reconciles them with the user model:

1. **Map** — each dataset's system entity types are mapped to user ontology concepts (a PDF dataset's `pdf:Document` may map to user's `Document`; a MySQL dataset's `customers` table may map to user's `Customer`).
2. **Resolve identity** — the same real-world entity appearing in multiple datasets is unified.
3. **Materialize** — the stitched view becomes the mission's working knowledge graph.

Stitching is idempotent: refreshing a dataset and re-stitching converges; it does not duplicate. The user can review and override stitching decisions.

### 4.9 The AI loop — interacting with the knowledge graph

This is what missions exist for.

A user asks a question, or an agent fires per the mission's policy. Either way the loop is:

1. The agent reads the mission's **instructions** — objectives, goals, success criteria.
2. The agent **plans** using the skills bound to the mission.
3. The agent **queries the knowledge graph** for grounded context.
4. The agent **calls the bound LLM**, prompting it with that grounded context.
5. The agent **returns an answer**, **takes an action**, or **writes back into the knowledge graph** (new entities, new relations, annotations).
6. Outputs are scored against the mission's success criteria. The mission knows whether it is progressing.

The LLM never reasons in a vacuum — it is always grounded by the knowledge graph, which is itself shaped by both connector reality and user intent.

### 4.10 Closing a mission

1. When the success criteria are met — or the user decides the mission is done — the user transitions the mission `Open → Closed`.
2. Closed missions are **read-only**: knowledge graph, conversations, task history, and agent runs remain fully inspectable. No new tasks fire, no agents run.
3. Reopening is an explicit action — it returns the mission to `Open` and re-enables ingestion and agents.

### 4.11 Serving the graph as context to an external agent

Missions are not only consumed by agents *inside* Invana. The same curated knowledge graph can be served as context to external agents and LLMs — IDE assistants, chat copilots, application backends, custom pipelines.

1. The mission owner issues a **scoped credential** (token or API key) authorising read-or-write access for a specific external client, bound to a specific mission.
2. The external client calls a **retrieval surface** over the knowledge graph: structured query (Cypher/Gremlin), semantic/vector lookup, or skill-mediated retrieval that returns ranked, grounded snippets.
3. Every response carries **provenance**: which graph nodes/edges answered the query, and through which ingested records and connector tasks they entered the graph. The external agent can cite back into the mission.
4. The external client may optionally **write back** — new entities, annotations, conversation traces — under the same authorisation. These writes are mission-scoped and follow the same idempotency and observability rules as in-mission writes.
5. Closing the mission freezes the external surface to read-only, in lockstep with §4.10.

This is the same loop as §4.9, but inverted: the *agent* lives outside, and Invana is the curated-context layer it grounds against.

---

## 5. Cross-cutting behaviors

- **Global registries, mission bindings.** Skills, Agents, LLM Configs, and Connectors live at the workspace level so they can be defined once, audited once, and reused everywhere. Missions are the unit of *use*; the workspace is the unit of *definition*. A mission only ever sees what it has explicitly bound — bindings are the isolation boundary between missions.

- **System model vs user model.** Both must exist. The system model is the source's honest description of itself; the user model is the user's honest description of the problem. Forcing either side to compromise produces brittle pipelines. Stitching is a first-class step, not an import detail, because that's where the two truths are reconciled.

- **Idempotency.** Re-running a task (refreshing its dataset), re-stitching, or re-binding should converge to the same state. Operations on the knowledge graph are designed to be safely repeatable.

- **Deletes.** Hard deletes only, with downward-only cascade. Lookup/association tables must never delete their parents.

- **Groundedness & explainability.** Every answer Invana surfaces is grounded in the mission's knowledge graph and traceable back to the records that produced it. The LLM reasons *over* facts; it does not invent them. When a question cannot be answered from the graph, the system says so — it does not generate plausible-sounding fillings. This is a contract, not a feature: an answer that cannot be traced through `LLM call → graph query → ingested record → originating dataset / task` is treated as a defect, not a quirk.

- **Observability.** Every task run, every agent invocation, every stitch decision is inspectable from within the mission. A user can always trace an answer back through the LLM call → graph queries → ingested records → originating connector task. Observability is what *operationally* enforces groundedness — without the trace, the contract is unverifiable.

- **Extensibility.** Custom connectors and custom skills are first-class citizens of the OS. The platform does not privilege built-in connectors over user-registered ones; they share the same registration, binding, and execution surface.

- **Generality before verticals.** Invana is a substrate, not a product for a single use case. Coding agents, deep research, analytics, explainability, knowledge management, and decision support are all expressed as the same composition: connectors → datasets → stitched knowledge graph → skills → agents → LLM. The platform does not hard-code any vertical; vertical experiences are built *on top of* the OS by choosing which primitives to compose.

---

## 6. What this document is not

- **Not an API spec.** Endpoints, request/response shapes, and protocols live in their own RFCs.
- **Not a database schema.** Tables, columns, and graph-store details live in implementation RFCs.
- **Not an implementation plan.** Sequencing, milestones, and module boundaries live in delivery docs.

This document is the shared mental model. When an RFC or module doc uses the words *mission*, *connector*, *dataset*, *system graph model*, *user graph model*, *stitcher*, or *knowledge graph*, it means them as defined here.
