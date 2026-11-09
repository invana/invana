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
| The API description | `docs/api/openapi.yaml` | Positioning | — |
| The team's instructions | `CLAUDE.md` · `.claude/team/TEAM.md` | Positioning | — |
| Studio sign-in | `studio/packages/shell/src/pages/auth/LoginPage.tsx` | *Invana* | Tagline |
| Studio Graphs list | — | *Invana Studio* | — |

| Decision | Detail |
|---|---|
| One headline, checked | Every file in the table carries the positioning and tagline its row names, word for word; `scripts/specs/check.py` checks each one |
| The vision and the README | The vision says what Invana is and why; the README says what works today and how to run it. The README names a pillar and links here — it never explains one; the vision never holds a status, an install step or an integration list |

Studio never shows the positioning statement: *ontology* is not a Studio word ([The ontology](#the-ontology)), and the
tagline does not need it.

## What Invana is

| Claim | Means |
|---|---|
| **Ontology-governed** | A Graph's ontology is the one contract people and agents share: every question, load, plan and change is checked against it ([The ontology](#the-ontology)) |
| **A decision intelligence platform** | Every pillar, capability, feature and story serves a person making a decision: the data is given meaning, agents work it into insight, and the evidence is shown so the person decides with a trail anyone can follow ([Pillars and capabilities](#pillars-and-capabilities)) |
| **For humans and AI agents** | People and agents are both members of a Graph — held to the same ontology and access rules, run by the same operating system, in the same history ([The operating system](#the-operating-system)) |
| **An agent orchestrator over a curated graph** | Invana decides which agent takes a piece of work, what it may run, what it is offered, in what order, and who checks the result |
| **Bounded** | A **Graph** is a bounded domain a team curates — one graph database, its models, its data, its agents and its work. One Graph binds to exactly one graph database; an agent never crosses it |
| **Grounded** | Every question resolves against the Graph's published models, and every answer cites the records that produced it. When the Graph cannot answer, it says so rather than invent |
| **Third-party, badged** | Anything from beyond the Graph — the internet, an outside service, or the model's own knowledge — comes only where a view of the graph allows it, badged **third-party** with the reference it came from |
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

The layer under every pillar: what runs the platform for people and agents alike. It is not a pillar and never a
product — it is how Invana works, in every install. It enforces the ontology; the Ontology pillar owns it.

| Part | Answers | Holds | Spec today |
|---|---|---|---|
| **Graph** | Where am I working? | Create a Graph and connect its graph database · its members, people and agents · usage · finding the way — modes, crumbs, ⌘K · notifications | [Shell](foundation/shell/product.md) · [Settings](foundation/settings/product.md) › This graph · [Inbox](foundation/inbox/product.md) › notifications |
| **Access** | Who may act, and what did they do? | Sign-in, accounts, sessions and keys · access lines, Allow · Ask · Deny, for people, agents and keys alike · asks and approvals · History | [Shell](foundation/shell/product.md) › sign in · [Settings](foundation/settings/product.md) › People and access · You · [Inbox](foundation/inbox/product.md) › Needs you · History |
| **Runtime** | What does the work, within which limits? | AI models · plugins and outside tools · workers, schedules' capacity and each Graph's limits · graph database connectors | [Settings](foundation/settings/product.md) › AI models · Plugins · Workers and limits |

| An OS has | Invana has | Part |
|---|---|---|
| **Users** | Members of a Graph — people and agents, each with access rules | Graph · Access |
| **A type system** | The ontology — every record has a kind, every kind its rules; owned by the Ontology pillar, enforced here | — |
| **Permissions** | Access rules whose every line is Allow · Ask · Deny — one model for people, agents and keys alike — and *what it may do* | Access |
| **Processes** | Runs — every execution of a plan, by a person or an agent, in one journal | Runtime |
| **A scheduler** | Schedules, and workers with the runs a Graph may have going at once | Runtime |
| **Resource limits** | Token budgets, and each Graph's limits set by the install | Runtime |
| **Drivers** | Graph database connectors | Runtime |
| **Extensions** | Plugins — tool, MCP and simulator plugins that add what agents can do | Runtime |
| **Logs** | History, the change log and provenance — who did what, to which record, from which dataset | Access |
| **A shell** | The Assistant and the Inbox — plain words in, work out; what needs a person waits there | Graph |

## Principles

| Principle | What it means |
|---|---|
| **Agents do the work** | From what the person says, an agent reads, plans, queries, harvests, loads and drafts — in the background |
| **The agent proposes, the person decides** | No blank forms where an agent could draft: it suggests, shows choices with a recommendation, and asks for a decision the person answers with a click |
| **Plain words in, work out** | A question in plain English becomes queries, a plan and an answer — or choices to pick from |
| **Simple by default** | The person sees the decision and its result, not the machinery |
| **Traceable on demand** | Every answer, proposal and act shows how it got there — steps, sources, assumptions, who did what — one click away, never on the first screen |
| **Acts only as far as the person allows** | Every act — a person's, an agent's or a key's — is Allow, Ask or Deny by the lines a person set; what no line reaches is denied, and the strictest line wins. An Ask waits for someone who holds Allow on it, showing exactly what will happen, and is never decided by the one it benefits; an agent's access change is never Allow ([Settings](foundation/settings/product.md#decisions)) |
| **Split by persona** | An analyst never sees agent tuning; a builder never sees project branches ([personas](personas.md)) |

How these look on screen is [design-language.md](design-language.md); the words a person reads are
[glossary.md](glossary.md).

## Pillars and capabilities

Invana is one platform. What it offers is three **pillars**; each holds the **capabilities** a person works in, and
all of them run on [the operating system](#the-operating-system). How each looks in Studio is
[design-language.md](design-language.md) §8.

| Pillar | Promise | Capabilities |
|---|---|---|
| **Ontology** | Data that means one thing, checked before it lands | Model · Data · Datasets, later |
| **Agents** | Agents that work the data into insight and do the work, only as far as people allow | Agents |
| **Evidence** | Every answer shown with the records behind it — the person decides | Explore · Projects |

| Code | Capability | Pillar | Tier | Lets a person |
|---|---|---|---|---|
| `MO` | [Model](products/model/product.md) | Ontology | mode · sheet | Give the data meaning — models, links between models, views of the graph, rules |
| `DA` | [Data](products/data/product.md) | Ontology | modal · sheet | Know the Graph's records — by kind, against the model, fixed, traced and annotated |
| `DS` | [Datasets](products/datasets/product.md), later | Ontology | modal · sheet | Gather data across the install — datasets, versions, loads, standards and checks |
| `AG` | [Agents](products/agents/product.md) | Agents | modal · sheet | Build agents and skills, read their runs, schedule them |
| `EX` | [Explore](products/explore/product.md) | Evidence | mode | Ask and look — boards, conversations, answers traced to their records, annotations, memory |
| `PJ` | [Projects](products/projects/product.md) | Evidence | mode | Pursue a question — tasks, branches, findings for and against, decisions, reports |

| Decision | Detail |
|---|---|
| One platform | Invana is offered whole. Pillars and capabilities are how it is explained, never sold apart; every install has all three pillars and the operating system |
| Pillars group the capabilities; the operating system runs them | These are the only two groupings. A capability belongs to one pillar; the operating system belongs to none |
| Decision intelligence is the category, evidence the difference | Invana shows the evidence and the person decides; it never decides for them |
| A part of the operating system serves every capability | An ask, an access line, a limit or a way in that only one capability needs belongs to that capability |
| Vision and docs words | *Pillar*, *capability*, *operating system* and *instance* are never shown in Studio; a person sees the modes and overlays by their own names |

## Scope

The install defines and limits; a Graph uses.

| Scope | Holds |
|---|---|
| **Install** | The dataset catalogue, standards, install-wide rules, the agents and skills catalogue, workers, AI models, plugins, each Graph's limits |
| **Graph** | Models, records, annotations, views of the graph, rules that must always hold, its members (people and agents), projects, runs |
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
| Fuzzy entity resolution · node merge on an anchor | Links between models are declared, never inferred; an anchor links, it never merges. Two records merge only when a person picks them ([Data](products/data/product.md), later) |
| Multi-tenancy · an Organisation record | One install is one organisation |
| Proprietary datasets · pricing · a marketplace | Datasets are reusable knowledge first |
| Provenance on every cell | Provenance is kept per dataset and per record; property changes live in the record's change log |
| Soft deletes · a trash tier · undo | Deletes are hard and cascade downward; retire and retract exist where history must stay resolvable |
| Parameter sweeps · game theory | After 1.0. Simulation is a simulator plugin run on a project branch |
| Authoring a plan by hand | Plans are generated from instructions or packaged with a plugin |
| Criterion weights and waivers | A criterion is met, unmet or needs a person |
| Styling a single element on the canvas | Not planned |
