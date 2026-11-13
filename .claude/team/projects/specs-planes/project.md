---
name: specs-planes
status: done
branch: spec/planes
scope: specs-planes
---

# Specs — the planes

Rewrite `specs/` for one deployment with no Graph unit: graph databases stitched into one Graph, a system graph for the
thinking graph, the Control Plane and the Access Plane, agents-only access, plans that become workflows, and an
inbound/outbound ledger — so a person can trust, audit and control everything an agent does with their data.

| | |
|---|---|
| Goal | Every file in `specs/` describes the model in *Decisions* below: no per-Graph unit, workspace or tenant remains; the operating system is the Control Plane (`CP`) and the Access Plane (`AC`); the pillars are Ontology · Intelligence · Agents · Evidence; every story's *Who can* uses Operator · Modeller · Admin; `check.py` and the link check are green |
| Specs | All of `specs/**`: `vision.md` · `glossary.md` · `system-design.md` · `personas.md` · `design-language.md` · `ontology.md` · `migrations.md` · every journey · every product, feature and story in `specs/os/**` and `specs/capabilities/**` · the *Core features* pillar column of `README.md` |
| Not in this project | Engine, Studio and integrations code (a later code project; each needed change is a row in `specs/migrations.md`) · boards (the designer, after these specs are reviewed) · the canvas and design-kit repos · the headline and sub-line (unchanged) · the website · `.claude/**` except this file and `recommend` rows |

Run it: `python3 .claude/skills/run-project/run.py specs-planes` (the project-lead does, with `--start`).

## Decisions

Settled with Ravi on 2026-11-13. Every phase writes these into the spec files that own them; none is reopened in a
phase — a conflict is a question in *Questions for Ravi*.

