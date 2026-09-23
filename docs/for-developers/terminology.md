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
| **A path follows only when the word goes** | a rename changes display names, and the slug stays: nobody reads it, and moving it breaks every link that points at it. It moves only when the product stops using the word altogether, as *roster* did ([AG12](modules/agents/features/author-an-agent.md)) — and then every link is fixed in the same commit |

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
| **Rule** | One statement that is always true. `invariant` on a Graph, `working` on a Project. |
| **Library** | The **definitions** a run is built from: reusable **plans**, the closed **catalogue** of callables, and projection **templates**. One `leftNav` item, three drawers ([G41](building-studio/graph-detail-page.md)). It widens the older sense of *the library*, which named the plan list alone. Never the journal — that is **Runs**. |
| **Skill** | A playbook an agent may be offered — named, described, with a "when to use". Offered, never forced. |
| **Graph connector** | The package that speaks to one graph database — `invana-neo4j`, `invana-janusgraph`. Always qualified. |
| **Setup** | The *sequence* a Graph walks from created to answering — four required steps and two optional ones, derived from facts and never ticked. [13.7](modules/platform/features/setup.md) |
| **Onboarding wizard** | The *surface* that walks it: the stepper and the selected step's lesson, on the graph page. Reopened any time from the graduation cap in `header.right`. Setup is the state; the onboarding wizard is where you walk it. Never "the setup wizard", never "the tour", never "onboarding flow" |
| **Setup step** | One of them. `done · next · todo · blocked · skipped · broken`. |
| **Gate** | A group of setup steps, named for what it unlocks: **Connected** · **Grounded** · **Answering**. |
| **Ready** | A Graph whose required setup steps are done. It can be asked a question. The word in the UI is **ready** — never "graduated", "complete", "live" or "onboarded". *Graduation* is the onboarding cap's metaphor and nothing else: it names no state, no badge and no API field |
| **Member** | Someone with access to a Graph. Binary — there are no roles. |

## 3. Models and data

