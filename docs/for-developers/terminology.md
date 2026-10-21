# Terminology

The product's words, pinned. Every module spec, every screen and every API name uses these — and only
these. If a word is not here, it is not ours.

## How a feature is named

**A feature is named for what a person does. A term is named for what the thing is.** Two registers,
and the index gets the verb.

`The roster` named the table an agent lands in — a word the product no longer uses at all ([AG12](modules/agents/features/author-an-agent.md)). `Bindings` named the join row. `Envelope validation`
named the check. Every one of them had the plain words sitting right beside it in its own description
column — *"Author an agent"*, *"Which agent may be offered which skill"* — so the index said the
implementation and the description said the product.

| Rule | |
|---|---|
| The name is a **verb phrase** | *Author an agent* · *Bring data in* · *Offer a skill to an agent* · *Promote a plan*. If it reads as a noun, it is probably the table |
| Or a **plain statement of the moment** | *When it cannot answer* · *Inspect what landed* · *How many run at once*. These are fine: they name a situation a person is in, not an object |
| The **object keeps its noun here** | Envelope, budget, binding, lineage, library, projection, emission are all real things with precise meanings. They live in this file and in the code. They are just not what the feature is *called* |
| A **defined term may keep its name** | where the noun *is* the concept and renaming it would cost precision — `Rules`, `Projections`, `Delegation`, `Stitch models`. Plainness never buys vagueness |
| **A feature's path follows only when the word goes** | a rename changes display names, and the feature file's slug stays: nobody reads it, and moving it breaks every link that points at it. It moves only when the product stops using the word altogether, as *roster* did ([AG12](modules/agents/features/author-an-agent.md)) — and then every link is fixed in the same commit |


## How a module is named

**A module is named for the records it holds — a plural noun — and has that one name in the docs,
in Studio and in the engine.** `modules/<group>/<module>/` · `features/<module>/` · `apps/<module>/`
and `server/<module>/`. The full map is [module-structure.md](module-structure.md) §2 and §3.

