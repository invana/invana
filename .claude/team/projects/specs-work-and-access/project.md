---
name: specs-work-and-access
status: done
branch: feat/specs-work-and-access
scope: specs-work-and-access
---

# Specs — work and access

Rewrite `specs/` so the agent is the only holder of reach, no work hangs on a person, and a project is any kind of
work an agent team runs — so a person can trust that an agent does the same thing for everyone, and that the team keeps
working when people leave.

| | |
|---|---|
| Goal | Every file in `specs/` states *Decisions* below: access is the agent's alone (one grammar, grants to people and teams, a default agent, no team-held rules, no person narrowing); a new `os/graph` product holds Data and Memory; alerting has one home in CP-F11; AC-F12 *Leaving and keeping* exists; projects are any kind of work with task kinds, groups, a project assistant, reviewers, relations and checks; agents run with Invana, Claude Code or Codex on workers in a sandbox and continue from hand-off notes; plugins use the Claude plugin layout; the Software delivery pack is specified; `check.py` and the link check are green |
| Specs | `specs/os/access/**` · `specs/os/control/**` · `specs/os/graph/**` (new) · `specs/capabilities/agents/**` · `specs/capabilities/projects/**` · EX-F02 · SE-F03 · SE-F06 · SE-F08 · RC-F06 · `glossary.md` · `vision.md` · `system-design.md` · `migrations.md` · journeys J08, J10–J12 · `specs/packs/software-delivery.md` (new) · README *Core features* |
| Not in this project | Engine, Studio and integrations code (each change a row in `specs/migrations.md`) · boards (the designer, after Ravi's spec review) · moving the `.claude/` scripts into the product (the build after these specs) · GDPR and SOC 2 write-ups (a lens; only the behaviours they imply are written) · multi-tenancy · `.claude/**` except this file and `recommend` rows |

Run it: `python3 .claude/skills/run-project/run.py specs-work-and-access` (the project-lead does, with `--start`).

## Decisions

Settled with Ravi on 2026-11-13 over one conversation; this section is their one home, so no session needs that
conversation. Every phase writes these into the spec files that own them, in present tense and without these ids;
none is reopened — a conflict is a row in *Questions for Ravi*. *§n* names the section of the access-plan page the
conversation produced.

### T · The target model

| # | Decision |
|---|---|
| T1 | **The agent is the only holder of reach.** Only an agent's Access Policies grant reach to data, memory, projects, tools, files, commands and the network. The same agent does the same thing for everyone who may use it |
| T2 | **People pick agents, not permissions.** A person holds one role (platform acts only, never data reach), the agents they are granted, one default agent and their own personal connections |
| T3 | Roles stay three: Operator · Modeller · Admin — the one role × feature table in AC-F02. "Can build agents" means Modeller or Admin. Every old grant name (Can work on projects, Can build agents, Can shape the model, Can manage people, Owner as a grant) goes |
| T4 | **One grammar**: effect (Allow · Ask · Deny) · verb · resource. Resources add `memory/` · `project/` · `fs/` · `cmd/` · `net/` to those AC-F02 has |
| T5 | **Declare, never grant.** Skills, functions, plugins, Team packs and runtimes declare what they need; only Access Policies grant |
| T6 | **Ceilings only narrow**: a key, the run scope, a credential's scope, a graph database's mode, the worker sandbox |
| T7 | **Derive, never hand-keep.** An outside runtime's allow list is generated from the agent's Access Policies every session; the worker sandbox enforces `fs/` · `cmd/` · `net/` at the operating-system level whatever the runtime does |
| T8 | **Projects hold no permissions.** A project is a thinking graph, context, instructions, files, tasks, a project assistant, reviewers and relations. No private flag, no connectors |
| T9 | **Work stays, people can be erased.** Agents retire, never delete; names on work are kept or pseudonymised by a deployment setting; personal-connection data is erased |

### E · How one act is checked, in order

| Step | Check | A refusal names |
|---|---|---|
| 1 | The person is active and granted this agent, or the agent is in the run's delegation chain | — the agent is not offered |
| 2 | The person's role holds the feature — whether they may start the act, never what the agent reaches | the role |
| 3 | Switches: the graph database and the plugin are on | the switch |
| 4 | `decide()` for every agent in the chain: strictest wins, no match is Deny, no team or person terms. Ask → named approvers → Admins; a yes covers this step, this run | the rule and its policy |
| 5 | Ceilings: key ∩ run scope ∩ graph database mode | the ceiling |
| 6 | Limits, at admission | the limit |
| 7 | A ledger row; the outbound sensitivity check for anything going to an outside model | — |
| 8 | Runs: the worker sandbox enforces `fs/` · `cmd/` · `net/`; the credential is injected on the worker | — |

### A · Access

| # | Decision | Lands in |
|---|---|---|
| A1 | Teams only receive grants. Team-held rules (AC-21) and narrowing by the person's teams go; the agent's Access Policies are the whole answer | AC-F02 · AC-F04 |
| A2 | Caller-chain narrowing stays: callee ∩ every caller, agent to agent only | AC-F04 |
| A3 | Admins grant agents to people and to teams; a grant or a team change previews which agents each person gains or loses | AC-F03 |
| A4 | Each person has one **default agent**; every Studio screen reads through it. A Modeller may edit it like any agent (accepted): its writes are on Ask, a change previews who gains it, History records it | AC-F02 · AC-F03 |
| A5 | **Delegation** goes only to agents the person, or the run's chain, is granted. *May delegate to* goes | AC-F05 · AG-F05 |
| A6 | **Asks** go to the agent's named approvers, then Admins, with a *no approver* alert; owners are not in the route. An ask's yes covers this step, this run; widening a limit is an Admin's edit, never an ask | AC-F05 · CP-F04 |
| A7 | Approvers are people or teams; naming a single person warns | AC-F05 |
| A8 | Keys stay allow-only and narrow their owner; skill-script approval per content hash stays | AC-F10 · CP-F06 |
| A9 | **MCP clients** act through the person's default agent, may carry key-like narrowing, and count as an external model | AC-F11 · AC-F09 |
| A10 | **SSO (OIDC, SAML) and MFA are built** — *not building* is reversed | AC product · AC-F01 · system-design |
| A11 | **Second-person approval** for changes to Access Policies and work connections: a deployment setting, off by default | AC-F02 · CP-F02 |
| A12 | **Access reviews**: quarterly, per agent — its Access Policies, grants and connections — signed off and recorded | AC-F08 |
| A13 | A Modeller imports; a policy file in an import or a Team pack applies only when an Admin applies it | AG-F08 · AC-F02 · CP-F02 |
| A14 | History: Operator and Modeller read their own rows; an Admin reads every row | AC-F02 role table · AC-F06 |
| A15 | A service user is Operator or Modeller — one wording | glossary · AC-F03 |
| A16 | **Run scope**: a run's `memory/` and `project/` reach narrows to its project, the related projects and its task | AC-F04 |

### O · Ownership — no work hangs on a person

| # | Decision | Lands in |
|---|---|---|
| O1 | The platform (the system user) owns built-in and shared agents, keeping *made by*; a personal agent is its person's; agents retire, never delete | AC-F07 · AG-F01 |
| O2 | The organisation owns all work; every place a person sits is a slot with a fallback (O8) | AC-F07 · AC-F03 |
| O3 | Deactivating a person names a **successor**, who takes every slot | AC-F03 |
| O4 | Always **at least two Admins**: a deactivation or demotion below two is refused | AC-F03 |
| O5 | Chats outside projects live in the person's space, owned by the organisation, and go to the successor | AC-F07 |
| O6 | A departed person's personal agent retires; the successor may adopt it | AC-F07 |
| O7 | No team-scoped memory. Agents only propose **org knowledge**; a person promotes it. Agent learnings stay on the agent, attributed to who gave the feedback | GP Memory · AG-F09 |

O8 · slots and fallbacks: agent approver → other approvers → Admins + alert · project reviewer → other reviewers →
successor + alert · task assignee → successor, or back to Open · schedules and pick-up → keep running as the agent,
setter recorded · keys minted → revoked (automation uses service users) · service users owned → successor · work
connections → nothing (service identities) · last Admin → blocked.

O9 · where memory lives: project memory on the project, untouched · agent learnings on the agent, untouched · org
knowledge on the deployment, untouched · chats outside projects → the successor · personal agent → retired, may be
adopted · personal-connection content → erased · History → append-only, names kept or pseudonymised.

### C · Connections and graph databases

| # | Decision | Lands in |
|---|---|---|
| C1 | A **work connection** is a service identity, made once by an Admin, attached to agents by a Modeller or an Admin. Shared work uses only work connections | CP-F02 |
| C2 | A **personal connection** is a person's own account, used only in runs that person starts and their helpers; its content is erased when they leave | CP-F02 · AC-F12 |
| C3 | A person's own plugin and graph-database switches apply only to runs that person starts; an Admin's switch is a ceiling | CP-F02 · GP Data |
| C4 | One credential per graph database. **Read-only sessions** are part of the connector contract, proved by a certification test | GP Data · system-design |
| C5 | Projects hold no connectors | PJ-F01 |
| C6 | Schedules act as the agent; the creator is recorded | AG-F07 · CP-F02 |

### L · The agent is the only door to data

| # | Decision | Lands in |
|---|---|---|
| L1 | **Lineage on every copy** — answers, findings, reports, snapshots, transcripts, notes, memory. A copy shows only when the viewer's default agent could read its sources; else it is redacted | GP Memory · EX-F02 · RC-F06 · PJ-F05 |
| L2 | A memory node inherits its sources' resources; cross-project asks too | GP Memory |
| L3 | **Raw queries** pass four layers: a static check (an unlabelled pattern needs `data/<db>/*`) · a read-only session · a result filter · Gremlin steps only, no scripts or lambdas | GP Data |
| L4 | **Outside runtimes reach data only through Invana's MCP tools**, redacted and recorded at the tool; the sandbox limits their network | CP-F03 · AC-F09 |
| L5 | **One outbound sensitivity check** for every exit — tools (their arguments too), outside agents, pull-request text, channels, exports, published reports. Runtimes and MCP clients are external | AC-F09 |
| L6 | Exports and published reports go through the outbound check, with lineage — the export rule SE-F06 leaves open | AC-F09 · SE-F06 · PJ-F05 |
| L7 | **Four sensitivity levels** are used by Access Policies; a derived value inherits the highest level of its sources | SE-F03 · SE-F08 · AC-F02 |
| L8 | Data is evidence, never instructions; writes and outbound acts start on Ask | AC-F02 · system-design |
| L9 | `/admin` never shows content columns; excerpts are sealed per object · ops access below the product is accepted and documented · the browser cache clears on a revoke or role change | system-design · AC-F03 |

### K · Leaving and keeping — AC-F12, light, on-prem

| # | Decision |
|---|---|
| K1 | Retention per store (memory, History, the ledger, the query log, recall), set by an Admin; default keep |
| K2 | A legal hold on memory and History stops retention and erasure; placing and lifting it is recorded |
| K3 | Names on work are kept or pseudonymised — one deployment setting |
| K4 | Personal-connection data is erased when a person leaves |
| K5 | **Forget a subject**: lineage finds every memory node citing a record and erases it; the graph database itself is the customer's |
| K6 | History keeps a signed checkpoint hash at each prune |
| K7 | **Subject export**: a person's profile, activity and personal-connection data as JSON |
| K8 | NFRs: TLS on every internal link — browser ↔ engine, engine ↔ Postgres, graph databases and RustFS · rotation of the install key, the ledger key, keys and work connections |

### LM · Limits

| # | Decision |
|---|---|
| LM1 | Limits per deployment, agent, run and session. Team and user limits bound personal runs only; projects and schedules use agent and deployment limits |
| LM2 | A session budget triggers continuation (W6) |

### W · Projects as work

| # | Decision | Lands in |
|---|---|---|
| W1 | A project is **any kind of work**, not only a question; its type decides its fields | PJ product · PJ-F01 |
| W2 | Task kinds · groups in dependency order, also across projects · a **project assistant** · **reviewers** · relations *started from* · *waits on* · *related* · cross-project asks arrive as proposals | PJ-F01 |
| W3 | No private projects: the private flag, staffing visibility and per-project opt-out go | PJ product · PJ-F01 · PJ-F03 · PJ-F05 |
| W4 | Pick-up is set by project members and runs as the agent; the setter is recorded | PJ-F01 |
| W5 | **Checks** gate a task; an agent's own "green" is not evidence | PJ-F01 |
| W6 | **Continuation**: at its session budget a run continues in a fresh session from a hand-off note — body in RustFS, row in Postgres. Fork, delegation and escalation to a person are separate; federation means outside agents only | AG-F05 · CP-F10 · system-design |
| W7 | **Runs with**: Invana · Claude Code · Codex. The model is pinned as told and reported as run | AG-F01 · CP-F10 |
| W8 | A worker carries runtimes, a sandbox and a workspace per task; a runtime adapter is a plugin and declares where its model runs. *Not building: a Claude Code runtime* is reversed | CP-F03 · CP-F02 |
| W9 | A skill reaches an outside runtime as its folder | AG-F04 |
| W10 | Retry is **not built**: a failure alerts and waits on a fix task | CP-F03 · CP-F11 |
| W11 | Runs show sessions, hand-off notes, the runtime and model reported, and the connection used | CP-F10 |
| W12 | A Recommendation is a task kind; recommendations land as proposals for the project assistant | PJ-F01 |
| W13 | J11's example is a docs project | J11 |

### G · AL · PL — the Graph plane, alerting, plugins

| # | Decision |
|---|---|
| G1 | A new operating-system product `os/graph`, code `GP`: **Data** — the customer's Graph: connectors, reading in place, identity links, the join across graph databases (CP-F05's graph-database mechanics) — and **Memory** — Invana's own graph: activity, runs, sessions, hand-offs, tasks, findings, decisions, relations, with lineage (AG-F09's store) |
| G2 | Thinking stays in Agents: AG-F09 becomes *Learn from memory* — learnings written when they happen, attributed; agents propose org knowledge |
| AL1 | CP-F11 is the one alerting home: CP-F08's History alerts, PJ-F06's platform alerts and AC-F05's off-list alert become alert kinds; PJ-F06 keeps only record patterns that open a lead |
| AL2 | Alert kinds: task failed · blocked · needs input · stopped moving · no approver · connection health · security (chain break, token reuse, lockout, policy widened, sandbox refusal). The Inbox (CP-F08) has default rules for the four task kinds |
| PL1 | *Domain pack* becomes **Team pack** everywhere |
| PL2 | CP-F02 adopts the Claude plugin layout — `.claude-plugin/plugin.json`, `skills/`, `.mcp.json` — with Invana's fields under `metadata:`; `plugin.toml` retires |
| PL3 | AG-F08 imports agents and skills from an agent tool's folder and from Claude plugins |
| PL4 | `specs/packs/software-delivery.md`: product manager (the project assistant), designer, coder, QA, security; their skills; the project type; `fs/` rules from the team's edit rights. The agents catalogue (AG-F02) lists built-ins plus Team pack agents |

