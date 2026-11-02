# Vision

**Think it through. Decide with evidence.** Invana is a decision intelligence platform: it helps a person make
better decisions over a curated knowledge graph. Agents do the work; the person decides.

## What Invana is

| Claim | Means |
|---|---|
| **A decision intelligence platform** | Every product, feature and story serves a person making a decision — gather the data, give it meaning, ask, pursue a question, and decide with a trail anyone can follow |
| **An agent orchestrator over a curated graph** | Invana decides which agent takes a piece of work, what it may run, what it is offered, in what order, and who checks the result |
| **Bounded** | A **Graph** is a bounded domain a team curates — one graph database, its models, its data, its agents and its work. One Graph binds to exactly one graph database; an agent never crosses it |
| **Grounded** | Every question resolves against the Graph's published models, and every answer cites the records that produced it. When the Graph cannot answer, it says so rather than invent |
| **Third-party, badged** | Anything from beyond the Graph — the internet, another connected source, or the model's own knowledge — comes only where a view of the graph allows it, badged **third-party** with the reference it came from |
| **Governed** | An agent runs inside *what it may do*, a plan is checked before it runs, skills are offered rather than forced, and no agent accepts its own work |

## Principles

| Principle | What it means |
|---|---|
| **Agents do the work** | From what the person says, an agent reads, plans, queries, harvests, loads and drafts — in the background |
| **The agent proposes, the person decides** | No blank forms where an agent could draft: it suggests, shows choices with a recommendation, and asks for a decision the person answers with a click |
| **Plain words in, work out** | A question in plain English becomes queries, a plan and an answer — or choices to pick from |
| **Simple by default** | The person sees the decision and its result, not the machinery |
| **Traceable on demand** | Every answer, proposal and act shows how it got there — steps, sources, assumptions, who did what — one click away, never on the first screen |
| **Asks before it acts** | Anything that writes, sends, spends or changes access waits for the person, showing exactly what will happen |
| **Split by persona** | An analyst never sees agent tuning; a builder never sees project branches ([personas](personas.md)) |

How these look on screen is [design-language.md](design-language.md); the words a person reads are
[glossary.md](glossary.md).

## Products

The products are the areas of Studio ([design-language.md](design-language.md) §8).

| Code | Product | Tier | Lets a person |
|---|---|---|---|
| `EX` | [Explore](products/explore/product.md) | mode | Ask and look — boards, conversations, answers, annotations, memory |
| `MO` | [Model](products/model/product.md) | mode · sheet | Give the data meaning — models, links between models, views of the graph, rules |
| `DA` | [Data](products/data/product.md) | modal · sheet | Gather the data — datasets, versions, loads, standards and checks |
| `AG` | [Agents](products/agents/product.md) | modal · sheet | Build agents and skills, read their runs, schedule them |
| `PJ` | [Projects](products/projects/product.md) | mode | Pursue a question — tasks, branches, findings, decisions, reports |
| `IN` | [Inbox](products/inbox/product.md) | modal | Answer what needs them, see what runs, read what happened |
| `ST` | [Settings](products/settings/product.md) | modal · sheet | Run this Graph, the install and their own account |
| `SH` | [Shell](products/shell/product.md) | page · modal | Sign in, create a Graph and find their way |

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