| Rule | |
|---|---|
| A **plural noun** | `models` · `agents` · `runs` · `lenses` · `plans` · `projects`. Never a verb phrase — *bring data in*, *connect and model*, *operate* name what a person does, which is a feature's register, not a module's |
| **Singular** only for one surface or a mass noun | `explorer` · `assistant` · `memory` · `setup` · `runtime` · `tooling` · `design` |
| A **qualifier stays** where the word needs it | `graph-connectors` — *connector* alone is never ours ([§8](#8-words-we-do-not-use)). The engine's `graph/connectors/` keeps its name |
| **One name, three layers** | a Studio folder, an engine app and a docs module that name one thing name it the same way. A band (`core`, `runtime`, `activity`) keeps its own name; a module whose records live in one takes only `server/<module>/` |
| The **`leftNav` label may differ** | the label says what a person does there, the module names what it holds: *Govern* → `lenses`, *Library* → `plans`, *Model* → `models` |
| A **group** orders the docs | *Data · Exploration · Answers · Work · Orchestration · Governance · Platform* — a folder level in `docs/for-developers/modules/` only |
| A **feature number is permanent** | it moves with the feature file and is never reused — `5.1` is providers-and-models wherever it lives, like a decision ID (`SR7`) |

## 1. The overloaded word

**Graph** means three different things in this product, so only one of them gets the bare word:

| Say | For | Never say |
|---|---|---|
| **Graph** | the bounded domain a user creates — connection, models, datasets, agents, work | "workspace", "mission", "atlas" |
| **graph database** | the Neo4j / Memgraph / JanusGraph the Graph binds to | "the graph" |
| **canvas** | the rendered, pannable drawing of nodes and edges — the *surface*, never the saved record (that is a **Board**) | "the graph view" |
| **model** | the schema: node types, edge types, property keys | "the graph schema" when a user can see it |

## 2. The container and what it holds

| Term | Means |
|---|---|
| **Graph** | The bounded domain and the reasoning boundary. An agent never crosses it. One Graph binds to exactly one graph database. |
| **Graph settings** | The Graph's own configuration, in four tabs: **Basic** · **Graph** (the connection) · **LLMs** (the providers) · **Agents** (the ceiling). Nothing else is settings. |
| **Rule** | One statement that is always true, scoped `install`, `graph` (an **invariant**) or `project` (a **working** rule). Offered to steps; a rule with a **check** is also enforced `block · warn · report` at the acts the check names. [6.4](modules/skills/features/rules.md) |
| **Library** | The **definitions** a run is built from: reusable **plans**, the closed **catalogue** of callables, and projection **templates**. One `leftNav` item, three sections ([G41](building-studio/graph-detail-page.md)). It widens the older sense of *the library*, which named the plan list alone. Never the journal — that is **Runs**. |
| **Skill** | A playbook an agent may be offered — named, described, with a "when to use". Offered, never forced. |
| **Versioned record** | A record whose published form is immutable, so a change mints a new **version**: a skill, a rule, a plan, an agent, a model, a dataset. A draft is not a version. [10.6](modules/operate/features/change-log.md) |
| **Change log** | Every version of every versioned record — who, when, why, the diff, the effect after. It is the Events list narrowed to the events that mint a version, never a second record. A **change** is one such event. Never "audit log" for this narrower list, never "revision history". |
| **Instructions** | A skill's or agent's `instructions.md` — the prose a person writes and owns. A plan is generated from it; nobody draws one. [6.5](modules/skills/features/instructions-publish-rollback.md) |
| **Packaged plan** | A plan that ships with Invana or a plugin pack, `origin = packaged`: seeded, read-only. The other two origins are `generated` and `promoted`. [6.5](modules/skills/features/instructions-publish-rollback.md) |
| **Eval set** | A skill's or agent's fixed questions, each with **checks**: rule checks are hard and counted; a **judged** score comes from a pinned judge model and is labelled, never mixed with them. [6.6](modules/skills/features/evals.md) |
| **Pin** | An exact model version name an agent, skill version or judge thinks with — `claude-opus-5-5`, never an alias. Moving one is a change. [5.9](modules/agents/features/pinned-model-versions.md) |
| **Graph connector** | The package that speaks to one graph database — `invana-neo4j`, `invana-janusgraph`. Always qualified. |
| **Setup** | The *sequence* a Graph walks from created to answering — four required steps and two optional ones, derived from facts and never ticked. [13.7](modules/platform/features/setup.md) |
| **Onboarding wizard** | The *surface* that walks it: the stepper and the selected step's lesson, on the graph page. Reopened any time from the graduation cap in `header.right`. Setup is the state; the onboarding wizard is where you walk it. Never "the setup wizard", never "the tour", never "onboarding flow" |
| **Setup step** | One of them. `done · next · todo · blocked · skipped · broken`. |
| **Gate** | A group of setup steps, named for what it unlocks: **Connected** · **Grounded** · **Answering**. |
| **Ready** | A Graph whose required setup steps are done. It can be asked a question. The word in the UI is **ready** — never "graduated", "complete", "live" or "onboarded". *Graduation* is the onboarding cap's metaphor and nothing else: it names no state, no badge and no API field |
| **Member** | Someone with access to a Graph. A member reads everything in it. |
| **Graph role** | What a member may change: `viewer` (ask) · `contributor` (projects, tasks) · `builder` (agents, skills, evals) · `modeller` (models, rules, guardrails) · `owner` (members, settings). A member holds a set; `owner` implies the rest. In UI copy *role* alone is fine; in code it is `GraphRole`, because a run's `role` is another thing. |
| **Install Admin** | The person who administers the install — install rules, standards, any dataset, retraction. `is_superuser` in code. Never a way into a Graph. |

## 3. Models and data

| Term | Means |
|---|---|
| **Domain model** | A model authored against a domain, not a Graph — so it exports, imports and upgrades. One published version at a time. |
| **Draft** | An unpublished model version. Authoring happens here; published versions are read-only. |
| **Publish review** | What a **breaking** publish goes through: a preview **migration run**, then another owner's **approval**, then the migration run that publishes. An **additive** change publishes without one. Breaking means removed or narrowed, never added. [1.9](modules/connect-and-model/features/publish-review.md) |
| **Migration run** | The run a publish review is: `model-migration@1`. Previewing, it counts what a breaking change touches and which records would fail; applied, it publishes the version and lists the records that fail. **It never rewrites a record.** [1.9](modules/connect-and-model/features/publish-review.md) |
| **Anchor** | A declared link saying two types are the same entity (`Publisher.code ≡ Sponsor.publisher_code`), resolved by a key on each side. It links; it never merges. |
| **Relationship link** | A declared cross-model edge type (`Article -[MENTIONS]-> Drug`). Its endpoints come from a key on each side *or* from a dataset — never both. Never inferred. |
| **Global model** | The read-time union of every published model plus its links. Derived, never stored, never edited. The **widest** grounding context — what a run sees when no lens narrows it. |
| **Lens** | What a run may **see**, **use** and **send** — pinned for one run and frozen onto it. It narrows **five layers**: `graph data` (model versions, stitches, datasets, and slices of them), `llm` (which models, bound to roles by a **cast**), `third party` (apps, APIs, databases, peer agents — and what may be sent to each), `cache` and `human`. One record with two jobs, told apart by `kind`: a **guardrail** is pinned on the Graph or an agent and always in force; a **world** is named and picked per question. Naming an unnamed lens is what shares it. Never "scope" — `rules.scope` is a different thing; never "ground" — *Grounded* is a setup gate. [govern/spec.md](modules/govern/spec.md) · [orchestration § 0.9](orchestration.md#09-grounding-a-run--the-lens) |
| **World** | A **named** Lens — a reusable narrowing people pick per question and compare. Never a *subgraph*, which is an [emission](#4-asking-and-answering). |
| **Guardrail** | A Lens pinned on the Graph or an agent, always in force, on its own surface. A world narrows it and can never widen it. Not a permission on a person. |
| **Layer** | One of five classes of participant a run may engage. Never a **lane**, which is one parallel element of a fan-out. |
| **Participant** | One named member of a layer, addressed `<layer>/<sublayer>/<name>` — `llm/anthropic-prod/claude-opus-5`. |
| **Cast** | The binding of a plan's **role** (`extract` · `decide` · `judge` · `embed`) to a model address. A resolution, not a bound — the rules are what narrow. |
| **Touch** | One recorded engagement with a participant: address, direction, volume, and what was sent. Not a log line. |
| **Stitch** | The act of declaring that two published models meet, and the Studio surface that holds them — a section in the Model view panel. An anchor and a relationship link are the two kinds of stitch. **Declared stitches are read-time and write nothing**, which is what lets a [lens](#3-models-and-data) exclude them. The `stitch` *step inside an import* is a different act — it writes edges, and no lens can un-write one. |
| **Physical** | The introspected mirror of what the database actually holds. |
| **Query shape** | A query with its literal values replaced by parameters — a thousand calls of one generated query are one shape. What the model page's Performance tab groups by. Not a saved query. |
| **Records** | Externally produced data, conforming to exactly one model, handed to Invana. They are the model's — there is no record between the model and its data ([BD16](modules/bring-data-in/spec.md)). |
| **Dataset** | Tables from one source under one authorship, install-wide — above Graphs. Named `publisher/name`; its versions are immutable and hashed; a Graph **binds** a version into one of its models. Carries an **origin** (`official · collected · generated · observed · derived`), an author chain, a licence and sensitivity labels. [2.4](modules/bring-data-in/features/datasets.md) |
| **Retracted** | A dataset version withdrawn with a reason — kept, never deleted, and everything citing it is flagged. [2.5](modules/bring-data-in/features/retract-and-refresh.md) |
| **Standard** | A versioned, install-wide set of terms, each with a type, whether it is required, and its allowed values; a pack or org-authored. A dataset **claims** one pinned version. [2.7](modules/bring-data-in/features/standards.md) |
| **Conformance** | A dataset version's score against a standard it claims — conforming records over all — with its violations. [2.7](modules/bring-data-in/features/standards.md) |
| **Semantic import** | Reading a published vocabulary or ontology (JSON-LD, Turtle, RDF/XML) into Invana's own records: a **SKOS** concept scheme becomes a standard, an **RDFS/OWL** ontology becomes a draft model. Never a load of records — that is an **import run**. [2.8](modules/bring-data-in/features/skos-import.md) · [1.10](modules/connect-and-model/features/ontology-import.md) |
| **Import report** | What a semantic import says back: what mapped, what was **skipped and why**, the notes (flattened inheritance, merged ranges) and, for an ontology, the stitch **suggestions** a person confirms. The preview and the real import return the same one. |
| **Source IRI** | The IRI a standard's term or value, or a model's type or property, was imported from. Kept on the record; never its identity. |
| **Import run** | One load of a dataset — a **TaskRun** of a TaskPlan with `kind = import`. It inherits the runtime, trace, retries and failure vocabulary. |
| **Bulk run** | One `invana loader` load — a TaskRun of a `kind = bulk` plan with a single `bulk_write` Task. Validated per record and traceable to a source record is what an **import** is; a bulk run is neither, and the kind is what says so. |
| **Bundle** | A folder of datasets that belong together, with `stitches.json` naming them and the rules between them. Loading one is a workflow, not a new kind. |
| **Validation report** | Per-record accept/reject with reasons. Rejects are never silent. |

## 4. Asking and answering

| Term | Means |
|---|---|
| **Todo** | What a person wrote — the only thing a user authors. Prose, criteria, an optional assignee and due date. It has no status of its own: its state derives from its runs, and only acceptance is stored. [§6](#6-work) |
| **TaskPlan** | A flow of Tasks — the thing that carries a Todo out. Three origins: `generated` · `packaged` · `promoted`; `authored` is read on older rows, never written. A **reusable** TaskPlan is what the product calls a **workflow**. |
| **Task** | One node inside a TaskPlan: `callable` · `composite` · `human`. **Never a thing a user authors** — a Task cannot exist outside a plan. Users see *step*; the record is a `Task`. |
| **Step** | A Task in the role of a child — the authoring format writes `steps:`. A role, not a second record. |
| **TaskRun** | One execution. Its `role` says what the execution is for: `execute` · `plan` · `evaluate`. A delegated child is a TaskRun carrying `parent_run_id`. The word is now literal — a run is a TaskRun. |
| **Kind** | What a TaskPlan is *about*: `ask · import · bulk · stitch · model · enrich`. The subject, and what the journal filters on. Never *how* it executes — that is `form` on a Task — and never *what the run is for* — that is `role`. |
| **Catalogue** | The closed set of callables a plan may name by `step_key`, grouped by the bound each spends. Closed is the point: a planner that could invent a callable could escape any ceiling. [orchestration § 0.6](orchestration.md#06-the-catalogue--what-a-plan-may-name) |
| **Emission** | One thing a step produced — a subgraph, table, metric, chart or prose block. An answer is its emissions. |
| **Run frame** | One frame of a TaskRun's stream: a Task transition, a reasoning line, an emission arriving. `TaskStream` is the log of them, and its `seq` is the resume cursor. |
| **Session** | A named thread of asks, assigned to an agent. It references Todos; it is not one — a conversation never runs and has no outcome. |
| **Clarification** | A pause *inside* a Task: the agent does not know something and asks, with options. Its answer is an **answer**. A `role=plan` run raises one rather than guessing an ambiguous instruction. |
| **Approval** | A pause *before* a Task is dispatched: the agent may not proceed alone. Its answer is a **decision** — approve · reject. Nothing has been spent, and **only a person may answer one**. The same record holds anything about to leave Invana — a schedule's delivery to a channel — until a **named approver** decides; at its deadline it is *expired, not sent*, never approved ([10.8](modules/operate/features/approvals.md)). |
| **Verdict** | A pause *after* a pass produced output: the agent may not judge its own work. Its answer is a **verdict** — accept · revise, with a note bound into the next pass. The pass is already paid for, so it is bounded by `max_iterations` **and** a deadline. [13.8 §10](modules/platform/features/runtime.md) |
| **Iteration** | One serial pass of a `loop` node. Distinct from a **lane** (one parallel element of a fan-out) and an **attempt** (one retry of a failure). All three nest, and each is its own row. |
| **Cannot answer** | The graph does not hold it. Deliberately not answer-shaped, and distinct from a failure — and distinct from **outside the lens**, which names a setting the user can widen. |
| **Lens** | See [§3](#3-models-and-data). What a run may **see**, as an envelope is what it may **do**. |
| **Diagnosis** | What a failure explains about itself, with next steps drawn from evidence — never invented. |
| **Enrich** | A run that writes derived properties or edges onto the graph. Distinct from a **stitch**, which declares that two published models meet and writes nothing. |

## 5. Working surfaces

| Term | Means |
|---|---|
| **Board** | A named, saved, versioned working surface. One flat `kind` axis of nine: `data · model · plan · workflow · envelope · lineage · run · task_run · plan_runs`. Whether it is *drawn* (on a canvas) or *declared* (panels bound to one record) is **`renders`**, a property of the kind — never a second column. The **plan** and **workflow** kinds both draw a `TaskPlan` — one for a Project's Todos, one for a plan's Tasks. Never "artboard". |
| **Report** | A **frozen** declared board — the panels with the numbers as they were, stored merged so it outlives its subject. One version of a board, not a kind of its own. |
| **View panel** | The content of one shell region — `ModelViewPanel`, `InspectorViewPanel`, `AssistantViewPanel` — canvas-ui's suffix. A panel is named for the **occupant**, not for its contents: the Assistant holds sessions, so it is `AssistantViewPanel`, not `SessionsViewPanel`. A panel is *what fills* a region, never a region itself, so "the panel" alone names nothing. |
| **Section** | One collapsible, resizable part of a stacked view panel — the kit's `PanelStackSection`, with its own header, count, search and drill-in. The Agents view panel has two: **Agents** and **LLMs**. Never a *drawer*: nothing in Studio slides over anything. |
| **Assistant** | The one conversational surface, available everywhere, holding the current selection. Its panel is titled **Ask Assistant** — the noun is *Assistant*, the panel's name says whose. |
| **Soul** | Who an agent is and how it speaks — Markdown on the agent, read only by the steps whose words a person reads. Never *persona*, never *character*: a soul changes words, not what runs. [5.8](modules/agents/features/soul.md) |
| **Third-party** | Anything that is not from the Graph: from a third-party source — the **internet**, or an `api`, `app`, `db` or `agent` the Graph connects — or from the **model**'s own knowledge. Always badged `third-party · <source>` and always carrying its reference: the link for the internet, the locator for any other source. [3.13](modules/ask/features/beyond-the-graph.md) |
| **Inspector** | The surface that states what is selected and edits it. The canvas selects; the Inspector edits. |
| **Console** | The rows behind a drawing, and the query that drew them. |
| **Annotation** | What a person or the assistant says about the graph's records — on a node, a relationship, one of its values, a set or a group of them — kept with the Graph, so every board that loads the records shows it. Its kinds are the anchor's shape; never *note*, *callout* or *comment* as separate things, and never a shape drawn free on the board. [4.8](modules/explore/features/annotations.md) |
| **Runs** | The journal of every TaskRun in a Graph — newest first, delegated children nested under their parent. **Imports** is this journal with `kind in (import, bulk)` preselected, and a Todo's `Runs` tab is it filtered to one Todo. Never "Jobs", never "Thoughts". **This renames the surface**: *Runs* was forbidden while a run was called a thinking; now `TaskRun` is the record and the journal takes its name. [10.5](modules/operate/features/see-what-ran.md) |
| **Activity** | The tree of *events* — who wrote what, on whose behalf. Runs lists runs; Activity lists writes. Neither is the other. [10.2](modules/operate/features/audit-and-activity.md) |
| **Explorer** | The screen the canvas is on — the `leftNav` item, the breadcrumb crumb and the `Explorer · …` artboards all name the same thing: the canvas, and what is selected on it. It is not the page (the graph's URL is the page) and it is not the tab strip (that is Boards). |

### The shell's regions

Seven words, and only these, name a place on screen. They are `AppLayoutV2`'s prop names — the kit
owns them, so code, docs, artboards, URLs and e2e locators all say the same thing. The diagram, the
sub-slots, the URL params and the retired words are in
[building-studio/the-shell.md](building-studio/the-shell.md#the-regions--and-their-names).

| Region | Is |
|---|---|
| **`header`** | the full-width top bar — `header.left` · `header.center` · `header.right` |
| **`leftNav`** | the icon column — one icon per module that has a `leftSection` panel ([module-structure.md](module-structure.md) §2) |
| **`leftSection`** | the resizable left column — holds the open panel |
| **`mainSection`** | the open pages |
| **`rightSection`** | the resizable right column — the Inspector, or the Assistant |
| **`bottomSection`** | the resizable bottom column — the Console |
| **`footer`** | the full-width status bar — `footer.left` · `footer.right` |

## 6. Work

| Term | Means |
|---|---|
| **Project** | A piece of work inside a Graph — a folder of **Todos**, staffed by principals. Its own record: it never runs, has no criteria and no plan. Flat — there are no sub-projects. |
| **Todo** | One unit of work a person wrote, with a definition of done. A Todo may have no Project (the Graph's *No project* bucket) and no plan at all (a person simply does it). **This is the word that used to be "Task".** |
| **Project type** | What a project is deciding, and so its words: `research · investment · policy · market · investigation · general`. Changing it only relabels. [9.5](modules/work/features/branches-and-decisions.md) |
| **Branch** | One line of inquiry inside a project. The type names it — hypothesis, thesis, option, position, lead. Forked, merged, parked, dropped; never a sub-project. |
| **Finding** | One piece of evidence on a branch, with a **stance** — `supports · contradicts · context` — and what it cites. The type may call it a signal, insight or evidence. |
| **Project decision** | A person's verdict (`supported · refuted · inconclusive`) and decision (`pursue · park · drop · merge`) on a branch, in the type's words, checked by the rules. Append-only: revisiting **supersedes**. In code `ProjectDecision`; in a project's UI just *decision* and *verdict*. Not an approval's answer and not a runtime verdict ([§4](#4-asking-and-answering)). |
| **Project proposal** | An agent's suggested fork or decision on a branch; a person accepts or rejects it. Not a memory proposal. |
| **Project report** | A project written up from its records and published as frozen versions. Not a *Report* board ([§5](#5-working-surfaces)). |
| **Simulation** | One run of a **simulator** on a branch, over pinned dataset versions and a seed; its result is ranked and always `derived` — a prediction, never an observation. Numbered per project (`s1`). [9.8](modules/work/features/simulation.md) |
| **Impact** | What a branch's option reaches over the graph, hop by hop from the records its findings cite; reach only, no what-if values. Not *blast radius* in UI copy. [9.9](modules/work/features/impact.md) |
| **Simulator** | A plugin of kind `simulator` that does a domain's science (genomic prediction first); Invana runs it, never computes a figure itself. Not a *simulation* — the simulator is the model, a simulation is one use of it. |
| **Tool plugin** | A plugin of kind `tool` that reaches outside Invana — the web, mail, a science source — as task types; installed by its extra, run only while an install Admin has **enabled** it, and in a worker when one runs. [13.12](modules/platform/features/tool-plugins.md) |
| **MCP plugin** | A plugin of kind `mcp` made from one MCP server an install Admin added: each of its tools is a task type `mcp.<server>.<tool>`, frozen as it was when added until an Admin refreshes it, and switched like a tool plugin. [13.13](modules/platform/features/mcp-plugins.md) |
| **Objective** | One statement of what a Project is for. |
| **Criterion** | One checkable statement of "done", with how it is checked: `query · agent · human`. |
| **Outcome** | A criterion's finding on one Todo, with its evidence: met · unmet · needs a human. Not a **verdict** — that is a person answering a paused Task. |
| **Dependency** | An `depends_on` edge with a condition: `success · failure · any_outcome`. Between **Todos** in a Project, and between **Tasks** in a TaskPlan — the same concept at two altitudes. |
| **Wave** | Dependency depth. The Plan canvas groups by it. |
| **Critical path** | The longest success chain. Failure edges never inflate it. |
| **Review** | The one queue for everything waiting on a person: **clarifications, approvals and verdicts** each stop a run; results need accepting; proposals wait. |
| **Schedule** | An agent and its instructions on a cron, with where the result is delivered. A **firing** is one occurrence, recorded whether it ran or not; a **missed** firing is one the clock reached late, handled by the schedule's policy (`catch_up · run_all · skip`). One kind of schedule: whether a firing creates work a person accepts is the run's business, not the schedule's. |
| **Notification rule** | Which events reach whom, on which **channels**. A **channel** is email · Slack · webhook — never the inbox, which every rule may also write to. |
| **Inbox** | One person's notifications on a Graph, with the approvals waiting on them. A **notification** is one row; a **delivery** is one send to one channel. |

## 7. Actors

| Term | Means |
|---|---|
| **Principal** | Who acted: `user · agent · system · external · anonymous`. |
| **Agent** | A principal that can be assigned work, carrying provider, model, skills, envelope and budget. |
| **Envelope** | The static bounds on an agent: allowed `step_key`s, which reusable TaskPlans it may `ref`, pinned arguments. What it may **do**. Validated before dispatch. |
| **Budget** | The cost ceiling a run may spend — the smallest of the agent's, the plan's and the Todo's. **At the ceiling the run pauses and asks**, as an `approval`; in-flight work finishes and nothing is discarded. Never a hard stop — that is a separate `hard_ceiling`. |
| **Role** | What a TaskRun is *for*: `execute` · `plan` · `evaluate`. Planning and evaluating are roles of a run, never kinds of a plan. |
| **Delegation** | An agent spawning an agent, bounded by depth, fan-out and a budget ⊆ its parent's. |
| **Ephemeral** | A spawned agent that retires when its work closes. Its row stays so lineage resolves. |
| **On behalf of** | The principal a run serves, distinct from the principal that ran it. |
| **Personal access token** | A long-lived credential a person mints on their profile. It carries their identity — never a scope — and is revoked on its own. |
| **Workflow** | A **reusable TaskPlan**, in a role — not a record of its own. **Promoting** a plan that served turns a generated one into a reusable one. A multi-stage load is one of these; ingestion has no grammar of its own ([§7 F11](modules/workflows/spec.md)). |
| **Builtin workflow** | A plan Invana ships, seeded into the library as a published, read-only version. `model-import@1` (`kind: import`) and `stitch-apply@1` (`stitch`) today; `bundle-import@1` and `bulk-load@1` when `map_over` and `bulk_write` exist ([LB14](modules/workflows/features/the-library.md)). Seeded means **exploded into rows**, and the rows are what the runtime executes — so a builtin is read-only because editing it would edit a live plan, not because it is special. |
| **Agent orchestrator** | What Invana is. It decides which agent takes a task, what it may run, what it is offered, in what order, and who checks the result. |
| **Job scheduler** | The role behind the runtime protocol: when a run is dispatched, retried and queued at the process level. Invana fills it itself, in process. An external one could implement the protocol; none has. |
| **Orchestration** | The first of those. Invana's. |
| **Scheduling** | The second. Invana's own today, and replaceable by design. |

## 8. Words we do not use

| Not this | Say | Why |
|---|---|---|
| Mission · Atlas · Workspace | **Graph** | one container, one word |
| Bring data in · Connect and model · Operate · Ask · Work · Workflows · Govern — as a **module** name | `imports` · `models` + `graphs` · `runs` + `events` · `assistant` · `projects` · `plans` · `lenses` | a module is named for what it holds ([§ How a module is named](#how-a-module-is-named)); a verb phrase is a feature's register. *Govern* stays the `leftNav` label |
| Dashboard | **Board** — a *declared* board when the difference matters | every surface is a board: drawn on a canvas or declared from panels (`renders: canvas · declared`). The kit's package is `@invana/boards` and its component `Board`. HyperDX's own dashboards keep their name, since they are that product's word, not ours |
| Intent | **Instructions** for guidance, **understanding** for the step | the word is ambiguous between the two |
| Instructions (as a prose blob) | **Rules** | guidance is a list of statements, not a paragraph |
| Acceptance criteria (as prose) | **Criteria** | each one is a node with a check |
| Approval · verdict, used for each other | the **three pauses**, by name | they differ in *when*: an approval is asked before dispatch and costs nothing to refuse; a verdict is asked after a pass and costs another one. One word for both hides the bound that follows from it |
| Accepting a **Task** vs accepting a **verdict** | **accept a result** · **accept a pass** | a result closes work somebody owns; a verdict decides whether a loop goes round again. Both are "accept" in the UI and different rows against different subjects |
| Iteration · lane · attempt, used loosely | each by its own name | serial repetition, parallel repetition, and a retry. They nest, so a sentence using the wrong one describes a different row |
| Permission level · access tier · Graph admin | **Graph role** by name (`viewer` … `owner`) | five named roles; a Graph has no *admin* — that word is the install's |
| Thought · Thinking | **Todo** · **TaskRun** | a load is not a thought, and the run is the thing that happens. Both words are retired |
| Job · execution · job run | **TaskRun** | one vocabulary from UI to code. There is no *job* anywhere in the product |
| Task (for a thing a user wrote) | **Todo** | **the flip.** `Task` now names a node inside a TaskPlan and nothing else. Nothing a user authors is ever a Task |
| SkillPlan · WorkflowPlan · plan-as-a-type | **TaskPlan** | one record. Where a plan came from is `origin` and `source_skill_version_ids[]` — provenance is a column, not a type |
| `TaskRun.plan` | **`plan_snapshot`** | `plan` otherwise names the record, the frozen column, the planning **role** and a callable at once |
| `kind = plan` · `kind = work` | **`role = plan`** · **a Todo** | `kind` is the *subject* a plan is about. Planning is a role of a run; human work is a Todo, which is a type |
| Emission (for a stream frame) | **Run frame** | an emission is what a reader sees in an answer; a frame is how it travels |
| Internet (as a layer) | **third party** | it named the network, not the boundary — a private warehouse is as outside the Graph as a public API |
| Tier (of a model) | **role** | this year's *small* is last year's *frontier*; a plan says how much a decision matters, not how big the model is |
| Subgraph (for a narrowed view) | **Lens**, named | *subgraph* already means an [emission](#4-asking-and-answering), and a second meaning would make both unreadable |
| Scope (for what a run may see) | **Lens** | `rules.scope` already means `graph \| project`, and one word for two bounds hides both |
| Note · callout · comment (on the board) | **Annotation** | one noun with an author; the kind is the anchor's shape ([4.8](modules/explore/features/annotations.md) AN2) |
| Ground · grounding (as a record) | **Lens** | *Grounded* is a setup gate; grounding is what the product does, a lens is the thing that bounds it |
| Orchestrator, unqualified | **agent orchestrator** for what Invana is · **runtime** for the thing that interprets a plan and dispatches its Tasks | the bare word means Airflow or Temporal to most readers; qualify it the way *graph connector* is qualified |
| Connector, unqualified | **graph connector** | the bare word is reserved for a future source connector — a mailbox, a bucket, an API |
| Source connector · pipeline | **Import** | Invana is a destination; nothing pulls data in today |
| Dataset, for *the records one load brought* | **Model** (the container) · **import run** (the load) | Records are imported *into a model*. *Dataset* now names only the install-wide, versioned record above Graphs ([2.4](modules/bring-data-in/features/datasets.md)); the records a load carried are the model's, and the load is a run |
| Ingestion · ingest job · import job | **Import** for the surface, **import run** for one load | *ingest* claims a pull Invana does not do, and *job* is already retired above |
| Pipeline · ingestion pipeline · DAG (for a multi-stage load) | **Workflow**, and its parts are **steps** | the retired sense below is a thing that *pulls* data in; this one is worse, because it implies a second orchestration concept beside the plan graph that already exists. A load of three datasets, stitched and enriched, is one workflow, one run, one trace |
| Stage (for a step of a load) | **Step** | same rule as *Task*: a step is a callable the runtime dispatches, whatever a load calls it |
| Merge (for an anchor) | **Link** | anchors link; folding two nodes is lossy |
| From · To (for a stitch's two sides) | **Source** · **Target** | the payload's own words (`source_version_id`, `target_type`); *from/to* reads as direction, which an anchor does not have |
| Links (as a surface name) | **Stitches** | *link* is the record the engine stores; *stitch* is what a person does, and the product already has `TaskPlan(kind = stitch)`. The word *link* keeps its place in `model_links` |
| API key · PAT · service account | **Personal access token**, spelled out | it is a person's identity with a longer life, not a key and not an account of its own |
| Wizard · onboarding · checklist · getting started | **Setup**, and **setup step** | nothing is walked modally, nothing is ticked and nothing is dismissed — the steps are derived, so the words for walking one are all false ([SU1](modules/platform/features/setup.md) · [SU7](modules/platform/features/setup.md)) |
| Rail · left rail · activity bar | **`leftNav`** | the kit's prop name is the word; nothing else names a region |
| Sidebar · left panel · docked panel | **`leftSection`** | ditto |
| Editor · main content · canvas area · workspace | **`mainSection`** | ditto |
| Auxiliary · right panel · **drawer** | **`rightSection`** for the place · **section** for a part of a stacked view panel | a drawer names neither the place nor the thing, and nothing in Studio behaves like one |
| Terminal · bottom panel | **`bottomSection`** | the **Console** is what fills it |
| Status bar (as a place) | **`footer`** | the status is the occupant; the footer is the region |
| Panel · section · pane, bare | the **region**, or the **occupant** | the bare word is the whole ambiguity |