### Defaults Ravi accepted

No team-scoped memory · chats go to the successor · approvers are people or teams, warn on a single person ·
deactivation names a successor · agents only propose org knowledge · at least two Admins · SSO and MFA building ·
second-person approval a setting, off by default · quarterly access reviews per agent · a Modeller imports, an Admin
applies policy files · team and user limits bound personal runs only · the second runtime is Codex · J11's example is a
docs project.

## Rules for every session

| Rule | Detail |
|---|---|
| Decisions are settled | Write *Decisions* into the files that own them; never reopen one. A conflict you cannot resolve is a row in *Questions for Ravi* |
| P01's map is the plan | From P02 on, every phase reads the approved audit report (`.agent-reports/product-manager/specs-work-and-access-audit.md`) for its targets, IDs and the contradictions it closes |
| IDs | A story ID in this file is provisional: a phase takes the next free number when it writes the story (`format.md` › *IDs*). A moved story takes the new product's code and the next free number there. A retired ID is never reused — today retired: GR-F01–GR-F05, GR-01–GR-17 (the old Graph product), PJ-F02, PJ-F04, PJ-16, PJ-17 |
| Rewrite in place | Never append a "changes" section; a story says only what is true now. Git is the history |
| Read every story you touch | No find-and-replace across stories: read each one and rewrite it |
| Breaking changes are pre-approved | Every breaking change *Decisions* names (AC-21 retired, person narrowing, owners in ask routing, *May delegate to*, private projects, *not building* SSO/MFA and a Claude Code runtime, `plugin.toml`) is approved by these decisions; no other breaking change is |
| Roles | *Who can* tables use Operator · Modeller · Admin and *named approver*; they link the role × feature table in AC-F02, never restate it |
| Generic | No domain in stories, criteria or Engine — a project, a task, a record, never a flight or a gene |
| One home per fact | A fact lives in the feature that owns it; others link (CLAUDE.md rule 15) |
| Present tense, no history | No decision ids in specs, no "was", no renames. A code change not yet made is a row in `specs/migrations.md` |
| Glossary words | Use `specs/glossary.md`'s words; a new word lands in the glossary in the same phase |
| Engine tables are parseable | `## Engine` keeps the subsections and first columns of `.claude/skills/system-design/SKILL.md` §3 |
| New stories are whole | Every new story has its folder, its five parts, an empty `task.md`, status `idea`, and each `## Screens` cell names a board or `—` |
| Write only your role's files | product-manager: `specs/**`, README *Core features*, the P01 report; anything else is a `recommend` row |
| Auto-approved, but for P01 | Phases P02–P07 do not wait for Ravi. A question a session would ask him is decided with its recommended option and written as a row in *Questions for Ravi* with the Answer `auto — recommended`. A session never marks a phase `blocked`: a point no option consistent with *Decisions* settles is a row with the Answer `open`, the text keeps the closest consistent wording, and the phase finishes the rest |
| Boards | A changed board name is a `recommend` row for the designer, never a canvas edit |
| QA task ids | Task rows in `task.md` use `<STORY>-T<n>` |

