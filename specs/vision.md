# Vision

**An ontology-governed decision intelligence platform for humans and AI agents.**

One knowledge graph, one set of rules, for every thinker and the systems they build.

Invana organises what a team knows into a defined model, lets agents work it into insight, and shows the person the
evidence behind every answer. The person decides — agents think alongside, and act only as far as the person allows.

## How Invana names itself

| Line | Role | Text |
|---|---|---|
| **Positioning** | What Invana is — its category | An ontology-governed decision intelligence platform for humans and AI agents |
| **Tagline** | What it means for the person using it | One knowledge graph, one set of rules, for every thinker and the systems they build |
| **Philosophy** | How every agent and skill behaves — Invana's and the team's own | Help thinkers decide: agents think alongside, and act only as far as the person allows. |
| **Motto** | For the website; never shown in the product | Think it through. Decide with evidence. |

| Surface | File | Headline | Sub-line |
|---|---|---|---|
| README | `README.md` | Positioning | Tagline |
| Docs home | `docs/docs/index.md` | Positioning | Tagline |
| This vision | `specs/vision.md` | Positioning | Tagline |
| Docs site description | `docs/mkdocs.yml` | Positioning | — |
| PyPI | `engine/pyproject.toml` | Positioning | — |
| The package | `engine/src/invana/__init__.py` | Positioning | — |
| `invana --help` | `engine/src/invana/cli/main.py` | Positioning | — |
| The API description | `engine/tests/golden/openapi.json` | — | — |
| The team's instructions | `CLAUDE.md` · `.claude/team/TEAM.md` | Positioning | — |
| Studio sign-in | `studio/packages/shell/src/pages/auth/LoginPage.tsx` | *Invana* | Tagline |

| Decision | Detail |
|---|---|
| One headline, checked | Every file in the table carries the positioning and tagline its row names, word for word; `scripts/specs/check.py` checks each one |
| The vision and the README | The vision says what Invana is and why; the README says what works today and how to run it. The README names a pillar and links here — it never explains one; the vision never holds a status, an install step or an integration list |