| # | Area | Decision |
|---|---|---|
| D1 | Deployment | One deployment is everything: no workspaces, no tenants, no per-Graph unit. Multi-tenancy stays out of scope |
| D2 | Words | **Connector** = the package (`invana-neo4j`) · **graph database** = one configured connection · **Graph** = the stitched model and data across every graph database, one per deployment · **system graph** = Invana's own, never part of the Graph |
| D3 | Structure | Operating system: **Control Plane** (`CP`, absorbs Runtime `RT` and the Graph part `GR`) and **Access Plane** (`AC`). Pillars: Ontology · Intelligence · Agents · **Evidence**. *Decision Graphs* is the story across Agents and Evidence, not a pillar |
| D4 | Lines | Headline, positioning, tagline, philosophy and motto are unchanged |
| D5 | System graph | Bundled **ArcadeDB**, governed by a read-only, versioned **system ontology** shipped with Invana. Holds the thinking graph, ledger edges, identity links and lineage — never customer data |
| D6 | Truth | **Postgres is the source of truth**; the system graph follows through an outbox, retried, rebuildable from History |
| D7 | Stitching | One query step per graph database in its own language; the engine joins results on identity links. No customer data is copied |
| D8 | Identity links | A Modeller declares match rules per kind pair; agents may propose rules; links are materialised from the rules in the system graph. Never guessed silently |
| D9 | Connector mode | One credential per graph database. A connection is initialised **read-only** or **read + write** (Admin only, a History row). Reads always use the driver's read mode or `ReadOnlyStrategy` |
| D10 | Queries | The LLM writes a **typed query plan** (kinds, properties, filters, hops, aggregates) from the model, never from records; the engine validates it against the model and policy, then compiles it to Cypher or Gremlin. When a plan cannot express a question, the agent says so and offers a function — never a silent raw query |
| D11 | Access | **Agents only.** Users hold the agents they may use plus one role; agents hold every Read · Write · Run. Direct human acts run as built-in agents. Default deny; strictest wins |
| D12 | Access Policy | A named list of **rules**: effect (Allow · Ask · Deny) · verb (Read · Write · Run) · resource `type/name` with whole-segment `*` (`data/<graph-database>/<kind>` · `skill/` · `workflow/` · `agent/` · `plugin/` · `tool/<plugin>/<tool>`). A rule may name a **team** — its only condition — and applies when the person behind the run is on it. Policies attach to agents |
| D13 | Teams | Flat user groups, no nesting. Teams own nothing |
| D14 | Roles | **Operator · Modeller · Admin**, with one fixed role × feature table in AC, enforced by the engine, never customer-editable |
| D15 | Ownership | Only human users and the **system user** (no login) own resources. Co-owners allowed. Whatever an agent creates is owned by the person behind the run. Built-ins are system-owned, copied to customise, never edited. Decisions are not owned: immutable, superseded |
| D16 | Approvals | **Named approvers per agent** (people or a team); none named → the agent's owners; never the one it benefits. Unanswered: remind → escalate to owners and Admins → expire as refused, never auto-allowed |
| D17 | Channels | Asks and alerts reach people in the Inbox, email, Slack/Teams and webhooks; every decision is a History row whatever the channel |
| D18 | Switches | On/off at **install** (Admin; hard off) and **user** (self; narrows only runs they are behind). New plugins and graph databases start **off** until an Admin turns them on. Core plugins cannot be switched off |
| D19 | Off means | Work needing a switched-off graph database or plugin is refused before it starts, naming who switched it; schedules skip the firing and raise an alert; a workflow that depends on it is flagged and its runs refused |
| D20 | Plans | Ladder: one function → reuse a workflow with new arguments → compose from workflows → draft a new plan. A plan may call any published workflow as a pinned `composite` step (depth limit, no cycles, the pre-run check covers the tree). Plans hold no data: literals become declared arguments on approval |
| D21 | Workflows | A plan becomes a **workflow** when the agent's named approvers approve it; the asker is its first owner. Workflows are read-only; a change is a new version. Approval is for reuse, never to run a one-off plan |
| D22 | Thinking graph | Every plan, workflow, run, step, evidence, finding and decision is a node in the system graph. Recall ranks by outcome; failures stay as *avoid*. Keep all history; recall ages out. Outcome labels (served, accepted, contradicted later, marked good or bad) steer planning |
| D23 | What-if | Simulation is a reasoning method (EX-F05) whose output is evidence labelled *predicted*. PJ-F04 is removed; impact moves to PJ-F03 |
| D24 | Ledger | Every LLM, tool and graph-database call is recorded: run · step · agent · person behind · direction · target · class (**schema-only** or **data-bearing**) · kinds, fields and record IDs sent · response schema · tokens · keyed hashes. Reads keep query, kinds, counts and a result hash, IDs up to a cap; anything sent to an LLM or tool keeps every ID |
| D25 | Privacy | Models are marked **local** or **external**; sensitive properties never go to an external model (refused, naming the property). Run content is readable by the person behind it, the agent's owners and Admins; others see that it ran, its status and its cost |
| D26 | Storage | Files go through one blob interface over the **S3 API** only (**boto3**). Default store **RustFS** (pinned by digest); production uses Amazon S3 or the customer's S3-compatible store. Data layer stays SQLAlchemy 2 async + Alembic with our managers and querysets |
| D27 | Encryption | Envelope encryption (AES-256-GCM via `cryptography`), one data key per object wrapped by the **install key** — file or env for pilots (Studio warns), HashiCorp Vault Transit in production, cloud KMS later. Secrets in Postgres use the same key. Purge by crypto-shredding |
| D28 | Customer writes | Annotations and derived facts (inference, saved derived records) are written to the customer's graph database; they need a read + write connection and Write permission; derived facts are labelled *derived* with their rule and version; lineage lives in the system graph |
| D29 | Declared needs | Skills, plugins and functions declare what they need; usable when the needs are within the agent's policy and the graph database's mode allows it, otherwise refused naming what is missing |
| D30 | Federation | Delegating is a Run on `agent/<x>`; the callee runs with callee ∩ caller ∩ the person's teams, narrowing at every hop, within the caller's depth and fan-out. Outside agents (A2A and MCP) are agents of kind *external*, outbound in the ledger, Ask by default |
| D31 | Built-in agents | One instance each, system-owned: **Assistant** (was Explorer) · **Query console** (was Query; read mode, writes Ask, every query ledgered; granted like any agent) · Modeller · Coordinator · Record editor · Loader |
| D32 | Default kit | Connectors: neo4j · memgraph · arcadedb · janusgraph · neptune · tinkergraph. Core plugins: graph.read · graph.write · graph.stitch · data · model · nl · plan · work · answer · board · thinking · ledger. Tools: web · mail · outside MCP servers. Channels: mail · slack · teams · webhook. Skills: answer-a-question · profile-a-database · draft-a-model · propose-identity-rules · check-quality · weigh-the-evidence · weekly-digest · investigate-an-alert · review-an-agents-access. `science` and the genomic simulator move to a Life sciences domain pack |
| D33 | Generic stories | Every story is a generic user solving a problem or reaching a goal. Neutral kinds only (Customer · Order · Product · Supplier); domain examples live in demos and domain packs |
| D34 | Sign-in | **Password only.** Single sign-on (OIDC, SAML, SCIM) and MFA are *Not building* for now. Sign-in, renewal and the MCP server are rate-limited with a lockout; risky acts need a fresh sign-in |
| D35 | Studio session | The access and refresh tokens stay in the browser's local storage; Studio ships a strict Content Security Policy and every session has an absolute lifetime. Reusing a retired refresh token is refused and recorded |
| D36 | Inbound MCP | Invana is its own **OAuth 2.1 authorization server** for the one deployment MCP server: authorization code + PKCE, protected-resource and authorization-server metadata (RFC 9728, RFC 8414), client registration, tokens bound to the server (RFC 8707). The person signs in and consents; a token acts as that person through the agents they may use. Keys still work for scripts |
| D37 | Outside credentials | Per outside MCP server or tool, an Admin chooses a **shared secret** (encrypted, D27) or **per-user OAuth** (each person connects their own account; the agent acts as them). Never a plain environment variable |
| D38 | Keys | A key expires in 30, 90 or 365 days, or never. It acts as key ∩ its owner and may narrow further. Managing credentials and access needs a session, never a key |
| D39 | Service users | A user kind for automation: owned by people (co-owners allowed), owns nothing, never signs in, acts only through keys, Operator by default |
| D40 | Admin console | The operations console (`/admin`) stays, for install Admins only, with no default secrets |
| D41 | Datasets | A dataset is a **load batch**: a file in the blob store, checked against the model, then loaded into a read + write graph database. Never a second store of records |

## Target structure

The layers, capabilities and features `specs/` ends with. Phases land it; feature names here are working titles — the
product-manager names the files. Legend: `=` unchanged · `✎` rewritten · `→` moved in · `✚` new · `✖` removed.