| Term | Means |
|---|---|
| **Domain model** | A model authored against a domain, not a Graph — so it exports, imports and upgrades. One published version at a time. |
| **Draft** | An unpublished model version. Authoring happens here; published versions are read-only. |
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
| **Stitch** | The act of declaring that two published models meet, and the Studio surface that holds them — a drawer in the Model panel. An anchor and a relationship link are the two kinds of stitch. **Declared stitches are read-time and write nothing**, which is what lets a [lens](#3-models-and-data) exclude them. The `stitch` *step inside an import* is a different act — it writes edges, and no lens can un-write one. |
| **Physical** | The introspected mirror of what the database actually holds. |
| **Records** | Externally produced data, conforming to exactly one model, handed to Invana. They are the model's — there is no record between the model and its data ([BD16](modules/bring-data-in/spec.md)). |
| **Import run** | One load of a dataset — a **TaskRun** of a TaskPlan with `kind = import`. It inherits the runtime, trace, retries and failure vocabulary. |
| **Bulk run** | One `invana loader` load — a TaskRun of a `kind = bulk` plan with a single `bulk_write` Task. Validated per record and traceable to a source record is what an **import** is; a bulk run is neither, and the kind is what says so. |
| **Bundle** | A folder of datasets that belong together, with `stitches.json` naming them and the rules between them. Loading one is a workflow, not a new kind. |
| **Validation report** | Per-record accept/reject with reasons. Rejects are never silent. |

## 4. Asking and answering

| Term | Means |
|---|---|
| **Todo** | What a person wrote — the only thing a user authors. Prose, criteria, an optional assignee and due date. It has no status of its own: its state derives from its runs, and only acceptance is stored. [§6](#6-work) |
| **TaskPlan** | A flow of Tasks — the thing that carries a Todo out. Three origins: `authored` · `generated` · `promoted`. A **reusable** TaskPlan is what the product calls a **workflow**. |
| **Task** | One node inside a TaskPlan: `callable` · `composite` · `human`. **Never a thing a user authors** — a Task cannot exist outside a plan. Users see *step*; the record is a `Task`. |
| **Step** | A Task in the role of a child — the authoring format writes `steps:`. A role, not a second record. |
| **TaskRun** | One execution. Its `role` says what the execution is for: `execute` · `plan` · `evaluate`. A delegated child is a TaskRun carrying `parent_run_id`. The word is now literal — a run is a TaskRun. |
| **Kind** | What a TaskPlan is *about*: `ask · import · bulk · stitch · model · enrich`. The subject, and what the journal filters on. Never *how* it executes — that is `form` on a Task — and never *what the run is for* — that is `role`. |
| **Catalogue** | The closed set of callables a plan may name by `step_key`, grouped by the bound each spends. Closed is the point: a planner that could invent a callable could escape any ceiling. [orchestration § 0.6](orchestration.md#06-the-catalogue--what-a-plan-may-name) |
| **Emission** | One thing a step produced — a subgraph, table, metric, chart or prose block. An answer is its emissions. |
| **Run frame** | One frame of a TaskRun's stream: a Task transition, a reasoning line, an emission arriving. `TaskStream` is the log of them, and its `seq` is the resume cursor. |
| **Session** | A named thread of asks, assigned to an agent. It references Todos; it is not one — a conversation never runs and has no outcome. |
| **Clarification** | A pause *inside* a Task: the agent does not know something and asks, with options. Its answer is an **answer**. A `role=plan` run raises one rather than guessing an ambiguous instruction. |
| **Approval** | A pause *before* a Task is dispatched: the agent may not proceed alone. Its answer is a **decision** — approve · reject. Nothing has been spent, and **only a person may answer one**. |
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
| **Report** | A **frozen** dashboard — the panels with the numbers as they were, stored merged so it outlives its subject. One version of a board, not a kind of its own. |
| **Panel** | The content of one shell region — `ModelPanel`, `InspectorPanel`, `AssistantPanel`. A panel is named for the **occupant**, not for its contents: the Assistant holds sessions, so it is `AssistantPanel`, not `SessionsPanel`. A panel is *what fills* a region, never a region itself, so "the panel" alone names nothing. |
| **Assistant** | The one conversational surface, available everywhere, holding the current selection. Its panel is titled **Ask Assistant** — the noun is *Assistant*, the panel's name says whose. |
| **Inspector** | The surface that states what is selected and edits it. The canvas selects; the Inspector edits. |
| **Console** | The rows behind a drawing, and the query that drew them. |
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
| **`leftNav`** | the icon column, one icon per feature module |
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
| **Objective** | One statement of what a Project is for. |
| **Criterion** | One checkable statement of "done", with how it is checked: `query · agent · human`. |
| **Outcome** | A criterion's finding on one Todo, with its evidence: met · unmet · needs a human. Not a **verdict** — that is a person answering a paused Task. |
| **Dependency** | An `depends_on` edge with a condition: `success · failure · any_outcome`. Between **Todos** in a Project, and between **Tasks** in a TaskPlan — the same concept at two altitudes. |
| **Wave** | Dependency depth. The Plan canvas groups by it. |
| **Critical path** | The longest success chain. Failure edges never inflate it. |
| **Review** | The one queue for everything waiting on a person: **clarifications, approvals and verdicts** each stop a run; results need accepting; proposals wait. |
| **Schedule** | A cron naming a **TaskPlan**. A **firing** is one occurrence. One kind of schedule: whether a firing creates work a person accepts is a property of what it names, not of the schedule. |

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
| Intent | **Instructions** for guidance, **understanding** for the step | the word is ambiguous between the two |
| Instructions (as a prose blob) | **Rules** | guidance is a list of statements, not a paragraph |
| Acceptance criteria (as prose) | **Criteria** | each one is a node with a check |
| Approval · verdict, used for each other | the **three pauses**, by name | they differ in *when*: an approval is asked before dispatch and costs nothing to refuse; a verdict is asked after a pass and costs another one. One word for both hides the bound that follows from it |
| Accepting a **Task** vs accepting a **verdict** | **accept a result** · **accept a pass** | a result closes work somebody owns; a verdict decides whether a loop goes round again. Both are "accept" in the UI and different rows against different subjects |
| Iteration · lane · attempt, used loosely | each by its own name | serial repetition, parallel repetition, and a retry. They nest, so a sentence using the wrong one describes a different row |
| Role · permission level | **Member** | membership is binary |
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
| Ground · grounding (as a record) | **Lens** | *Grounded* is a setup gate; grounding is what the product does, a lens is the thing that bounds it |
| Orchestrator, unqualified | **agent orchestrator** for what Invana is · **runtime** for the thing that interprets a plan and dispatches its Tasks | the bare word means Airflow or Temporal to most readers; qualify it the way *graph connector* is qualified |
| Connector, unqualified | **graph connector** | the bare word is reserved for a future source connector — a mailbox, a bucket, an API |
| Source connector · pipeline | **Import** | Invana is a destination; nothing pulls data in today |
| Dataset | **Model** | Records are imported *into a model*. A second noun for "the records that arrived together" held a name, a path and a count — the first two belong to the load that carried them, the third to the runs |
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
| Auxiliary · right panel · **drawer** | **`rightSection`** | a drawer names neither the place nor the thing |
| Terminal · bottom panel | **`bottomSection`** | the **Console** is what fills it |
| Status bar (as a place) | **`footer`** | the status is the occupant; the footer is the region |
| Panel · section · pane, bare | the **region**, or the **occupant** | the bare word is the whole ambiguity |