## Environment

| Name | Value |
|---|---|

## Setup

| Step | Command | In | Phases |
|---|---|---|---|

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| graph parses | `python3 scripts/specs/check.py --graph --out /tmp/specs-graph.json` | `.` | P06 · P07 | |

## Phases

### P01 · Audit — the consolidation map

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* · *Rules* · all of `specs/` · `README.md` · `.claude/skills/product-spec/format.md` · `.claude/team/TEAM.md` §7 |
| Stories | — |
| Done when | `.agent-reports/product-manager/specs-work-and-access-audit.md` holds, each as a table with file:line in the **current** specs: (1) contradictions 1–13 re-checked — still true, resolved or changed since — each with the phase that closes it; (2) duplicates across features (alerting in CP-F11 · CP-F08 · PJ-F06 · AC-F05, and any other fact with two homes); (3) every retired word and reference still present — old grant names, *Domain pack*, `plugin.toml`, *May delegate to*, owners in ask routing, private projects, team-held rules, and stale references to the retired `GR-` IDs (`migrations.md`, `task.md` rows); (4) the move map — each CP-F05 story to GP Data or kept in CP (the Admin's controls: connecting, mode, switch, health), each AG-F09 story to GP Memory or kept in *Learn from memory*, identity links' home (GP Data or SE-F06); (5) the ID map — every new and changed story of every phase below with its provisional ID, its target feature (corrected to today's tree) and the next free ID per product; (6) every decision in *Decisions* mapped to the file and story it lands in, with any it cannot place; no file in `specs/` changed |
| Lands | `.agent-reports/product-manager/specs-work-and-access-audit.md` |
| Boards | — |
| Review | |
| Approve | Ravi — he approves the map before any spec changes |
| Budget | |
| Steps | 1. Contradictions 1–13 against today's specs. 2. Duplicates and retired words. 3. Move map. 4. ID map and decision placement. 5. Gates green (untouched) |

### P02 · Moves — the Graph plane, one alerting home, Team pack

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (G1 · G2 · AL1 · PL1 · O7) · the P01 report · `specs/os/control/**` · AG-F09 · PJ-F06 · AC-F05 · `vision.md` · `glossary.md` · `system-design.md` · `migrations.md` |
| Stories | Moved: CP-18 → GP-01 · CP-19 → GP-02 · AG-54 → GP-03. Kept in AG-F09: AG-49 – AG-53 · AG-55. Changed: CP-59 · CP-60 · CP-20 · CP-36 · CP-37 · PJ-19 · AC-32 |
| Done when | `specs/os/graph/product.md` exists (code `GP`) with **Data** (GP-F01) and **Memory** (GP-F02), holding the moved stories under `GP` IDs from GP-01; vision's *The operating system* table names the Graph plane; CP-F05 is kept, smaller — the Admin's controls (install, set-up, connecting, mode, switch, health, practice graph) — and links GP Data for the connector contract, read mode, query languages, vector index and the join; GP Data holds identity link records, commit, withdraw and the join, and SE-F06 keeps match rules and SE-03; AG-F09 is *Learn from memory* and links GP Memory for the store; CP-F11 is the one alerting home and CP-F08, PJ-F06 and AC-F05 link it; *Team pack* replaces *Domain pack* in every file P01 listed (CP-20's slug too); every stale `GR-` reference is retargeted; the glossary defines Team pack, Memory, org knowledge, lineage and the Graph plane against *system graph* and *thinking graph*; `migrations.md` has a row per code change these moves imply; the index is regenerated |
| Lands | `specs/os/graph/**` (new) · `specs/os/control/**` (CP-F05 · CP-F08 · CP-F11 · CP-F02 words) · AG-F09 · PJ-F06 · AC-F05 · SE-F06 `## Engine` (identity links) · every file in the P01 report's *Domain pack* row · `vision.md` · `glossary.md` · `system-design.md` — sections: deployment and services, the system graph · `migrations.md` (with rows 95, 96, 161, 162 and line 10) · journeys that link moved stories · `README.md` *Core features* · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. `os/graph` product, Data, Memory. 2. Move the stories P01 mapped. 3. AG-F09 to *Learn from memory*. 4. Alerting into CP-F11. 5. Team pack and stale `GR-` references. 6. Glossary, vision, system design, migrations. 7. Gates green |

### P03a · Access as agent-only — policies, grants, asks, ownership, sign-in

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (T · E · A · O1 · O2 · O7) · the P01 report · `specs/os/access/**` · AG-F01 · AG-F05 · AG-F07 · `glossary.md` · `system-design.md` (security sections) |
| Stories | Changed: AC-04 · AC-12 · AC-13 · AC-15 · AC-26 · AC-32 · AC-24 · AC-25 · AC-35 · AC-36 · AG-24 · AG-42 · CP-11 · AC-21 retired. Also changed (P01 §7): AC-03 · AC-06 · AC-08 · AC-09 · AC-11 · AC-14 · AC-19 · AC-22 · AC-33 · CP-14 · CP-34 · AG-21 · AG-29 · AG-35 · AG-36 · EX-02. New: AC-37 *Say what an agent may touch on a worker: files, commands, network* · AC-38 *Choose a person's default agent* (AC-F03) · AC-39 *Grant agents to a team and see who gains them* · AC-40 *Sign in with the company's SSO and a second factor* (AC-F01) · AC-41 *Review each agent's access every quarter* (AC-F08) · AG-60 *Make a personal agent* (AG-F01) |
| Done when | AC-F02 states the one grammar with `memory/` · `project/` · `fs/` · `cmd/` · `net/`, the evaluation order (E), the role table with History *Own* for Operator and Modeller, the default agent, pack policy files applied by an Admin, second-person approval as a setting, and no team-held rule (AC-21 removed, its ID retired); AC-F03 grants agents to people and teams with a preview; AC-F04 has no person narrowing and states the run scope and ceilings; AC-F05 routes asks to approvers then Admins, approvers are people or teams, a yes is this run only, *May delegate to* is gone and delegation follows grants (AG-F05 too); AC-F07 has platform-owned built-in and shared agents with *made by*, personal agents, retire never delete; AC-F11 clients act through the default agent; AC-F01 and the AC product build SSO and MFA; AC-F08 holds the quarterly access review; CP-F04 bounds team and user limits to personal runs; schedules act as the agent; no *Who can* names an owner as a grant; glossary and system design agree |
| Lands | `specs/os/access/**` except AC-F06, AC-F09, AC-F12 · AG-F01 · AG-F05 · AG-F07 · AG-F02 (AG-35 only) · EX-F04 (EX-02 only) · CP-F04 · `glossary.md` · `system-design.md` — sections: security, the policy check, sign-in · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AC-F02 grammar, order, role table, default agent. 2. AC-F03 grants and preview. 3. AC-F04 and run scope. 4. AC-F05 and AG-F05 asks and delegation. 5. AC-F07 and AG-F01 ownership. 6. AC-F01 SSO and MFA, AC-F08 reviews, AC-F11. 7. CP-F04 limits, AG-F07 schedules. 8. Glossary, system design, migrations. 9. Gates green |

### P03b · Access as agent-only — connections, data paths and lineage

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (C · L · A9) · the P01 report · P03a's hand-off note · CP-F02 · CP-F03 · `specs/os/graph/**` · AC-F09 · EX-F02 · SE-F03 · SE-F06 · SE-F08 · RC-F06 · PJ-F05 |
| Stories | Changed: CP-02 · CP-03 · CP-42 · CP-43 · CP-44 (as P01 maps) · AC-30 · EX-15 · SE-20 · SE-22 · RC-05 · RC-06 · PJ-14 · AC-27 · AC-31 · EX-08. New: CP-62 *Make a work connection and attach it to agents* · CP-63 *Connect my own accounts for my own runs* · AC-42 *Stop sensitive data at every exit* · GP-04 *Trust that a read never writes* · GP-05 *Run a raw query within what the agent may read* · GP-06 *See where any excerpt came from and who may see it* · GP-07 *Read memory only as far as its sources allow* |
| Done when | CP-F02 has work and personal connections, personal switches for own runs only, and no per-person OAuth on shared work; GP Data states one credential per graph database, read-only sessions in the connector contract with a certification test, and the four raw-query layers; GP Memory states lineage on every copy and inheritance of sources' resources; AC-F09 is one outbound check for every exit with runtimes and MCP clients external, and states the export rule (SE-F06 links it); SE-F03 and AC-F02 use four sensitivity levels; SE-F08 derived values inherit the highest level; RC-F06 aligns with memory lineage; EX-15 and PJ-14 show a copy only as far as the viewer's default agent reads; system design states the read-only contract, the outbound check, lineage, `/admin` sealing and cache clearing |
| Lands | CP-F02 · `specs/os/graph/**` · AC-F09 · AC-F02 (sensitivity) · EX-F02 · EX-F03 (EX-08 only) · SE-F03 · SE-F06 · SE-F08 · RC-F06 · PJ-F05 · `glossary.md` · `system-design.md` — sections: data flow, connectors, the ledger, lineage · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. CP-F02 connections. 2. GP Data: read-only and raw queries. 3. GP Memory: lineage. 4. AC-F09 outbound check and export. 5. Sensitivity levels in SE and AC. 6. EX, RC, PJ copies. 7. Glossary, system design, migrations. 8. Gates green |

### P04 · Leaving and keeping

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (K · O3 – O9 · C2) · the P01 report · P03a and P03b hand-off notes · `specs/os/access/**` · GP Memory · `system-design.md` |
| Stories | Changed: AC-23 · AC-16 · AC-22 (two Admins). New: AC-43 *Adopt a departed person's agent and chats* (AC-F07) · AC-44 *Set how long memory and History are kept, and hold them* · AC-45 *Decide what happens to a person's name and personal data when they leave* · AC-46 *Forget a subject everywhere memory cites them* · AC-47 *Export everything held about a person* (AC-F12) · J12 *A person leaves and the team keeps working* |
| Done when | AC-F12 *Leaving and keeping* exists, light and on-prem: retention per store (default keep), legal hold, names kept or pseudonymised by one setting, personal-connection data erased, forget a subject through lineage, subject export (profile, activity and personal-connection data as JSON); AC-23 names a successor who takes every slot with the fallbacks in O8; AC-F03 refuses going below two Admins; AC-F07 holds chats and personal agents going to the successor; AC-F06 keeps a signed checkpoint hash at each prune; J12 strings deactivate → successor → agents and projects unchanged; `system-design.md` has NFR rows for internal TLS and key rotation (K8); the AC product and system design agree; no compliance write-up is added |
| Lands | `specs/os/access/features/AC-F12-*/**` (new) · AC-F03 · AC-F06 · AC-F07 · `specs/os/access/product.md` · `specs/journeys/J12-*.md` (new) · `glossary.md` · `system-design.md` — sections: History, retention, the security NFRs · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AC-F12 and its stories, subject export among them. 2. Successor, slots and two Admins. 3. Adopt agents and chats. 4. History checkpoint. 5. J12. 6. Glossary, system design (TLS and rotation NFRs), migrations. 7. Gates green |

### P05a · Projects as work

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (W1 – W5 · W12 · W13 · C5 · O7) · the P01 report · `specs/capabilities/projects/**` · GP Memory · CP-F08 |
| Stories | Changed: PJ-01 · PJ-02 (slug *say-who-can-see-it* goes) · PJ-12 · PJ-15 · PJ-18 · and every story naming a private project: PJ-03 · PJ-11 · PJ-13 · PJ-14 · PJ-19 · CP-30 · CP-36. New: PJ-20 *Give a project its kinds of task* · PJ-21 *Ideate with the project assistant* · PJ-22 *Name the project assistant and its reviewers* · PJ-23 *Relate a project to another or start one from it* · PJ-24 *Ask another project for help* · PJ-25 *Gate a task on its checks* · GP-08 *See a project as a map and what is moving on it* · GP-09 *Promote a learning to org knowledge* · J11 *Ideate and run a project with its assistant* |
| Done when | The PJ product says a project is any kind of work; PJ-F01 has type-driven fields, task kinds (Recommendation among them), groups across projects, the project assistant, reviewers, the three relations, cross-project asks as proposals, checks that gate a task, pick-up set by members and run as the agent, no connectors; no private project, staffing visibility or per-project opt-out remains in any PJ file, CP-F07, CP-F08 or `migrations.md` M25; GP Memory holds the project map and org knowledge; J11 runs a docs project from ideation to accept |
| Lands | `specs/capabilities/projects/**` · CP-F07 · CP-F08 (private-project lines only) · `specs/os/graph/**` (Memory) · `specs/journeys/J11-*.md` (new) · `glossary.md` · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. PJ product and PJ-F01 model. 2. Remove private projects. 3. New PJ stories. 4. GP Memory map and org knowledge. 5. J11. 6. Glossary, migrations. 7. Gates green |

### P05b · Runtimes, continuation and runs

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (W6 – W11 · LM2 · L4 · AL2) · the P01 report · P05a's hand-off note · AG-F01 · AG-F04 · AG-F05 · CP-F02 · CP-F03 · CP-F04 · CP-F08 · CP-F10 · CP-F11 · J08 · `system-design.md` |
| Stories | Changed: CP-09 · CP-10 · CP-11 · CP-37 · CP-60 · AG-21 · CP-50 · CP-57 · CP-58. New: AG-61 *Choose what an agent runs with* · AG-62 *Continue in a fresh session from a hand-off note* · CP-64 *Install an agent runtime* (CP-F02) · CP-65 *Run an outside runtime safely on a worker* · CP-66 *Read a run session by session with its hand-off notes* · CP-67 *Get told when work stops or a connection fails* · J10 *Fix a reported bug with an agent* |
| Done when | AG-F01 has *Runs with* (Invana · Claude Code · Codex) and the model told vs reported; AG-F04 says a skill reaches an outside runtime as its folder; AG-F05 has continuation from a hand-off note (body in RustFS, row in Postgres), fork, delegation, escalation to a person, federation for outside agents only; CP-F03 carries runtimes, the sandbox and a workspace per task, reverses *not building: a Claude Code runtime* and *Access Policies on workers* (the sandbox enforces `fs/` `cmd/` `net/`), keeps retry not built at task level — a failed task is never re-run — while a plan step's bounded `repeat` stays and says it never re-runs a failed task; CP-F02 holds runtime adapters as plugins; CP-F04 has the session budget; CP-F10 shows sessions, hand-off notes, runtime, model and connection; CP-F11 and CP-F08 hold the task, connection and security alert kinds; J08 covers task and connection alerts; J10 runs bug → project assistant → coder on a worker → checks → pull request → a person merges; system design states runtimes on workers, the sandbox and hand-off notes |
| Lands | AG-F01 · AG-F04 · AG-F05 · CP-F02 · CP-F03 · CP-F04 · CP-F08 · CP-F10 · CP-F11 · `specs/journeys/J08-*.md` · `specs/journeys/J10-*.md` (new) · `glossary.md` · `system-design.md` — sections: workers and runtimes, runs, storage of notes · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AG-F01 *Runs with*. 2. AG-F05 continuation, AG-F04. 3. CP-F03 runtimes and sandbox, CP-F02 adapters. 4. CP-F04 session budget. 5. CP-F10 sessions. 6. CP-F11 and CP-F08 alert kinds. 7. J08, J10. 8. Glossary, system design, migrations. 9. Gates green |

### P06 · Plugin format and the Software delivery pack

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (PL · A13) · the P01 report · CP-F02 · AG-F02 · AG-F08 · `.claude/team/TEAM.md` · `.claude/team/edit-rights.json` · `.claude/agents/*.md` |
| Stories | Changed: CP-20 · AG-35 · AG-39 · AG-40. New (provisional IDs): AG-63 *Bring in agents and skills from an agent tool's folder* |
| Done when | CP-F02 states the Claude plugin layout (`.claude-plugin/plugin.json`, `skills/`, `.mcp.json`) with Invana's fields under `metadata:` and no `plugin.toml`; a Team pack's policy files apply only by an Admin; AG-F08 imports from an agent tool's folder and from Claude plugins, by a Modeller; AG-F02 lists Team pack agents; `specs/packs/software-delivery.md` names the agents (the product manager as project assistant, designer, coder, QA, security), their skills, the project type and `fs/` rules from the edit rights, and links the specs it relies on; a grep over P06's Lands finds no retired word from the P01 report; the graph parses |
| Lands | CP-F02 · AG-F02 · AG-F08 · `specs/packs/software-delivery.md` (new) · `glossary.md` · `system-design.md` — section: plugins · `migrations.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. CP-F02 plugin layout. 2. AG-F08 import, AG-F02 catalogue. 3. The Software delivery pack. 4. Retired-word grep over its Lands and fixes. 5. Glossary, system design, migrations. 6. Gates green |

### P07 · Sweep — retired grants and owners across the tree

| | |
|---|---|
| Agent | product-manager |
| Read | *Decisions* (T3 · A1 · O1 – O8) · the P01 report §3 and §7 · P02 – P06 hand-off notes · AC-F02 role table · `glossary.md` |
| Stories | Every story in the P01 report's §3 rows marked P07 — SE-01 · SE-02 · SE-03 · SE-05 · SE-07 · SE-08 · SE-09 · SE-11 · SE-12 · SE-13 · SE-16 · SE-19 · SE-21 · RC-03 · RC-04 · RC-08 – RC-12 · PJ-10 — and any other a whole-tree grep finds |
| Done when | No old grant name (*Can shape the model*, *Can work on projects*, `contributor`, *Can manage people*), no *(owner)* refusal or *Graph owner*, no owners as a grant, no per-team narrowing and no Access table heading citing `.claude/team/TEAM.md` §7 remains anywhere in `specs/`; per-team *reporting* is kept where it is not narrowing; *Who can* tables use Operator · Modeller · Admin and link AC-F02; a grep over all of `specs/` finds no retired word from the P01 report; the graph parses |
| Lands | `specs/capabilities/semantics/**` (SE product, SE-F02 · F04 · F05 · F07 · F09 · F10 and their stories) · `specs/capabilities/recall/**` (RC-F01 – F05 · RC-F07 and their stories) · AG-F02 · AG-F04 · AG-F06 · AG-F10 · EX-F01 · PJ-F03 · CP-F01 · CP-F09 · `ontology.md` · `personas.md` · every Access table heading in `specs/` · `glossary.md` · `specs/README.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. SE product, features and stories. 2. RC features and stories. 3. AG, EX, PJ, CP features. 4. `ontology.md`, `personas.md`, Access headings. 5. Whole-tree retired-word grep and fixes. 6. Gates green |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Audit — the consolidation map |  | done | 2026-11-13 | gates green · reviews passed |
| P02 | Moves — the Graph plane, one alerting home, Team pack | P01 | done | 2026-11-13 | gates green · reviews passed |
| P03a | Access as agent-only — policies, grants, asks, ownership, sign-in | P02 | done | 2026-11-13 | gates green · reviews passed |
| P03b | Access as agent-only — connections, data paths and lineage | P03a | done | 2026-11-13 | gates green · reviews passed |
| P04 | Leaving and keeping | P03b | done | 2026-11-13 | gates green · reviews passed |
| P05a | Projects as work | P03b | done | 2026-11-13 | gates green · reviews passed |
| P05b | Runtimes, continuation and runs | P05a | done | 2026-11-13 | gates green · reviews passed |
| P06 | Plugin format and the Software delivery pack | P05b | done | 2026-11-14 | gates green · reviews passed |
| P07 | Sweep — retired grants and owners across the tree | P06 | done | 2026-11-14 | gates green · reviews passed |

## Hand-off notes

| ID | Note |
|---|---|
| P01 | The map is `.agent-reports/product-manager/specs-work-and-access-audit.md` (git-ignored — keep the file). IDs to write, in phase order: AC-37 – AC-47 · CP-62 – CP-67 · AG-60 – AG-63 · PJ-20 – PJ-25 · GP-01 – GP-09; the phase entries now carry them — §5 governs. Only CP-18, CP-19 and AG-54 change product; CP-F05 stays, smaller. §7's stories and Lands are in P02 – P05b. Retired words outside the *Specs* line go to P07. `check.py` reads product codes from front-matter, so `GP` needs no tooling change; `format.md`'s os/ list is R361 |
| P02 | `specs/os/graph/` holds GP-F01 Data (GP-01 · GP-02) and GP-F02 Memory (GP-03); next free GP-04. AG-F09's folder is now `AG-F09-learn-from-memory` (title *Learn from memory*); CP-20's is `CP-20-install-a-team-pack`. Memory's routes are `/api/v1/graph/memory…` (GP-F02 Engine); package `graph` is in system-design § 8 and M26. CP-F11 has *The alert kinds* table — 8 kinds (History match and Recently added decider moved in); **P03a/P05b** add *no approver*, task, connection and security kinds there and AC-F05 links them; notification-rule recipient is `agent_approvers`; criteria CP-37.7–8 are now CP-60.8–9. GP-F02's node kinds list today's set only — **P05a/P05b** add Task, Session, Hand-off note nodes and relations; **P03b** adds lineage redaction (GP-06/07) and read-only/raw-query rules to GP-F01 (its Rules already hold *A read never writes*). Glossary defines Memory, Org knowledge, Lineage, Graph Plane, Team pack. GP-03's task.md starts empty (QA row dropped — R364). `docs/docs/index.md` still says Domain pack (R363); R362 (designer: History alerts on `control.alerts.settings`). Migrations M26 Graph Plane in code, M27 one alerting home. **Resume**: all seven steps are done and committed (last: step 7); files left: none. The next session re-runs both gates, reads the *Done when* line against GP-F01/GP-F02, CP-F05, AG-F09, CP-F11/CP-F08/PJ-F06/AC-F05, glossary, vision and system design, fixes any gap it finds, then hands the phase to the runner |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-13 | P02 | The new Graph plane's code: `GR` and its IDs were the old Graph product's (GR-F01 – F05, GR-01 – 17, all retired); `format.md` never reuses an ID | A: keep `GR`, number on · B: a new code · C: reuse the retired IDs | A | B — `GP` (Graph plane): GP-F01 Data, GP-F02 Memory, stories from GP-01 — Ravi |
| 2026-11-13 | P03a · P05a | Phases after P01 are auto-approved like specs-planes; the access and projects rewrites carry the breaking changes | A: auto-approved · B: `Approve: Ravi` on P03b and P05b too | A | A — only P01 stops — Ravi |
| 2026-11-13 | P04 | Not in the decisions: internal TLS and key rotation (NFRs) and a subject export | A: leave out · B: the two NFR rows only · C: all three | B | C — all three in P04 (K7, K8) — Ravi |
| 2026-11-13 | P01 · P07 | Retired words outside the project's *Specs* line | A: add P07 sweep after P06 · B: fold into P06 · C: leave for a later project | A | A — Ravi |
| 2026-11-13 | P01 | Lands corrections (report §7) for P02 – P05b | A: approve with the map · B: only within the current *Specs* line, the rest to P07 | A | A — Ravi |
| 2026-11-13 | P01 · P02 | AG-F09 move | A: only AG-54 moves to GP Memory, six stay · B: all seven stay, only the store moves · C: AG-53 and AG-54 move | A | A — Ravi |
| 2026-11-13 | P01 · P02 | Identity links' home | A: GP Data holds link records, commit, withdraw and the join; SE-F06 keeps match rules and SE-03 · B: all in SE-F06 · C: all to GP Data | A | A — Ravi |
| 2026-11-13 | P01 | Journey numbers: P04 writes J12 before J11 and J10 | A: keep J10 – J12 as *Decisions* name them · B: renumber in creation order | A | A — Ravi |
| 2026-11-13 | P01 · P05b | *Retry is not built* vs CP-F03's bounded step `repeat` | A: task-level only — a failed task is never re-run; a plan step's bounded retry stays · B: remove step retry too | A | A — Ravi |
| 2026-11-13 | P02 | History match, Recently added decider and Data from a schema-only workflow alerts close only on an Admin's note, so an Operator a History alert names keeps it in *Needs you* until an Admin closes it | A: keep — an Admin closes · B: a *Seen* act for the people it reaches (new scope) | A | auto — recommended |
| 2026-11-13 | P02 | Where Memory's routes and code live (not settled by *Decisions*; system-design § 8 *a route sits under the package that owns its records*) | A: a `graph` package, routes `/api/v1/graph/memory…` (M26) · B: keep them under `/api/v1/agents/thinking…` | A | auto — recommended |
| 2026-11-13 | P02 | AG-F09's folder slug follows its new title (`AG-F09-learn-from-memory`; `format.md`: the slug may change, the ID never) | A: rename the slug, retarget every link · B: keep `thinking-graph-and-memory` | A | auto — recommended |