```
Invana — one deployment
│  graph databases (via connectors) ─stitched─▶ the Graph
│  system graph (ArcadeDB): thinking graph · ledger edges · identity links · lineage
│  Postgres = truth · RustFS/S3 = files · Vault = keys
│
├─ OPERATING SYSTEM
│  │
│  ├─ Control Plane (CP)                     ← Runtime (RT) + Graph (GR) + agent runs
│  │  ├─ ✚ Overview — workloads by user, agent, team
│  │  ├─ → Runs (was AG-F03)                 every run, filterable; stop a run
│  │  ├─ ✚ Ops alerting                      denials · spend · stuck · unreachable · data from schema-only (the built ledger alert rules)
│  │  ├─ → Inbox and notifications (GR-F05)  + channels: mail · Slack/Teams · webhook
│  │  ├─ ✎ Graph databases (GR-F02/F04 + RT-F05)  connect · read-only or read+write · switch · health · practice
│  │  ├─ → Find your way (GR-F03)            ⌘K and search; the frame → design-language; GR-12 → AC-07
│  │  ├─ → Workers and the queue (RT-F03)
│  │  ├─ ✎ Limits (RT-F04 + AC-05)           per team, user, agent — one place
│  │  ├─ ✎ AI models (RT-F01)                deployment-wide · local or external
│  │  ├─ ✎ Plugins and MCP (RT-F02)          switches · one inbound MCP server · declared needs · outside credentials (shared or per-user OAuth)
│  │  └─ ✎ Skill scripts (RT-F06)            wording
│  │
│  └─ Access Plane (AC)
│     ├─ ✎ Sign in, account and sessions (AC-F01)  password only · sign out everywhere · fresh sign-in · lockout · session lifetime
│     ├─ ✎ Access Policies (AC-F02)          Allow/Ask/Deny × Read/Write/Run × type/name · team-scoped · role table · guardrails fold in
│     ├─ ✎ Directory (AC-F03 + GR-13)        users (human · agent · service · system) · teams · which agents each may use · deactivate a user
│     ├─ ✎ Keys (from AC-F03)                 acts as key ∩ owner · expiry or never · session-only acts
│     ├─ ✚ Connect an MCP client              OAuth 2.1 for the inbound MCP server · consent · revoke a client
│     ├─ ✎ What an agent may touch (AC-F04)  callee ∩ caller ∩ person's teams
│     ├─ ✎ Asks and approvals (AC-F05)       named approvers · remind → escalate → expire
│     ├─ ✚ Ownership                          system user · co-owners · hand over · copy a built-in
│     ├─ ✚ Access usage                       what each agent touched · unused access
│     ├─ ✚ What left the platform             the ledger: what went to which model or tool
│     └─ ✎ History (AC-F06)                   one chain for the deployment
│
│  ✖ Graph (GR) — Open a graph, Create a graph, This graph removed; the frame → design-language
│
├─ PILLAR · Ontology (SE)
│  ├─ ✎ Start a model · Rules · Health and history (SE-F01/F07/F10)  one stitched model · one History
│  ├─ ✎ Change and publish · Taxonomies · Standards (SE-F02/F04/F05)  wording
│  ├─ ✎ Meaning (SE-F03)                     + sensitive properties
│  ├─ ✎ Links and mappings (SE-F06)          one stitched model · identity match rules
│  ├─ ✎ Inference (SE-F08)                   writes derived facts to read+write graph databases
│  └─ ✖ Views of the graph (SE-F09)          → Access Policies + sensitive tags; SE-10 → AC-F02
│
├─ PILLAR · Intelligence (RC)
│  ├─ ✎ Records by kind · Quality (RC-F01/F03)  read from graph databases, never copied
│  ├─ ✎ Bulk fixes · Merge duplicates (RC-F04/F05)  need a read+write graph database
│  ├─ ✎ Provenance (RC-F06)                  lineage in the system graph
│  ├─ ✎ Bring records in (RC-F02)            datasets are load batches · into a read+write graph database
│  └─ ✎ Annotations (RC-F07)                 in the customer's graph database · absorbs EX-19
│
├─ PILLAR · Agents (AG)
│  ├─ ✎ Build an agent (AG-F01)              practice graph database
│  ├─ ✎ The agents catalogue (AG-F02)        granted, not invited · built-in agents, the Query console among them
│  ├─ ✚ Test an agent and a skill            eval sets and cases · drift · budget · in the practice graph database
│  ├─ ✎ Skills (AG-F04)                      declared needs · default skills
│  ├─ ✎ Delegation and outside agents (AG-F05)  narrowing per hop · A2A + MCP
│  ├─ ✎ Plans and workflows (AG-F06)         ladder (the function catalogue is rung one) · compose · approve → workflow · versions
│  ├─ ✎ Schedules (AG-F07)                   creator ∩ agent · pause when the creator leaves
│  ├─ ✎ Portable (AG-F08)                    no Graph to carry to
│  └─ ✚ Thinking graph and memory            absorbs EX-F07: recall by outcome · good/bad
│
└─ PILLAR · Evidence (EX · PJ)
   ├─ ✎ Ask a question · The answer (EX-F03/F04)   typed plans across graph databases · projection templates
   ├─ ✎ How it reasons (EX-F05)              + what-if as a method (predicted evidence)
   ├─ ✎ Board · Share (EX-F01/F02)           no Graph members
   ├─ ✎ Edit on the board (EX-F06)           read+write graph database · annotating is RC-F07
   ├─ ✎ Branches, findings and decisions (PJ-F03)  cite the thinking graph · superseded
   ├─ ✎ Projects and tasks · Reports (PJ-F01/F05)  light rewrite, no Graph members
   ├─ ✎ Alerts (PJ-F06)                      a pattern in the records opens a lead; ops alerts are CP
   ├─ ✖ Objectives (PJ-F02)                  never built; Projects stay light
   └─ ✖ Simulation and impact (PJ-F04)
```

| Layer | Before | After | New | Removed |
|---|---|---|---|---|
| Operating system | Graph · Access · Runtime | Control Plane · Access Plane | Overview · Ops alerting · Keys · Connect an MCP client · Ownership · Access usage · What left the platform | Graph (GR) |
| Ontology | 10 features | 9 | — | SE-F09 |
| Intelligence | 7 | 7 | — | — |
| Agents | 8 | 9 (Runs → CP, + thinking graph, + testing) | Thinking graph and memory · Test an agent and a skill | — |
| Evidence | EX 7 + PJ 6 | EX 6 + PJ 4 | — | EX-F07 (→ AG) · PJ-F02 · PJ-F04 |

What the code already builds, and where it breaks a decision, is [`code-audit.md`](code-audit.md); each break is a
`specs/migrations.md` row written by the phase that owns it.

## Rules for every session

