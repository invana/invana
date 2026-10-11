# Invana products

**Think it through. Decide with evidence.** — Invana is a toolkit for thinkers: gather the data, give it meaning, ask, pursue a question, and decide with a trail anyone can follow.

| | |
|---|---|
| What this is | The plan for splitting Studio into five products under one shell |
| Prototype | [Invana Products](https://claude.ai/artifact/HcPfkMUYUtEbRaZFaYnHtg) — 149 boards, one canvas page per product, **one row per user story** |
| Rule | Every board belongs to exactly one story; every story names its boards. The IDs here are the IDs on the frames |
| Status | Proposal. Nothing here is built; [`../for-developers/`](../for-developers/README.md) still governs code until it is reconciled ([Conflicts](#conflicts-with-for-developers)) |
| Plugins | [plugins.md](plugins.md) — every task type lives in a plugin, declared by a task manifest; versioned; runnable on any of N workers |
| CLI | Each product doc ends with its `invana` commands; conventions in [shell.md › CLI](shell.md#cli) |
| Migration | [migration-plan.md](migration-plan.md) — target packages, rules, phases · [migration-sessions.md](migration-sessions.md) — one runbook entry per session, and the log |
| Rebuild the prototype | `cd .design/canvas-products && python3 products.py` — refuses to write if a board has no story or a story names a missing board |

## The products

| # | Product | For | Job | Doc | Stories · boards |
|---|---|---|---|---|---|
| 1 | **Datasets** | researchers, curators, labs | Gather the data — reusable, labelled by origin, checked against standards | [datasets.md](datasets.md) | 14 · 22 |
| 2 | **Modeller** | modellers, compliance leads | Give it meaning — models, stitches, worlds, guardrails, rules | [modeller.md](modeller.md) | 14 · 29 |
| 3 | **Explorer** | analysts | Ask and look — the simplest product | [explorer.md](explorer.md) | 15 · 22 |
| 4 | **Projects** | thinkers: scientists, policy makers, investors, marketers, investigators | Pursue a question — fork, gather evidence for and against, decide, keep the lineage; a project type sets the words | [projects.md](projects.md) | 14 · 17 |
| 5 | **Agents** | builders | Build, tune and watch the agents that do the legwork | [agents.md](agents.md) | 16 · 30 |
| — | **Shell** (not a product) | everyone | What every product shares: header, breadcrumbs, Assistant, Activity, Schedules, Notifications, ⌘K | [shell.md](shell.md) | 17 · 29 |

- Launcher order is the thinker’s path: gather → give meaning → ask → pursue → delegate.
- The split is by persona: an analyst never sees agent tuning; a builder never sees project branches.
- Five is the ceiling. A sixth idea joins an existing product or the shell.

## What lives where

| Concern | Product | Not in |
|---|---|---|
| Datasets, provenance, versions, standards, validation, imports | Datasets | Modeller |
| Models, stitches, constraints, worlds, guardrails, rules, Graph settings | Modeller | — |
| Asking, answers, manual board tools, sessions | Explorer | — |
| Projects, branches, todos, findings, verdicts, decisions, reports, simulation, lineage | Projects | Agents |
| Agents, skills, instructions → plans, plugins and their task types, LLMs, performance | Agents | — |
| Schedules, runs, events, changes, approvals, notifications | Shell | Agents |

## Scope

| Scope | Holds | Header shows |
|---|---|---|
| Install | the dataset catalogue, standards, install-wide rules | no Graph (Datasets) |
| Graph | models, worlds, guardrails, agents, projects, runs | the Graph picker, then breadcrumbs |
| Project | branches, todos, findings, decisions, project rules | Graph › Projects › project › … |

- One install = one organisation. **No multi-tenancy, no Organisation record.** “Install-wide” is the widest scope.
- Hosted later = one instance per customer (managed single-tenant), never shared tenancy.

## Prerequisites

Capabilities that do not exist and block stories. Each needs a feature row in `for-developers/README.md` before code.

| ID | Capability | Blocks | Note |
|---|---|---|---|
| P-01 | Tool plugin runtime | AG-13 · DS-06 · SH-13 · PJ-09 | Plugins live in the engine (`invana/plugins/tools/`), dependencies as optional extras; each method registers a catalogue entry in the third-party layer |
| P-02 | MCP client | AG-13 | Connect an MCP server; its tools become task types in an `mcp` plugin |
| P-03 | Web search and fetch tools | DS-06 · SH-13 | Honour robots.txt; every row cites its URL |
| P-04 | Mail tools (read, send) | SH-13 | `mail.send` always asks for approval |
| P-05 | Science-source tools (PubMed, UniProt, PubChem, genebanks) | DS-06 · DS-10 | Official origin where the source is the author |
| P-06 | Simulation runtime | PJ-09 · PJ-10 (what-if values) | Today: *Not building, post-1.0*. Reach-by-hops in PJ-10 is plain traversal and is not blocked |
| P-07 | Domain simulator plugins (e.g. genomic prediction) | PJ-09 | The plugin does the science; Invana runs it, pins inputs, labels output derived |
| P-08 | Dataset record: origin, author chain, licence, versions, hash | all of Datasets | Revives the retired term *Dataset* |
| P-09 | Change log over every versioned record | SH-14 · AG-06 · AG-09 · MO-09 · DS-04 | Who, when, why, diff, effect after |
| P-10 | Project records: type, Branch, Finding (with stance), Verdict, Decision (supersede), Proposal, Report, merge | all of Projects | Projects stay flat; branches live inside |
| P-11 | Generated or packaged TaskPlans | AG-08 · AG-11 · SH-13 | Users never author plans: `generated` from instructions or `packaged` in a plugin pack; retire user-authored |
| P-12 | Install-wide scope for rules and standards | MO-12 · DS-08 | No tenancy; the install is the scope |
| P-13 | Notifications, channels and schedule delivery | SH-13 · SH-15 · SH-16 | Rules, in-app/email/Slack/webhook channels, approvals inbox, approval deadlines, missed-firing policy |
| P-14 | Per-project access | PJ-02 (private projects) | Membership is binary today; a project may be limited to its people |
| P-15 | Evals and draft/publish for skills and agents | AG-08 · AG-15 | Eval sets with rule checks + labelled LLM judge; hard checks gate publish; drift re-runs on triggers and nightly; a separate eval budget; drafts; one-click rollback |
| P-17 | Pinned model versions | AG-14 · SH-18 | Model versions by provider version name; agents, skills and judges pin one; every run records its versions; re-run on the same versions |
| P-18 | Roles and access | SH search filtering · PJ-02 · MO-05 · DS retraction | Graph roles Viewer · Contributor · Builder · Modeller · Owner; install Admin; read-only views with disabled acts |
| P-19 | Semantic imports | DS-F17 · MO-F14 | SKOS → standards; RDFS/OWL subset (incl. schema.org) → draft models; JSON-LD · Turtle · RDF/XML; import reports list what was skipped |
| P-20 | Intent-ranked templates | EX answers · AG-12 | The intent classifier returns `prefer: chart \| table \| graph`; `select_template` ranks by it instead of substring-matching the raw question. Small |
| P-21 | Distributed execution | thousands of tasks, failover, Kubernetes | **Required:** N workers scale runs and tasks per second; a worker can die without losing work. Tasks travel as serialisable envelopes ([plugins.md](plugins.md#7-ready-for-n-workers)). The executor (procrastinate · Dramatiq · Prefect) is chosen by benchmark; `inline` stays the single-machine default |
| P-16 | Breaking-publish review and migration runs | MO-05 | Additive publishes go straight through; breaking ones preview a migration run and need another member’s approval |

## Terms this plan adds or changes

| Term | Meaning | Change |
|---|---|---|
| Product | One of Datasets · Modeller · Explorer · Projects · Agents | New |
| Shell | The layout every product sits in; not a product | Narrowed |
| Dataset | Tables or documents from one source under one authorship; install-wide; versioned | **Revived** (terminology.md retires it) |
| Origin | `official · collected · generated · observed · derived` — set per dataset, inherited by records | New |
| Author chain | original authors → collected by → modified by → validated by | New |
| Standard | A versioned, shared set of terms, allowed values and required fields; a pack or org-authored | New |
| Constraint | A range or rule on one model property | Named |
| Conformance | A dataset’s score against a standard it claims, with violations | New |
| Rule | A statement always true, scoped install · Graph · project, checked block · warn · report | Scope widened |
| Branch | A line of inquiry in a project; forks, merges, parks, drops | New |
| Finding | A claim a branch learned, with its evidence | New |
| Decision | pursue · park · drop · merge on a branch, with rationale, checked by rules | New |
| Lineage | Decision → findings → runs → datasets → original authors | New |
| Project type | Research · Investment · Policy · Market · Investigation · General — sets a project’s words and first panel | New |
| Verdict | Whether a branch’s hypothesis held up, separate from the decision | New |
| Stance | A finding supports, contradicts or gives context to its branch | New |
| Proposal | An agent’s suggested fork or decision, accepted or rejected by a person | New |
| Report | A project write-up drafted from its records, published as a frozen version | New |
| Sensitivity | public · internal · confidential · personal — on a dataset or column, read by guardrails | New |
| Retracted | A dataset version withdrawn by its source; kept, and everything citing it is flagged | New |
| Role | Viewer · Contributor · Builder · Modeller · Owner per Graph; Admin per install. Membership stops being binary | Changed |
| Task type | One callable the runtime can run, declared by a task manifest in a plugin; a plan's Task uses one | Replaces *catalogue entry* |
| Plugin | A versioned folder of task types, skills and flows with a `plugin.yaml` | New |
| Eval set | Fixed questions with checks, replayed before a skill or agent version is published | New |
| Token budget | The tokens an agent, schedule or eval set may spend in a period. Budgets are never in currency | Changed (terminology.md says *cost ceiling*) |
| Model version | A provider’s exact model name (`claude-opus-5-5`); pinned by agents, recorded on every run | New |
| Change log | Every version of every versioned record, with its effect after | New |
| TaskPlan origin `authored` | — | **Retired** for users: a plan is `generated` from instructions.md or `packaged` in a plugin pack |

## Conflicts with for-developers

| Doc says today | This plan | Resolve by |
|---|---|---|
| `explore/spec.md`: no separate modeller page | Modeller is its own product | Rewrite the non-goal |
| `graph-detail-page.md` G15: one graph page | Five products, one shell | Replace G15 |
| `terminology.md`: *Dataset* retired for *Model* | Dataset revived, above Graphs | Add the term back with its new meaning |
| `terminology.md`: Graph is the outermost container | Install-wide catalogue, standards, rules | Add *install* scope |
| `terminology.md`: TaskPlan origins `authored · generated · promoted` | `generated` · `packaged` | Retire user-authored; add `packaged` (decide whether `promoted` stays) |
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
| TaskPlans | No — always generated |
| Projects | No — a published finding travels as a derived dataset |

- Formats: Frictionless Data Package for datasets, RO-Crate for research bundles, DCAT for the catalogue.

## Not building

| Item | Why |
|---|---|
| Multi-tenancy, an Organisation record | One install = one organisation |
| Proprietary datasets, pricing, marketplace | Not decided; datasets are reusable knowledge first |
| An import UI (bulk upload, mapping) | Bulk loads stay on the CLI and API; small observation entry is the only UI write |
| A sixth product | Five is the ceiling |
| Provenance on every cell | Dataset + record level; property changes live in the record’s change log |
