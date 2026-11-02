# Invana products

What Invana is for, its products and their scope now live in [`specs/vision.md`](../../specs/vision.md) and `specs/products/*/product.md`; what is left here waits for review.

| | |
|---|---|
| What this is | The plan for Studio's products in two places — the platform and a Graph — under one shell |
| Prototype | [Invana Products](https://claude.ai/artifact/HcPfkMUYUtEbRaZFaYnHtg) — 149 boards, one canvas page per product, **one row per user story** |
| Rule | Every board belongs to exactly one story; every story names its boards. The IDs here are the IDs on the frames |
| Status | Superseded. What is decided is in [`specs/`](../../specs/README.md); what is left here is listed for review in [the for-developers index](../for-developers/README.md) |
| Plugins | [plugins.md](plugins.md) — every task type lives in a plugin, declared by a task manifest; versioned; runnable on any of N workers |
| CLI | Each product doc ends with its `invana` commands; conventions in [shell.md › CLI](shell.md#cli) |
| Migration | [migration-plan.md](migration-plan.md) — target packages, rules, phases · the session runbook and its log are kept with the team's finished projects |
| Rebuild the prototype | `cd .design/canvas-products && python3 products.py` — refuses to write if a board has no story or a story names a missing board |

## The products

| # | Product | For | Job | Doc | Stories · boards |
|---|---|---|---|---|---|
| 1 | **Datasets** | researchers, curators, labs | Gather the data — reusable, labelled by origin, checked against standards | [datasets.md](datasets.md) | 14 · 22 |
| 2 | **Modeller** | modellers, compliance leads | Give it meaning — models, stitches, worlds, guardrails, rules | [modeller.md](modeller.md) | 14 · 29 |
| 3 | **Explorer** | analysts | Ask and look — the simplest product | [explorer.md](explorer.md) | 15 · 22 |
| 5 | **Agent Builder** · platform | install Admins | Build agents and skills once; every Graph invites them | [agent-builder.md](agent-builder.md) | 15 · 47 |
| — | **Fleet** · **Settings** · platform | install Admins | Worker pools; LLM providers, plugins, MCP, each Graph's limits | [platform.md](platform.md) | 7 · 23 |
| 6 | **IAM** · a Graph | owners, admins | Who may do what — people, groups, agents, tokens and connections hold policies; limits and quotas | [iam.md](iam.md) | 13 · 21 |
| 7 | **Projects** · *experimental* | thinkers: scientists, policy makers, investors, marketers, investigators | Pursue a question — fork, gather evidence for and against, decide, keep the lineage; a project type sets the words | [projects.md](projects.md) | 14 · 17 |
| — | **Onboarding** (not a product) | whoever creates or joins a Graph | From a new Graph to a first answer, by persona: existing graph database · CSV files · trying it out · invited | [onboarding.md](onboarding.md) | 2 · 5 |
| — | **Shell** (not a product) | everyone | What every product shares: header, breadcrumbs, Assistant, Activity, Schedules, Notifications, ⌘K | [shell.md](shell.md) | 17 · 29 |

- Launcher order: *Invana* — Home · Datasets · Agent Builder · Fleet · Settings; then, while a Graph is open, *This Graph · name* — Modeller · Explorer · Projects (experimental) · Activity · IAM · Graph settings.

## Two places

Prototype: the *Invana Spaces* staging canvas (<https://claude.ai/artifact/WnzjmRH8tNUGz8cGqfNHFv>), ported into Invana Products.

| Place | Products | Header |
|---|---|---|
| **Platform** | Home · Datasets · Agent Builder · Fleet · Settings | the product, no Graph picker |
| **A Graph** | Explorer · Modeller · Projects (experimental) · Imports (as today, open) · IAM · Graph settings · Activity | the product, then the Graph picker |

- **The launcher** lists *Invana* first, then *This Graph · name* when a Graph is open; with no Graph open it lists the platform's products only (SH-04, SH-24). Each product keeps its own rail.
- **Activity** holds the open Graph's runs, approvals and ledger. A run page opens in the Graph it ran in; *Improve skill* opens the skill in the Agent Builder with the run as an eval case and a way back (AC-01).
- **Graph settings** is its own Graph product (General · Connection · Members · Usage); it left the Modeller.
- **URLs**: platform products `/builder/…` · `/fleet/…` · `/settings/…` · `/datasets/…`, a person's own settings `/profile`; Graph products `/u/:user/:graph/<product>/…`, Graph settings `…/settings/<section>` ([AG-F02](../../specs/products/agents/features/AG-F02-the-agents-catalogue/feature.md)).
- **Build**: run as a project of its own, *two-places*.

## Prerequisites

Capabilities that do not exist and block stories. Each needs a feature in `specs/` before code.

| ID | Capability | Blocks | Note |
|---|---|---|---|
| P-01 | Tool plugin runtime | AG-13 · DS-06 · SH-13 · PJ-09 | ✅ B06b (engine) · ✅ C03 (Studio: Agents › Plugins, a plugin's page, a task type's page) — [ST-F04 · Plugins and outside tools](../../specs/products/settings/features/ST-F04-plugins-and-outside-tools/feature.md): one extra each, Admin-enabled, run in workers under procrastinate. Plugins live in the engine (`invana/plugins/tools/`), dependencies as optional extras; each method registers a catalogue entry in the third-party layer |
| P-02 | MCP client | AG-13 | ✅ B07 (engine) — [ST-F04](../../specs/products/settings/features/ST-F04-plugins-and-outside-tools/feature.md): connect an MCP server; its tools become task types in an `mcp` plugin, frozen when added, loaded at start-up, Admin-enabled |
| P-03 | Web search and fetch tools | DS-06 · SH-13 | ✅ B06b (engine) — `web.search` (SearXNG) · `web.fetch` · `web.download_and_extract`. Honour robots.txt; every row cites its URL |
| P-04 | Mail tools (read, send) | SH-13 | ✅ B06b (engine) — `mail.read` · `mail.send`, held on an approval in the inbox. `mail.send` always asks for approval |
| P-05 | Science-source tools (PubMed, UniProt, PubChem, genebanks) | DS-06 · DS-10 | ✅ B06b (engine) — `pubmed.search` · `uniprot.get` · `pubchem.get`; genebanks not yet. Official origin where the source is the author |
| P-06 | Simulation runtime | PJ-09 · PJ-10 (what-if values) | ✅ B09 — [PJ-F04 · Simulation and impact](../../specs/products/projects/features/PJ-F04-simulation-and-impact/feature.md). Reach-by-hops in PJ-10 is plain traversal: Studio C06 ([PJ-F04](../../specs/products/projects/features/PJ-F04-simulation-and-impact/feature.md)). Studio draws PJ-09 in C06 |
| P-07 | Domain simulator plugins (e.g. genomic prediction) | PJ-09 | ✅ B09 — the simulator contract ([ST-F04](../../specs/products/settings/features/ST-F04-plugins-and-outside-tools/feature.md)) and `sim.genomic_prediction`. The plugin does the science; Invana runs it, pins inputs, labels output derived |
| P-08 | Dataset record: origin, author chain, licence, versions, hash | all of Datasets | Revives the retired term *Dataset* |
| P-09 | Change log over every versioned record | SH-14 · AG-06 · AG-09 · MO-09 · DS-04 | ✅ B01 · C04 (Studio: the Events tab's Changes filter, the compare page, a model's History, a record's change log naming who) — Who, when, why, diff, effect after |
| P-10 | Project records: type, Branch, Finding (with stance), Verdict, Decision (supersede), Proposal, Report, merge | all of Projects | Projects stay flat; branches live inside |
| P-11 | Generated or packaged Flows | AG-08 · AG-11 · SH-13 | ✅ C03 (Studio: a skill's plan generated from its instructions, what a publish regenerated, revisions in runs) — Users never author plans: `generated` from instructions or `packaged` in a plugin pack; retire user-authored |
| P-12 | Install-wide scope for rules and standards | MO-12 · DS-08 | Settled: no tenancy, the install is the scope ([modeller › Rule scope](modeller.md#decisions)); built in M06 |
| P-13 | Notifications, channels and schedule delivery | SH-13 · SH-15 · SH-16 | ✅ B08 (engine) · ✅ C05 (Studio: Activity › Schedules, a schedule's page, the Inbox with approval review, Rules, Channels) — Rules, in-app/email/Slack/webhook channels, approvals inbox, approval deadlines, missed-firing policy |
| P-14 | Per-project access | PJ-02 (private projects) | Membership is binary today; a project may be limited to its people |
| P-15 | Evals and draft/publish for skills and agents | AG-08 · AG-15 | ✅ C03 (Studio: drafts and publish on agents and skills, the eval set and runs, the gate's refusal, restore from History; AG-15 Performance ✅ C10) — Eval sets with rule checks + labelled LLM judge; hard checks gate publish; drift re-runs on triggers and nightly; a separate eval budget; drafts; one-click rollback |
| P-17 | Pinned model versions | AG-14 · SH-18 | ✅ C03 · C09 · C10 (Studio: an agent's and a skill's pin; the LLMs page with who pins each version — agents, skills, judges ✅ C10; re-run on the run page ✅ C09) — Model versions by provider version name; agents, skills and judges pin one; every run records its versions; re-run on the same versions |
| P-18 | Roles and access | SH search filtering · PJ-02 · MO-05 · DS retraction | Graph roles Viewer · Contributor · Builder · Modeller · Owner; install Admin; read-only views with disabled acts |
| P-19 | Semantic imports | DS-F17 · MO-F14 | ✅ B12 (engine) — [DA-F04 · Standards and checks](../../specs/products/data/features/DA-F04-standards-and-checks/feature.md) · [MO-F01 · Start a model](../../specs/products/model/features/MO-F01-start-a-model/feature.md). SKOS → standards; RDFS/OWL subset (incl. schema.org) → draft models; JSON-LD · Turtle · RDF/XML; import reports list what was skipped. ✅ Studio C08 |
| P-20 | Intent-ranked templates | EX answers · AG-12 | ✅ B13 (engine) — [EX-F04 · The answer](../../specs/products/explore/features/EX-F04-the-answer/feature.md). The intent classifier returns `prefer: chart \| table \| graph`; `select_template` ranks by it instead of substring-matching the raw question. Small |
| P-21 | Distributed execution | thousands of tasks, failover, Kubernetes | **Required:** N workers scale runs and tasks per second; a worker can die without losing work. Tasks travel as serialisable envelopes ([plugins.md](plugins.md#7-ready-for-n-workers)). The executor (procrastinate · Dramatiq · Prefect) is chosen by benchmark; `inline` stays the single-machine default |
| P-22 | The CLI as an API client | `invana login` · every CLI import from a laptop (ON-02, DS-13) | **Required:** today every command opens the app database directly, so it only runs beside the engine. Signed in with an access token, the same commands call the engine's API, so an analyst runs them on their own machine |
| P-16 | Breaking-publish review and migration runs | MO-05 | ✅ B10 · C04 (Studio: the Publish confirm asks the engine, names who reads the model, and a breaking draft requests approval) — [MO-F02 · Change and publish a model](../../specs/products/model/features/MO-F02-change-and-publish-a-model/feature.md). Additive publishes go straight through; breaking ones preview a migration run and need another owner’s approval |

## Terms this plan adds or changes

| Term | Meaning | Change |
|---|---|---|
| Product | One of Datasets · Modeller · Explorer · Projects · Agents | New |
| Shell | The layout every product sits in; not a product | Narrowed |
| Author chain | original authors → collected by → modified by → validated by | New |
| Constraint | A range or rule on one model property | Named |
| Role | Viewer · Contributor · Builder · Modeller · Owner per Graph; Admin per install. Membership stops being binary | Changed |
| Flow origin `authored` | — | **Retired** for users: a plan is `generated` from instructions.md or `packaged` in a plugin pack |

## Conflicts with for-developers

| Doc says today | This plan | Resolve by |
|---|---|---|
| `explore/spec.md`: no separate modeller page | Modeller is its own product | Rewrite the non-goal |
| `graph-detail-page.md` G15: one graph page | Five products, one shell | Replace G15 |
| `terminology.md`: *Dataset* retired for *Model* | Dataset revived, above Graphs | Add the term back with its new meaning |
| `terminology.md`: Graph is the outermost container | Install-wide catalogue, standards, rules | Add *install* scope |
| `terminology.md`: Flow origins `authored · generated · promoted` | `generated` · `packaged` | Retire user-authored; add `packaged` (decide whether `promoted` stays) |
| `terminology.md`: Projects are flat, no sub-projects | Branches fork and merge inside a project | Projects stay flat; branches are not sub-projects |
| `bring-data-in` lives with Modeller | Imports move to Datasets | Move the surface |
| Library › Plans is an authoring surface | Plans are read-only, generated | Remove plan authoring |
| `orchestration.md` §5.1: *not a plugin host* | Engine-internal plugins register task types | Allow Admin-enabled in-engine plugins |
| `orchestration.md` §5.1: *not a job scheduler; does not distribute* | The runtime hands execution to a distributed executor | Still the orchestrator; execution becomes pluggable |
| `README.md`: Simulation is *Not building, post-1.0* | PJ-09 needs it | Keep post-1.0; P-06 names the dependency |
| `terminology.md`: Budget is a *cost ceiling* | Budgets are token ceilings; no currency shown | Restate Budget in tokens |
| Earlier decision: MCP out of scope | AG-13 lists MCP servers | P-02 — planned, not in the current slices |

## Open registry (later)

| Phase | Ships | Needs |
|---|---|---|
| 0 · now | Seams only: `publisher/name`, immutable versions, content hash, references by version, licence required, provenance inside the version | Datasets, Standards, Models feature files |
| 1 | `invana pack` / `invana unpack` — files with provenance | Phase 0 |
| 2 | `invana publish` / `invana pull` against any registry URL; an install can host a private one | Phase 1 |
| 3 | An Invana-hosted public hub: search, publishers, versions, validation badges | Phase 2 |
| 4 | Community: forks, reviews, “used by” | Phase 3 + moderation |

| Goes in the registry | Yes / no |
|---|---|
| Datasets · Standards · Graph models | Yes |
| Skills (instructions.md) | Decide in phase 3 — executable instructions carry risk |
| Flows | No — always generated |
| Projects | No — a published finding travels as a derived dataset |

- Formats: Frictionless Data Package for datasets, RO-Crate for research bundles, DCAT for the catalogue.

## Not building

| Item | Why |
|---|---|
| An import UI (bulk upload, mapping) | Bulk loads stay on the CLI and API; small observation entry is the only UI write |
| A sixth product | Five is the ceiling |