| Rule | Detail |
|---|---|
| Target structure | *Target structure* is the map: every feature lands where it shows. A phase that finds a feature it does not place is a row in *Questions for Ravi* |
| Decisions are settled | Write *Decisions* into the files that own them; never reopen one. A conflict with a spec you cannot resolve is a row in *Questions for Ravi* |
| Rewrite in place | Never append a "changes" section; a story says only what is true now. Git is the history |
| Read every story you touch | No find-and-replace: *graph* (the data) and *Graph* (the old unit) differ. Every "a Graph" / "this Graph" is read and rewritten |
| Term sweep | Graph (unit) → the deployment, or a graph database · member → user, team member · group → team · access rule, line → Access Policy, rule · holder → agent (users hold agents) · invite an agent → grant an agent · promote a plan → approve a plan into a workflow · packaged plan → built-in workflow · practice graph → practice graph database · Graph's limits → limits per team, user, agent · Explorer → Assistant · Query (agent) → Query console |
| Roles | *Who can* tables use Operator · Modeller · Admin and *named approver*; *No access* names the role needed. They link to the role × feature table in AC — never restate it |
| Keep IDs | A moved story or feature keeps its ID; only new ones get new IDs. Removed ones leave no stub |
| Generic | D33. No flights, airports, genes, fraud or any domain in stories, criteria or Engine |
| One home per fact | A fact lives in the feature that owns it; others link (CLAUDE.md rule 15). `system-design.md` states conventions and links |
| Present tense, no history | No decision ids (`D12`) in specs, no "was", no renames. A code change not yet made is a row in `specs/migrations.md` |
| Engine tables are parseable | `## Engine` keeps the subsections and first columns of `.claude/skills/system-design/SKILL.md` §3 |
| Write only your role's files | product-manager: `specs/**`, `README.md` *Core features*; anything else is a `recommend` row |
| Auto-approved | Ravi pre-approved every phase: no phase waits for his approval. A question a session would ask Ravi is decided with its recommended option and written as a row in *Questions for Ravi* with the Answer `auto — recommended`, and the phase continues. A session never marks a phase `blocked`: a point it cannot settle — no option consistent with *Decisions* — is a row in *Questions for Ravi* with the Answer `open`, the affected text keeps the closest consistent wording, and the phase finishes the rest of its work |
| Boards | A story's *Screens* may rename or drop boards; each changed board name is a `recommend` row for the designer, never a canvas edit |
| QA task ids | QA writes task rows in `task.md` with ids `<STORY>-T<n>`, never `QA1` — the closing commit's spec check refuses anything else |

## Environment

| Name | Value |
|---|---|

## Setup

| Step | Command | In | Phases |
|---|---|---|---|

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | P01, P02, P03, P04, P05*, P06*, P07, P08, P09, P10, P11, P12 | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | P01, P02, P03, P04, P05*, P06*, P07, P08, P09, P10, P11, P12 | |
| graph parses | `python3 scripts/specs/check.py --graph --out /tmp/specs-graph.json` | `.` | P12 | |

## Phases

### P01 · Foundations — vision and glossary

| | |
|---|---|
| Agent | product-manager |
| Read | This project's *Decisions* and *Rules* · `specs/vision.md` · `specs/glossary.md` · `specs/personas.md` · `specs/design-language.md` · `specs/README.md` |
| Stories | — |
| Done when | `vision.md` states the Control Plane, Access Plane and the four pillars (D3), the Graph's new meaning (D2), the single deployment (D1) and *Scope* without a per-Graph unit; *How Invana names itself* lines are unchanged (D4) and the *Studio Graphs list* surface row is gone; `glossary.md` defines every new term and drops every retired one; `personas.md` and `design-language.md` have no Graph picker, Graph owner or per-Graph surface |
| Lands | `specs/vision.md` · `specs/glossary.md` · `specs/personas.md` · `specs/design-language.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Vision: operating system and pillars tables, *Scope*, the OS analogy table. 2. Glossary: add Connector, graph database, Graph, system graph, Control Plane, Access Plane, Access Policy, rule, team, role, system user, plan, workflow, thinking graph, ledger, schema-only, data-bearing, local and external model; remove retired terms. 3. Personas and design language. 4. Gates green |

### P02 · System design

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `.claude/skills/system-design/SKILL.md` · `specs/system-design.md` · `specs/vision.md` (P01) · `specs/migrations.md` |
| Stories | — |
| Done when | `system-design.md` has no "a Graph is bound to one graph database" decision and states: the deployment and its services (Postgres, ArcadeDB, RustFS); connectors and graph databases with their modes (D9); the system graph, system ontology and outbox (D5, D6); federated querying and identity links (D7, D8); the typed query plan (D10); the policy check (D11, D12); the ledger (D24); local and external models (D25); storage, blob interface and encryption (D26, D27); routes `/api/v1/<package>/<records>` without a Graph segment; one History chain; sign-in, sessions, keys and the MCP authorization server (D34–D38), outside credentials (D37) and datasets as load batches (D41). Each code change it implies — every break [`code-audit.md`](code-audit.md) §1 lists — is a row in `specs/migrations.md` |
| Lands | `specs/system-design.md` — sections: deployment, storage, security, data flow, routes, NFRs · `specs/migrations.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Remove per-Graph decisions and NFR wording. 2. Deployment and services. 3. Data flow: typed plan → check → compile → connector → ledger. 4. Storage and encryption. 5. Routes and History. 6. `migrations.md` rows. 7. Gates green |