Studio never shows the positioning statement: *ontology* is not a Studio word ([The ontology](#the-ontology)), and the
tagline does not need it.

## What Invana is

| Claim | Means |
|---|---|
| **Ontology-governed** | The Graph's ontology is the one contract people and agents share: every question, load, plan and change is checked against it ([The ontology](#the-ontology)) |
| **A decision intelligence platform** | Every pillar, capability, feature and story serves a person making a decision: the data is given meaning, agents work it into insight, and the evidence is shown so the person decides with a trail anyone can follow ([Pillars and capabilities](#pillars-and-capabilities)) |
| **For humans and AI agents** | People act through agents: a person is granted the agents they may use, and every read, write and run is an agent's — held to the same ontology and Access Policies, run by the same operating system, in the same History ([The operating system](#the-operating-system)) |
| **An agent orchestrator over a curated graph** | Invana decides which agent takes a piece of work, what it may run, what it is offered, in what order, and who checks the result |
| **One deployment** | One deployment is everything: its graph databases, stitched into one Graph, its people, teams, agents and work. There are no workspaces, no tenants and no unit inside a deployment that holds a graph of its own ([Scope](#scope)) |
| **Stitched, never copied** | The Graph is the model and data across every graph database the deployment connects. A question runs one step per graph database, in its own query language, and the results are joined on identity links a Modeller declares; no customer data is copied into Invana ([Where things live](#where-things-live)) |
| **Grounded** | Every question resolves against the published model, and every answer cites the records that produced it. When the Graph cannot answer, it says so rather than invent |
| **Third-party, badged** | Anything from beyond the Graph — the internet, an outside service, or the model's own knowledge — comes only where an agent's Access Policies allow it, badged **third-party** with the reference it came from |
| **Governed** | An agent runs only inside its Access Policies, a plan is checked before it runs, skills are offered rather than forced, and no agent accepts its own work |
| **Accountable** | Every call to an AI model, a tool or a graph database is recorded — what was sent, to whom, for which run and person. What may hold a person's data never goes to an external model unseen |

## Where things live

| Store | Holds | Never holds |
|---|---|---|
| **Graph databases** | The customer's records — Neo4j, Memgraph, ArcadeDB, JanusGraph, Neptune, TinkerGraph — each reached through its connector, read-only or read + write | Invana's own state |
| **The Graph** | Nothing of its own: the stitched model and data read in place across the graph databases | A copy of a record |
| **The system graph** | Invana's own graph, governed by the system ontology: the thinking graph, the ledger's edges, identity links and lineage | Customer data; it is never part of the Graph |
| **Postgres** | The source of truth for everything Invana records — users, agents, policies, runs, History; the system graph follows it and is rebuilt from it | — |
| **The blob store** | Files — uploads, load batches, reports — over the S3 API, each encrypted with its own key | — |

How each store is run, secured and kept in step is [system-design.md](system-design.md).

## The ontology

The Graph's ontology is what its data means and what may hold in it. It is not one record: it is these parts together.

| Part | Is | Studio shows |
|---|---|---|
| **Models** | The kinds of node and relationship, and their properties — one stitched model across every graph database | Model · Kind |
| **Meaning** | What each kind and property means — definitions, synonyms, units, the outside terms it is the same as, and which properties are sensitive | Meaning, a tab on a kind |
| **Taxonomies** | Broader kinds, for meaning only, and hierarchies of a property's values | Broader kind |
| **Standards** | Shared, versioned terms and allowed values a kind or property is held to | Standard |
| **Links and mappings** | Declared meetings of two models, a model and a standard, or two standards — and the identity match rules that say when records in two graph databases are the same entity | Link between models |
| **Rules** | Constraints that refuse data, derivations that add facts, and alerts — on the deployment or a project | Rule · Constraint · Derivation |
| **Derived facts** | Facts the derivations add by inference, written to a read + write graph database, labelled derived with their rule and version | Derived |

| It governs | How |
|---|---|
| **A question** | An agent writes a typed query plan from the model, never from records; the plan is checked against the model and the agent's Access Policies before it runs. What the model cannot answer becomes a request, never an invented answer |
| **A load** | Each record is checked against its model and constraints; what breaks them is rejected and reported |
| **An agent** | Reads and writes only the kinds its Access Policies reach; its plan is checked against the rules before it runs |
| **A change to the ontology** | Only as a draft, published by a Modeller; a rule that refuses an ask keeps it as a request |
| **A person and an agent alike** | A person acts through agents, so both are held to the same model, rules and Access Policies |

Invana's own records follow a second ontology: the **system ontology**, shipped with Invana, versioned and read-only.
It governs the system graph and is never part of the Graph's.

| Decision | Detail |
|---|---|
| *Ontology*, *semantics* and *taxonomy* are vision and docs words | Studio never shows them; it shows the parts by their glossary words — *Meaning*, *Broader kind*, *Derivation*, *Rule*, *Standard* |
| *From an ontology* stays on screen | There the word names an outside RDFS, OWL or schema.org file a model starts from — not the Graph's own ontology |

## The operating system

The layer under every pillar: what runs the platform for people and agents alike. It is not a pillar and never a
product — it is how Invana works, in every deployment. It enforces the ontology; the Ontology pillar owns it. It has
two planes.

| Plane | Answers | Holds | Spec |
|---|---|---|---|
| **Control Plane** | What runs, where, and within which limits? | The overview of workloads by user, agent and team · every run, and stopping one · ops alerting · the Inbox and its channels · graph databases — connecting one, its mode, switching it on or off, its health · finding the way — ⌘K and search · workers and the queue · limits per team, user and agent · AI models, local or external · plugins, the deployment's MCP server and outside tools · skill scripts | `os/control/` — `CP` |
| **Access Plane** | Who may act, through which agent, and what did they do? | Sign-in, sessions, keys and connected MCP clients · Access Policies — Allow · Ask · Deny on Read · Write · Run — and the one role table · the Directory — users, teams, the agents each may use · ownership · asks and approvals · access usage · what left the platform · History | [os/access/product.md](os/access/product.md) — `AC` |

| An OS has | Invana has | Plane |
|---|---|---|
| **Users** | Users — human, agent, service and the system user — and the teams people are on; a person holds the agents they may use and one role | Access |
| **A type system** | The ontology — every record has a kind, every kind its rules; owned by the Ontology pillar, enforced here | — |
| **Permissions** | Access Policies on agents, whose every rule is Allow · Ask · Deny on Read · Write · Run of a named resource; default deny, the strictest wins | Access |
| **Mounts** | Graph databases, each connected read-only or read + write and switched on or off, stitched into the one Graph | Control |
| **Drivers** | Connectors — one package per graph database type | Control |
| **Processes** | Runs — every execution of a plan or a workflow, by an agent for a person, in one journal, executed on workers | Control |
| **A scheduler** | Workers and the queue; Agents sets the schedules that feed it | Control |
| **Resource limits** | Token budgets, and limits per team, user and agent | Control |
| **Extensions** | Plugins — tools, MCP servers and Domain packs that add what agents can do, each switched on by an Admin | Control |
| **System calls, audited** | The ledger — every call to an AI model, a tool or a graph database, what it carried and where it went | Access |
| **Logs** | History, the change log and provenance — who did what, through which agent, to which record | Access |
| **A shell** | The frame — modes, crumbs, ⌘K — and the Inbox, where what needs a person waits | Control |

| Decision | Detail |
|---|---|
| The Control Plane runs the work | Workers, the queue, limits and the journal of every run are the Control Plane's; anyone behind a run, its agent's owners and an Admin read and stop it there |
| The Access Plane decides and records | Every act is checked against Access Policies before it runs and lands in History after; the ledger is read there |
| Agents builds and schedules | Building agents, skills and workflows, testing them, and setting schedules are Agents' (AG) |
| The Assistant is a built-in agent | The Assistant is one of the agents every deployment ships; its conversation is a feature of Explore (EX) |

## Principles

| Principle | What it means |
|---|---|
| **Agents do the work** | From what the person says, an agent reads, plans, queries, harvests, loads and drafts — in the background |
| **The agent proposes, the person decides** | No blank forms where an agent could draft: it suggests, shows choices with a recommendation, and asks for a decision the person answers with a click |
| **Plain words in, work out** | A question in plain English becomes a typed query plan, a workflow reused or a plan drafted, and an answer — or choices to pick from |
| **Simple by default** | The person sees the decision and its result, not the machinery |
| **Traceable on demand** | Every answer, proposal and act shows how it got there — steps, sources, assumptions, who did what — one click away, never on the first screen |
| **Acts only as far as the person allows** | Every act runs through an agent, and each Read, Write and Run is Allow, Ask or Deny by the Access Policies on that agent; what no rule reaches is denied, and the strictest rule wins. An Ask waits for the agent's named approvers, showing exactly what will happen, and is never decided by the one it benefits ([Access Plane](os/access/product.md#decisions)) |
| **Nothing leaves unseen** | Every call to a model, tool or graph database is in the ledger; a sensitive property never goes to an external model |
| **Learns from outcomes** | Every plan, run, finding and decision is kept in the thinking graph; what served is recalled first, and what failed is kept as what to avoid |
| **General-purpose** | Nothing in the platform is domain-specific. A domain is its ontology, its agents and its project types, shipped together as a Domain pack |
| **Split by role** | An Operator asks and decides; a Modeller shapes the model; an Admin runs the deployment — each sees the acts their role holds ([personas](personas.md)) |

How these look on screen is [design-language.md](design-language.md); the words a person reads are
[glossary.md](glossary.md).

## Pillars and capabilities

Invana is one platform. What it offers is four **pillars**; each holds the **capabilities** a person works in, and
all of them run on [the operating system](#the-operating-system). How each looks in Studio is
[design-language.md](design-language.md) §8.

| Pillar | Promise | Capabilities |
|---|---|---|
| **Ontology** | Data that means one thing, published as one versioned contract | Semantics |
| **Intelligence** | The facts gathered, checked against the contract and traceable to where each came from | Records |
| **Agents** | Agents that work the facts into insight and do the work, only as far as people allow | Agents |
| **Evidence** | Every answer shown with the records behind it — the person decides | Explore · Projects |

| Code | Capability | Pillar | Tier | Lets a person |
|---|---|---|---|---|
| `SE` | [Semantics](capabilities/semantics/product.md) | Ontology | mode · sheet | Say what the data means across every graph database — models, meaning and sensitive properties, taxonomies, standards, links and identity match rules, rules, inference — drafted, reviewed and published |
| `RC` | [Records](capabilities/records/product.md) | Intelligence | modal · sheet | Know the records in the graph databases and how each got there — loads, quality against the model, fixes, merges, provenance, annotations |
| `AG` | [Agents](capabilities/agents/product.md) | Agents | modal · sheet | Build agents and skills, test them, turn plans into workflows, schedule them, and recall what they learned in the thinking graph |
| `EX` | [Explore](capabilities/explore/product.md) | Evidence | mode | Ask and look — boards, conversations, answers traced to their records, what-if reasoning labelled predicted |
| `PJ` | [Projects](capabilities/projects/product.md) | Evidence | mode | Pursue a question — tasks, branches, findings for and against, decisions, reports, alerts |

| Decision | Detail |
|---|---|
| One platform | Invana is offered whole. Pillars and capabilities are how it is explained, never sold apart; every deployment has all four pillars and both planes |
| Pillars group the capabilities; the operating system runs them | These are the only two groupings. A capability belongs to one pillar; the operating system belongs to none |
| Decision intelligence is the category, evidence the difference | Invana shows the evidence and the person decides; it never decides for them |
| Decision Graphs is a story, not a pillar | A decision cites the findings, runs and steps behind it in the thinking graph — the story Agents and Evidence tell together |
| A part of the operating system serves every capability | An ask, a policy rule, a limit or a way in that only one capability needs belongs to that capability |
| Vision and docs words | *Pillar*, *capability*, *operating system* and *instance* are never shown in Studio; a person sees the modes and overlays by their own names |

## Scope

The deployment defines, limits and uses; a project narrows.

| Scope | Holds |
|---|---|
| **Deployment** | Graph databases and their connections · the Graph — one stitched model and its data · the system graph · standards, Domain packs and rules that must always hold · users, teams and the agents each may use · agents, skills, workflows and Access Policies · workers, AI models, plugins and limits · runs and History |
| **Project** | Branches, tasks, findings, decisions, project rules |

| Rule | Detail |
|---|---|
| One deployment, one organisation | No multi-tenancy, no workspaces and no Organisation record; the deployment is the widest scope |
| Hosted means single-tenant | A hosted Invana is one deployment per customer, never shared tenancy |
| One Graph per deployment | Every graph database the deployment connects is part of its one Graph; the system graph never is |
| A person uses agents | A person is granted the agents they may use; an agent's Access Policies say what it may Read, Write and Run, and a rule may narrow it to a team |

## What it is used for

The same records host different kinds of work; none is a special case.

| Use case | How it composes |
|---|---|
| **Curated context for AI** | The stitched model and its records, which an outside agent queries through the deployment's MCP server as the person who connected it, with provenance on every value |
| **Deep search and research** | A model of sources and claims, the rows an extractor loads into it, and skills that recall prior records |
| **Analytics** | A metrics-and-dimensions model and projections: a closed question in, a table or chart out |
| **Knowledge management** | Several graph databases, stitched on identity links, answered as one |
| **Compliance and audit** | The append-only History, the ledger of what left the platform, criteria checked per task, and provenance from every value back to its load |
| **Domain intelligence** | A model of the entities that matter, and agents staffed on a project working tasks against criteria |
| **Domain memory** | The thinking graph: every plan, run and decision kept, recalled by its outcome |
| **Decisions under uncertainty** | A project's branches, findings for and against, what-if reasoning labelled predicted, and a decision checked by the rules |

## Not building

| Item | Why not |
|---|---|
| An extractor — source connectors, cursors, a mapping grammar | Invana is a destination: whatever already pulls the data hands it over as a load into a model |
| Write-back to a source | The graph databases are the destination; Invana writes to one only through a read + write connection, never to a system upstream of it |
| A copy of the customer's records | The Graph is read in place; a load is a batch written to a graph database, never a second store of records |
| Fuzzy entity resolution · node merge on an anchor | Identity links come from match rules a Modeller declares, never guessed silently; an anchor links, it never merges. Two records merge only when a person picks them ([Records](capabilities/records/product.md)) |
| Multi-tenancy · workspaces · an Organisation record | One deployment is one organisation |
| Proprietary data · pricing · a marketplace | Records, standards and Domain packs are reusable knowledge first |
| Soft deletes · a trash tier · undo | Deletes are hard and cascade downward; retiring and undoing a load exist where history must stay resolvable |
| Parameter sweeps · game theory | After 1.0. What-if is a reasoning method whose evidence is labelled predicted |
| Authoring a plan by hand | Plans are drafted by agents from instructions, or reuse and compose published workflows |
| Criterion weights and waivers | A criterion is met, unmet or needs a person |
| Styling a single element on the canvas | Not planned |
