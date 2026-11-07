# Vision

**An ontology-governed operating system for humans and AI agents.**

One knowledge graph, one set of rules, for every thinker and the systems they build.

People and agents work on the same curated knowledge graph, and its ontology governs both. What they do there is
decide — agents think alongside, and act only as far as the person allows.

## How Invana names itself

| Line | Role | Text |
|---|---|---|
| **Positioning** | What Invana is — its category | An ontology-governed operating system for humans and AI agents |
| **Tagline** | What it means for the person using it | One knowledge graph, one set of rules, for every thinker and the systems they build |
| **Philosophy** | How every agent and skill behaves — Invana's and the team's own | Help thinkers decide: agents think alongside, and act only as far as the person allows. |
| **Motto** | For the website; never shown in the product | Think it through. Decide with evidence. |

| Surface | Headline | Sub-line |
|---|---|---|
| README · docs home · this vision | Positioning | Tagline |
| PyPI · `invana --help` · the API description | Positioning | — |
| Studio sign-in | *Invana* | Tagline |
| Studio Graphs list | *Invana Studio* | — |

Studio never shows the positioning statement: *ontology* is not a Studio word ([The ontology](#the-ontology)), and the
tagline does not need it.

## What Invana is

| Claim | Means |
|---|---|
| **Ontology-governed** | A Graph's ontology is the one contract people and agents share: every question, load, plan and change is checked against it ([The ontology](#the-ontology)) |
| **An operating system for humans and AI agents** | People and agents are both members of a Graph — held to the same ontology and access rules, working through the same runs, inbox and history ([The operating system](#the-operating-system)) |
| **Built for decisions** | Every product, feature and story serves a person making a decision — gather the data, give it meaning, ask, pursue a question, and decide with a trail anyone can follow |
| **An agent orchestrator over a curated graph** | Invana decides which agent takes a piece of work, what it may run, what it is offered, in what order, and who checks the result |
| **Bounded** | A **Graph** is a bounded domain a team curates — one graph database, its models, its data, its agents and its work. One Graph binds to exactly one graph database; an agent never crosses it |
| **Grounded** | Every question resolves against the Graph's published models, and every answer cites the records that produced it. When the Graph cannot answer, it says so rather than invent |
| **Third-party, badged** | Anything from beyond the Graph — the internet, another connected source, or the model's own knowledge — comes only where a view of the graph allows it, badged **third-party** with the reference it came from |
| **Governed** | An agent runs inside *what it may do*, a plan is checked before it runs, skills are offered rather than forced, and no agent accepts its own work |

## The ontology

A Graph's ontology is what its data means and what may hold in it. It is not one record: it is these parts together.

| Part | Is | Studio shows |
|---|---|---|
| **Models** | The kinds of node and relationship, and their properties | Model · Kind |
| **Links between models** | Declared meetings of two models — the same entity, or a relationship across them | Link between models |
| **Constraints** | A property's range with a unit, or a standard's values, on one kind | Constraint |
| **Standards** | Shared, versioned terms and allowed values a dataset claims | Standard |
| **Rules** | Statements that must always hold — on the install, a Graph or a project | Rule |
| **Views of the graph** | What agents may see when answering a question | A view of the graph |

| It governs | How |
|---|---|
| **A question** | Resolves against the published models; what they cannot answer becomes a request, never an invented answer |
| **A load** | Each record is checked against its model and constraints; what breaks them is rejected and reported |
| **An agent** | Sees the Graph only through a view of the graph; its plan is checked against the rules before it runs |
| **A change to the ontology** | Only as a draft, published by someone who can shape the model; a rule that refuses an ask keeps it as a request |
| **A person and an agent alike** | The same models, rules and access rules — an agent is held to nothing less than a person |

| Decision | Detail |
|---|---|
| *Ontology* is a vision and docs word | Studio never names the Graph's own ontology; it shows its parts by their glossary words |
| *From an ontology* stays on screen | There the word names an outside RDFS, OWL or schema.org file a model starts from — not the Graph's own ontology |

## The operating system

| An OS has | Invana has |
|---|---|
| **Users** | Members of a Graph — people and agents, each with access rules |
| **A type system** | The ontology — every record has a kind, every kind its rules |
| **Permissions** | Access rules, *what it may do*, and a mode on every act an agent takes — Allow · Ask · Deny |
| **Processes** | Runs — every execution of a plan, by a person or an agent, in one journal |
| **A scheduler** | Schedules, and workers with the runs a Graph may have going at once |
| **Resource limits** | Token budgets, and each Graph's limits set by the install |
| **Drivers** | Graph database connectors |
| **Extensions** | Plugins — tool, MCP and simulator plugins that add what agents can do |
| **Logs** | History, the change log and provenance — who did what, to which record, from which dataset |
| **A shell** | The Assistant and the Inbox — plain words in, work out; what needs a person waits there |

## Principles

| Principle | What it means |
|---|---|
| **Agents do the work** | From what the person says, an agent reads, plans, queries, harvests, loads and drafts — in the background |
| **The agent proposes, the person decides** | No blank forms where an agent could draft: it suggests, shows choices with a recommendation, and asks for a decision the person answers with a click |
| **Plain words in, work out** | A question in plain English becomes queries, a plan and an answer — or choices to pick from |
| **Simple by default** | The person sees the decision and its result, not the machinery |
| **Traceable on demand** | Every answer, proposal and act shows how it got there — steps, sources, assumptions, who did what — one click away, never on the first screen |
| **Acts only as far as the person allows** | Every act an agent takes is Allow, Ask or Deny, set by a person. A write, a send, a spend and an access change are Ask unless a person set otherwise, showing exactly what will happen; an access change is never Allow ([Settings](products/settings/product.md#decisions)) |
| **Split by persona** | An analyst never sees agent tuning; a builder never sees project branches ([personas](personas.md)) |

How these look on screen is [design-language.md](design-language.md); the words a person reads are
[glossary.md](glossary.md).

## Products

The products are the areas of Studio ([design-language.md](design-language.md) §8). Each sits in one of Invana's two
layers: the **operating system** runs the Graph and its ontology; **decision intelligence** is a person deciding over
it. The layers are how Invana is explained, never places in Studio.

| Code | Product | Layer | Tier | Lets a person |
|---|---|---|---|---|
| `EX` | [Explore](products/explore/product.md) | Decision intelligence | mode | Ask and look — boards, conversations, answers, annotations, memory |
| `MO` | [Model](products/model/product.md) | Operating system | mode · sheet | Give the data meaning — models, links between models, views of the graph, rules |
| `DA` | [Data](products/data/product.md) | Operating system | modal · sheet | Gather the data — datasets, versions, loads, standards and checks |
| `AG` | [Agents](products/agents/product.md) | Operating system | modal · sheet | Build agents and skills, read their runs, schedule them |
| `PJ` | [Projects](products/projects/product.md) | Decision intelligence | mode | Pursue a question — tasks, branches, findings, decisions, reports |
| `IN` | [Inbox](products/inbox/product.md) | Operating system | modal | Answer what needs them, see what runs, read what happened |
| `ST` | [Settings](products/settings/product.md) | Operating system | modal · sheet | Run this Graph, the install and their own account |
| `SH` | [Shell](products/shell/product.md) | Operating system | page · modal | Sign in, create a Graph and find their way |

## Scope

The install defines and limits; a Graph uses.

| Scope | Holds |
|---|---|
| **Install** | The dataset catalogue, standards, install-wide rules, the agents and skills catalogue, workers, AI models, plugins, each Graph's limits |
| **Graph** | Models, views of the graph, rules that must always hold, its members (people and agents), projects, runs |
| **Project** | Branches, tasks, findings, decisions, project rules |

| Rule | Detail |
|---|---|
| One install, one organisation | No multi-tenancy and no Organisation record; the install is the widest scope |
| Hosted means single-tenant | A hosted Invana is one instance per customer, never shared tenancy |
| An agent is a Graph member | A Graph invites an agent from the catalogue and gives it access; its definition, budget and instructions stay in the catalogue |

## What it is used for

The same records host different kinds of work; none is a special case.

| Use case | How it composes |
|---|---|
| **Curated context for AI** | Datasets and models linked into one picture an outside agent queries through a scoped token, with provenance on every row |
| **Deep search and research** | A document-shaped model, datasets an extractor produces, and skills that recall prior records |
| **Analytics** | A metrics-and-dimensions model and projections: a closed question in, a table or chart out |
| **Knowledge management** | Several models, linked, answered as one |
| **Compliance and audit** | The append-only history, criteria checked per task, and provenance from every element back to its dataset |
| **Domain intelligence** | A model of the entities that matter, and agents staffed on a project working tasks against criteria |
| **Domain memory** | The domain models its own memory as kinds; a planned recall step reads and cites prior records |
| **Decisions under uncertainty** | A project's branches, findings for and against, simulations over pinned datasets, and a decision checked by the rules |

## Not building

| Item | Why not |
|---|---|
| An extractor — source connectors, cursors, a mapping grammar | Invana is a destination: whatever already pulls the data hands it over as a dataset that conforms to a model |
| Write-back to a source | The Graph is the destination, never the system of record upstream |
| Fuzzy entity resolution · node merge on an anchor | Links between models are declared, never inferred; an anchor links, it never merges |
| Multi-tenancy · an Organisation record | One install is one organisation |
| Proprietary datasets · pricing · a marketplace | Datasets are reusable knowledge first |
| Provenance on every cell | Provenance is kept per dataset and per record; property changes live in the record's change log |
| Soft deletes · a trash tier · undo | Deletes are hard and cascade downward; retire and retract exist where history must stay resolvable |
| Parameter sweeps · game theory | After 1.0. Simulation is a simulator plugin run on a project branch |
| Authoring a plan by hand | Plans are generated from instructions or packaged with a plugin |
| Criterion weights and waivers | A criterion is met, unmet or needs a person |
| Styling a single element on the canvas | Not planned |