### P03 · Journeys

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `.claude/skills/product-spec/SKILL.md` · `specs/journeys/**` · `specs/vision.md` (P01) |
| Stories | — |
| Done when | J01 is *From a fresh deployment to a first answer* (connect a graph database, then ask); J05 is *Join a team*; J06 sets what an agent may touch with Access Policies; J07 readies a deployment (graph databases, teams, agents, policies); new J08 *Watch agent workloads and act on an alert* and J09 *Audit what an agent touched and what left the platform*; J02–J04 use the new words (J04 includes plan → workflow). Every journey step names a feature that will exist after P04–P11 |
| Lands | `specs/journeys/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Rewrite J01, J05, J06, J07. 2. Write J08, J09. 3. Words in J02–J04. 4. Gates green |

### P04 · Access Plane I — policies, roles and the directory

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `.claude/skills/product-spec/SKILL.md` · `specs/os/access/**` (`product.md` and AC-F02 done) · `specs/os/graph/features/GR-F03-find-your-way/feature.md` · `specs/os/graph/features/GR-F04-this-graph/**` · `specs/capabilities/semantics/features/SE-F09-views-of-the-graph/feature.md` · P01–P03 outputs |
| Stories | Every story folder in AC-F02: AC-03 · AC-04 · AC-06 · AC-07 · AC-08 · AC-11 · AC-19 (role × feature table, folder of old AC-05) · AC-20 (built-in agents, folder of old GR-12) · AC-21 (team-scoped rules) · AC-27 (folder of old SE-10) · then AC-09 · AC-22 (folder of old GR-13) · AC-24 · AC-25 · new stories for the system user, co-owners and hand-over, copying a built-in, named approvers, deactivating a user |
| Done when | AC-F02 is *Access Policies* (D12): a policy is a named list of rules (effect · verb · resource `type/name` with whole-segment `*`), a rule's only condition is a team, policies attach to agents (AC-11), guardrails are folded in as rules on `data/…`; AC-19 holds the one fixed role × feature table for Operator · Modeller · Admin (D14); AC-20 lists the built-in agents and their policies (D31); GR-12's criteria merge into AC-07; AC-27 is SE-10 as a rule on `data/<graph-database>/<kind>` plus sensitive properties; AC-05 is no longer an AC-F02 story (its limits go to `CP` in P07); every story folder in `specs/os/access/**` has a matching `id`, title and `feature:`, and each feature's front matter, Stories table and User journey list exactly its stories. AC-F03 is the Directory — users (human, agent, service, system), flat teams that own nothing (D13), which agents a user may use; AC-22 is GR-13 folded in (see every user, set a person's role); AC-F07 *Ownership* exists with AC-24 · AC-25 (D15): people and the system user own, co-owners, what an agent creates is owned by the person behind the run, built-ins are copied, never edited; named approvers per agent (D16); a Directory story lets an Admin deactivate a user, hand over what they own (D15) and pause their schedules until an Admin takes them over; AC-10 stays in AC-F03 for P05b with its id and `feature:` consistent; GR-F03 and GR-F04 no longer list GR-12 and GR-13, SE-F09 no longer lists SE-10, and their journeys and links follow; no story in `specs/os/access/**` names a retired role; `check.py` and the links gate are green for the whole tree |
| Lands | `specs/os/access/**` · `specs/os/graph/features/GR-F03-*/feature.md` · `specs/os/graph/features/GR-F04-*/feature.md` · `specs/capabilities/semantics/features/SE-F09-*/feature.md` (Stories table, journey and links only) |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | Done, committed on branch `specs-planes/P04a-access-plane-i-access-policies-and-the-r` (as P04a steps 1–4): AC-F02 Access Policies feature file (rules, team condition, built-in policies in Engine); AC-19 role table; AC-20 built-in agents; AC-21 hold a rule for one team; AC-27; AC-03/04/06/07/08/11 rewritten, GR-12 merged into AC-07. Remaining: 1. Directory: AC-F03 feature file, AC-09, AC-22, deactivate-a-user story. 2. Ownership: AC-F07 with AC-24, AC-25, system user, co-owners and hand-over, copying a built-in. 3. Named approvers. 4. Clear the GR-F03, GR-F04 and SE-F09 leftovers and every dead link. 5. Gates green on the whole tree |

### P05 · Access Plane II — touch, asks, usage, ledger view, history

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/os/access/**` (P04) · `specs/system-design.md` (P02) |
| Stories | AC-12 · AC-13 · AC-14 · AC-15 · AC-16 · AC-17 · new stories for access usage, unused access, *What left the platform*, run privacy, ask reminders and escalation |
| Done when | AC-F04 states callee ∩ caller ∩ the person's teams (D30) and declared needs (D29); asks have reminders, escalation and expiry (D16); new *Access usage* and *What left the platform* features read the ledger (D24) and answer "what has this agent touched" and "what went to an external model"; run privacy (D25) is a criterion where content is read; History is one install-wide chain |
| Lands | `specs/os/access/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. What an agent may touch. 2. Asks and approvals. 3. Access usage and What left the platform. 4. History. 5. Gates green |

### P05b · Access Plane III — sign-in, sessions, keys and MCP clients

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `.claude/skills/product-spec/SKILL.md` · `specs/os/access/**` (P04) · `specs/system-design.md` (P02) · [`code-audit.md`](code-audit.md) §4 · the MCP authorization specification |
| Stories | AC-01 · AC-02 · AC-10 · AC-18 · new stories for service users, connecting an MCP client with OAuth 2.1 and consent, seeing and revoking connected clients, lockout after failed sign-ins |
| Done when | AC-F01 is password sign-in only, with single sign-on and MFA under *Not building* and AC-01's sign-on criteria gone (D34); sessions have sign out here and everywhere, a fresh sign-in for risky acts, reuse detection and an absolute lifetime, and Studio's local storage is paired with a strict CSP (D35); *Keys* is its own feature — key ∩ owner, 30/90/365 days or never, session-only acts (D38); service users are a Directory user kind owned by people (D39); a new *Connect an MCP client* feature makes the deployment's MCP server an OAuth 2.1 resource with Invana as its authorization server, consent, audience-bound tokens and revocation, while keys still work (D36); no story names a Graph, member or `/u/<username>/<graph>` address |
| Lands | `specs/os/access/**` |
| Boards | — |
| Review | security |
| Approve | |
| Budget | |
| Steps | 1. Sign in and sessions. 2. Keys. 3. Service users. 4. Connect an MCP client. 5. Gates green |

### P06a · Control Plane I — the product and graph databases

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/os/runtime/**` · `specs/os/graph/**` · `specs/system-design.md` (P02) |
| Stories | GR-01 · GR-02 · GR-03 · GR-04 · GR-05 · GR-06 · GR-07 · GR-08 · GR-09 · GR-10 · GR-11 · GR-15 · RT-17 · RT-18 · RT-19 · new stories to connect a graph database, set its mode, switch it on or off, see its health, name a practice graph database |
| Done when | `specs/os/control/` exists with product code `CP`; RT features move into it with their IDs; GR-F01, GR-F02 and GR-F04 are removed and their surviving stories live in a *Graph databases* feature (D2, D9, D18, D19), the setup checklist a step of J01; GR-01 and GR-03 are removed (there is no Graph to open; J01 starts at Home); GR-F03 moves to `CP` as *Find your way* (⌘K and search, GR-10); GR-08, GR-09 and GR-11 are removed and their criteria become design-language rules for the frame; `specs/os/graph/` and `specs/os/runtime/` no longer exist; the connectors listed are D32's six, each with its query language and driver-level read mode |
| Lands | `specs/os/control/**` · removes `specs/os/graph/**` and `specs/os/runtime/**` · `specs/design-language.md` (the frame section only) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Create the product and move RT features. 2. Graph databases feature. 3. Remove GR, moving what survives. 4. Frame rules. 5. Gates green |

### P06b · Control Plane II — plugins, MCP, skill scripts, channels

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/os/control/**` (P06a) · `specs/os/access/**` (P04) |
| Stories | RT-02 · RT-03 · RT-04 · RT-20 · RT-15 · RT-16 · new stories for channels (mail, Slack/Teams, webhook), declared needs, and connecting an outside server with a shared secret or per-user OAuth |
| Done when | Plugins have install and user switches and start off (D18); outbound tools default to Ask; there is one deployment MCP server, callers act as key ∩ owner — or through an OAuth client (P05b) — and see only what policies allow; outside servers and tools hold a shared encrypted secret or per-user OAuth, chosen per server, never an environment variable (D37); plugins and skills declare needs (D29); channels deliver asks and alerts, approvals from chat link back to History (D17); the default kit's plugins and connectors match D32 and `science`/genomic sit in a Life sciences pack |
| Lands | `specs/os/control/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Plugins and switches. 2. Inbound MCP server. 3. Outside credentials. 4. Skill scripts. 5. Channels. 6. Default kit. 7. Gates green |

### P07 · Control Plane III — overview, runs, alerting, limits, models

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/os/control/**` · `specs/capabilities/agents/features/AG-F03-*/**` · `specs/os/graph` content moved in P06a (the Inbox) |
| Stories | AG-17 · AG-22 · AG-23 · AG-25 · AG-27 · AG-28 · AG-32 · AG-41 · AG-43 · AG-45 · GR-14 · GR-16 · GR-17 · RT-01 · RT-05 – RT-09 · RT-F04 stories · AC-05 · new stories for the overview, ops alerts, stopping a run, marking a model local or external |
| Done when | A control-plane overview shows workloads by user, agent and team; AG-F03 Runs lives in `CP` with its IDs, filterable by user, agent, team and graph database; a new ops-alerting feature (repeated denials, spend over limit, stuck runs, unreachable databases, data sent from a schema-only workflow) alerts agent owners and Admins, and owns the built ledger alert rules; anyone behind a run, its agent's owners or an Admin can stop it; limits are per team, user and agent, in one feature, which holds GR-14 with its ID as what a team, user or agent spends against its limits; the Inbox lives here; AI models are deployment-wide and marked local or external (D25) |
| Lands | `specs/os/control/**` · `specs/capabilities/agents/**` (removing AG-F03) |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Overview. 2. Move Runs. 3. Ops alerting and stopping. 4. Inbox. 5. Limits. 6. AI models. 7. Gates green |

### P08 · Agents I — skills, plans and workflows, the thinking graph

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/capabilities/agents/**` · `specs/capabilities/explore/features/EX-F07-*/**` · `specs/system-design.md` (P02) |
| Stories | AG-19 · AG-20 · AG-30 · AG-37 · AG-18 · AG-31 · AG-38 · AG-44 · EX-29 · EX-30 · EX-31 · EX-32 · new stories to compose from workflows, approve a plan into a workflow, version a workflow, read a run's thinking, browse the thinking graph, mark thinking good or bad |
| Done when | AG-F04 Skills use resource names, ownership and declared needs and list the default skills (D32); AG-F06 is *Plans and workflows* with the ladder — the function catalogue its first rung — composites and approval (D20, D21), drops "never part of one and part of another", and names one *plan* and one *workflow* (a project's todo graph is not a plan); a new thinking-graph feature absorbs EX-F07 with its IDs (D22); built-in agents are named per D31 |
| Lands | `specs/capabilities/agents/**` · removes `specs/capabilities/explore/features/EX-F07-*` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Skills. 2. Plans and workflows. 3. Thinking graph and memory. 4. Built-in agents. 5. Gates green |

### P09 · Agents II — build, catalogue, delegation, schedules, portable

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/capabilities/agents/**` (P08) |
| Stories | Every story in AG-F01 · AG-F02 · AG-F05 · AG-F07 · AG-F08 · AG-20 · new stories to test an agent and a skill (eval sets and cases, drift, budget) |
| Done when | Agents are tested in a practice graph database; a new *Test an agent and a skill* feature owns evals — sets, cases, drift and budget; AG-20 keeps only adopting what runs improvise and AG-36 only publishing a version, each linking to it; the catalogue has no invite — agents are granted to users and teams, and the built-in agents include the Query console (D31); delegation follows D30, with outside agents over A2A and MCP; a schedule runs as its creator ∩ agent and pauses when the creator leaves until an Admin takes it over; no Graph or invite language remains |
| Lands | `specs/capabilities/agents/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Build. 2. Test an agent and a skill. 3. Catalogue. 4. Delegation. 5. Schedules. 6. Portable. 7. Gates green |

### P10 · Evidence — Explore and Projects

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/capabilities/explore/**` · `specs/capabilities/projects/**` · P08 outputs |
| Stories | Every story in EX-F01 – EX-F06 and PJ-F01 – PJ-F06 |
| Done when | EX-F03/F04 ask across graph databases with typed plans (D10) and name the plan gap (D10); EX-F04 holds projection templates; EX-F05 holds what-if as a reasoning method with *predicted* evidence (D23); EX-F06 edits need a read + write graph database (D9, D28) and EX-19 moves to RC-F07 with its ID; PJ-F03 decisions cite thinking-graph steps and are superseded, never edited, and hold impact (PJ-10); PJ-F02 and PJ-F04 are removed — PJ-16 and PJ-17 go with PJ-F02 (what waits on a person is the Inbox, GR-16), PJ-09 lives in EX-F05 and PJ-10 in PJ-F03; PJ-F06 alerts are generic patterns in the records that open a lead, linking to `CP` ops alerting for platform alerts; no story is domain-specific (D33) |
| Lands | `specs/capabilities/explore/**` · `specs/capabilities/projects/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Explore. 2. Move what-if. 3. Projects. 4. Generic sweep. 5. Gates green |

### P11 · Ontology and Intelligence

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · `specs/capabilities/semantics/**` · `specs/capabilities/records/**` · `specs/ontology.md` |
| Stories | Every story in SE-F01 – SE-F10 and RC-F01 – RC-F07 |
| Done when | The model is one stitched model across graph databases; SE-F03 marks properties sensitive; SE-F06 holds identity match rules (D8) and drops carrying a model to another Graph; SE-F09 is removed (views fold into policies and sensitive tags; SE-10 moved to AC-F02 as AC-27 in P04); SE-F08 and RC-F07 write to the customer's graph database and need read + write (D28), RC-F07 holding EX-19; RC-F02 loads target a read + write graph database and a dataset is a load batch in the blob store (D41); RC-F01/F03 read records from graph databases, never a copy (D7); RC-F04/F05 need read + write; RC-F06 lineage lives in the system graph (D5); "rule" names only model rules and policy rules; no Graph unit remains |
| Lands | `specs/capabilities/semantics/**` · `specs/capabilities/records/**` · `specs/ontology.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Semantics. 2. Remove SE-F09. 3. Records. 4. Gates green |

### P12 · Sweep and verify

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · *Rules* · all of `specs/` · `README.md` |
| Stories | — |
| Done when | A grep of `specs/` finds no retired term or role (per-Graph unit, member, group, access rule, holder, invite an agent, promote a plan, packaged plan, practice graph, Owner as a grant, Can build agents, Can work on projects, Can shape the model, Can manage people, Explorer and Query as agent names); the index is regenerated; README *Core features* uses the new pillars and planes; one `recommend` row each: board renames for the designer, a code project (the `migrations.md` rows), the generic-stories rule for the `product-spec` skill and `check.py` |
| Lands | `specs/**` · `README.md` (*Core features*) · `.claude/team/agents-recommendations.md` (via `recommend`) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Retired-term grep and fixes. 2. Index. 3. README. 4. Recommendations. 5. Gates green |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Foundations — vision and glossary |  | done | 2026-11-13 | gates green · reviews passed |
| P02 | System design | P01 | done | 2026-11-13 | gates green · reviews passed |
| P03 | Journeys | P01 | done | 2026-11-13 | gates green · reviews passed |
| P04 | Access Plane I — policies, roles and the directory | P02, P03 | done | 2026-11-13 | gates green · reviews passed |
| P05 | Access Plane II — touch, asks, usage, ledger view, history | P04 | done | 2026-11-13 | gates green · reviews passed |
| P05b | Access Plane III — sign-in, sessions, keys and MCP clients | P04 | done | 2026-11-13 | gates green · reviews passed |
| P06a | Control Plane I — the product and graph databases | P02, P03 | done | 2026-11-13 | gates green · reviews passed |
| P06b | Control Plane II — plugins, MCP, skill scripts, channels | P06a, P05b | done | 2026-11-13 | gates green · reviews passed |
| P07 | Control Plane III — overview, runs, alerting, limits, models | P06a, P04 | done | 2026-11-13 | gates green · reviews passed |
| P08 | Agents I — skills, plans and workflows, the thinking graph | P02, P03, P04 | done | 2026-11-13 | gates green · reviews passed |
| P09 | Agents II — build, catalogue, delegation, schedules, portable | P08 | done | 2026-11-13 | gates green · reviews passed |
| P10 | Evidence — Explore and Projects | P08 | done | 2026-11-13 | gates green · reviews passed |
| P11 | Ontology and Intelligence | P04 | done | 2026-11-13 | gates green · reviews passed |
| P12 | Sweep and verify | P05, P05b, P06b, P07, P09, P10, P11 | done | 2026-11-13 | gates green · reviews passed |

## Hand-off notes

| ID | Note |
|---|---|
| P05b | New: AC-F10 *Keys* (AC-10 moved from AC-F03, folder `AC-10-mint-a-key-that-acts-as-its-owner-narrowed`), AC-F11 *Connect an MCP client* (AC-35 · AC-36), AC-33 service users (AC-F03), AC-34 lockout (AC-F01). Signing in again is the **password for the act** (body field `password`), never a time window since sign-in — AC-F01 › Mechanisms lists the risky routes; P06b's credential writes must take it too. Token prefixes tell credentials apart: `invana_pat_` key · `invana_mcp_` connected client · else JWT. The MCP server is `https://<deployment>/mcp`; AC-F11 owns its auth (metadata, `/api/v1/access/oauth/*`, `/api/v1/access/clients`), P06b owns what it serves and must link AC-F11 and AC-F10 instead of restating them. AC-F11 links RT-F02 by path — P06a's move of `os/runtime` must retarget it. GR-F04 › Refusals and RT-F02/RT-03 still cite AC-10 in its old Graph-bound sense — P06a/P06b rewrite them. Service users are Operator or Modeller, never Admin; what a run they are behind makes is owned by their owners (AC-F07 updated). R336 (system-design/migrations links), R337 (designer boards), R338 (glossary) |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-13 | P04 | P04's build session wrote only step 1 (`access/product.md`) and renamed story folders with no content change; steps 2–4 (Access Policies + role table, Directory, Ownership) were never written. 30 check errors remain that no link fix can clear: story ids/`feature:` that do not match their new folders (AC-05→AC-19, GR-12→AC-20, SE-10→AC-27, GR-13→AC-22, AC-11 in AC-F02), stale Stories tables and journeys in AC-F02, AC-F03, GR-F03, GR-F04, SE-F09, and no AC-F07 Ownership feature | A: restart P04 at step 2 on this branch (feature-level links already retargeted) · B: split P04 — P04a Access Policies, P04b Directory + Ownership · C: revert the folder renames and rerun P04 from scratch | A — the renames encode the intended targets and step 1 is done; a split is only needed if the restart blocks again | A — Ravi (merged back) |
| 2026-11-13 | P05b | AC-02 let a person delete their own account outright; AC-F03 says *deactivate, never delete* and owners must stay people (D15) | A: no self-delete — an Admin deactivates (AC-02.18 now refuses key-made risky acts) · B: keep self-delete | A — CLAUDE.md rule 15 and AC-F03 › Not building *Deleting a user*; a deleted owner would break D15 | auto — recommended |
| 2026-11-13 | P05b | What does *a fresh sign-in for risky acts* (D34) mean? AC-F01 had a 15-minute window since sign-in; AC-F02/AC-F03, NFR-SEC-4 and the glossary say *the password again for that act* | A: password for each risky act · B: a 15-minute window since sign-in | A — NFR-SEC-4 and glossary *Sign in again* ("however recent the session"); B lets an unlocked laptop change access | auto — recommended |
| 2026-11-13 | P05b | Where does a new key start? D38 says key ∩ owner, may narrow | A: *Read only* preselected, the minter widens on purpose · B: *Everything I may do* | A — least privilege; one click to widen | auto — recommended |
| 2026-11-13 | P05b | The *agent-operated* key mark (old AC-10.18/19) | A: drop it — every act already runs through an agent's Access Policies (D11) · B: keep it | A — D11 makes the mark redundant | auto — recommended |
| 2026-11-13 | P05b | May a service user hold the Admin role? D39 says Operator by default | A: Operator or Modeller only · B: any role | A — a key can never do an Admin's session-only acts (D38), so Admin on a service user grants nothing usable | auto — recommended |
| 2026-11-13 | P05b | MCP client registration: RFC 7591 dynamic registration, client ID metadata documents, or both | A: dynamic registration only · B: both | A — metadata documents make the engine fetch any address a client names (an outbound call and an SSRF surface); Claude Code supports dynamic registration | auto — recommended |
| 2026-11-13 | P05b | Do consenting to an MCP client and revoking a key or client ask for the password again? | A: yes, every change to keys and credentials · B: only minting and consent | A — NFR-SEC-4 "a change to access, keys or credentials" | auto — recommended |
| 2026-11-13 | P05b | May an Admin see and revoke every person's keys and connected clients? | A: yes, with the password again · B: owners only | A — migration M14 "a key's details are its owner's and Admins'"; the same for clients | auto — recommended |
| 2026-11-13 | P07 | Moved AG story IDs cannot keep their prefix in `CP` (check.py refuses a foreign prefix) | A: renumber to CP-48–CP-57 · B: change check.py | A — the rule P06a followed; the map is in P07's hand-off note | auto — recommended |
| 2026-11-13 | P07 | How does the overview count a run whose person is on several teams? | A: once under each team, saying so · B: split across teams | A — teams are flat; a split invents a share nobody set | auto — recommended |
| 2026-11-13 | P07 | Who may stop and re-run a run? | A: stop — person behind, agent's owners, Admin; re-run — person behind, Admin · B: all three for both | A — role table *Own*; a re-run makes the re-runner the person behind | auto — recommended |
| 2026-11-13 | P07 | Who writes notification rules (role table: Inbox Acts for all)? | A: anyone for themselves; rules reaching others, teams, roles, channels, and History alerts are an Admin's · B: Admin only | A — fits *Acts* without letting anyone page others or use an Admin's channel | auto — recommended |
| 2026-11-13 | P07 | Ops alerts: built-in or written? | A: six built-in kinds, Admin tunes thresholds, never switched off, open alerts wait in Needs you · B: Admin-written alert rules | A — *Target structure* names exactly these kinds; written rules exist as History alerts | auto — recommended |
| 2026-11-13 | P07 | With views of the graph gone, which model answers when an agent pins none? | A: one deployment default, set by an Admin · B: every agent must pin | A — a fresh deployment answers its first question (J01) without building an agent | auto — recommended |
| 2026-11-13 | P07 | Who sets an agent's limits now that limits are one feature? | A: Admin only, in CP-F04 · B: the agent's owners | A — role table gives limits to Admin; owners ask for more from a held run | auto — recommended |
| 2026-11-13 | P07 | How are workers shared without a Graph? | A: equally by the person behind each run, idle shares lent · B: by team | A — a person may be on several teams; per person needs no tie-break | auto — recommended |
