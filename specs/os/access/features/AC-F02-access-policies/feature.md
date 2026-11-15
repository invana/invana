---
id: AC-F02
title: Access Policies
product: AC
status: idea
personas: [admin, modeller, builder, analyst]
stories: [AC-03, AC-04, AC-37, AC-06, AC-11, AC-08, AC-19, AC-20, AC-27, AC-07]
journeys: [J05, J06, J07, J09]
boards: [settings.policies, settings.roles, settings.agent_access, agents.runs, explore.board, settings.people, model.models, agents.agents]
nfrs: [NFR-SEC-1, NFR-SEC-4, NFR-SEC-8, NFR-SEC-5, NFR-SEC-11]
depends_on: [AC-F01, AC-F03, AC-F05, AC-F06, AG-F01, AG-F04, SE-F03]
---

# Access Policies

> What each person, team, project and agent may do — named Access Policies of rules, each rule an effect, an action
> and a resource, read from one permission catalogue — attached to users, teams and projects as grants and to agents
> as ceilings; the locked Super user policy and the starter policies; the order every act is checked in.
> The decision it helps make: *who may do this — and what breaks if I change it?*

## User journey

Journeys this feature is a step of: [J05 · Join a team](../../../../journeys/J05-join-a-team.md) ·
[J06 · Set what an agent may touch](../../../../journeys/J06-set-what-an-agent-may-touch.md) ·
[J07 · Ready a deployment](../../../../journeys/J07-ready-a-deployment.md) ·
[J09 · Audit what an agent touched](../../../../journeys/J09-audit-what-an-agent-touched-and-what-left-the-platform.md)

```mermaid
flowchart TD
  start([Access › What they may do › Access Policies]) --> list["AC-03 · Every Access Policy and who it is attached to"]
  list --> who{"Does the reader hold Edit on Access?"}
  who -->|no| ro["AC-07 · Every policy reads · each write disabled, naming the permission and who can grant it"]
  who -->|yes| open["AC-04 · A policy as the permission matrix: resource × action · Allow or Deny"]
  list --> open
  open -->|Super user| lock["Locked · reads only"]
  open -->|built in · a starter policy| copy["Copy, or edit the starter in place"] --> open
  open --> wk["AC-37 · Files, commands and the network on a worker — agents and projects"]
  list --> draft["AC-06 · Draft with the assistant — a sentence becomes a draft"]
  list --> imp0["A policy file from an import or a Team pack · a draft until applied"]
  open -->|Edit| edit["A draft of the next version"]
  wk --> edit
  imp0 --> edit
  draft --> imp{"AC-06 · Who it changes"}
  edit --> imp
  imp -->|nobody loses| sv{"A second person's yes is set?"}
  imp -->|someone loses · a skill or workflow would break| warn["Losses with their 30-day use · what would break"]
  warn -->|Save anyway| sv
  warn -->|Cancel| edit
  sv -->|no| save(["Saved · a new version · History"])
  sv -->|yes| two["Waits for another person's yes"]
  two -->|yes| save
  two -->|no| edit
  edit -->|a rule outside the grammar · a name taken| ref["Refused in place, naming the rule"]
  ref --> edit
  save --> att["AC-11 · Attach it to people, teams, projects — or to agents as a ceiling"]
  att -->|the last holder of Super user| lst["Refused · Super user always has a holder"]
  list --> chk["AC-08 · What can this person do? — each permission and the policy behind it"]
  chk -->|allowed| yes(["Yes · every check that passed"])
  chk -->|refused| no(["No · the first check that refused, named"])
  start --> cat["AC-19 · The permission catalogue"]
  start --> bi["AC-20 · The built-in agents and their ceilings"]
  start --> kept["AC-27 · Kinds and levels kept from agents"]
  act([An act in Studio · a step of a run]) --> order["The order of checks · active · the person · switches · the run's reach · ceilings · limits"]
  order -->|every check passes| go(["It runs · a ledger row"])
  order -->|a rule says Ask| askf(["AC-F05 · waits for a named approver"])
  order -->|a check refuses| blk(["Refused · names the check, the permission and who can grant it"])
  blk -.-> hist(["AC-F06 · History"])
```

```mermaid
sequenceDiagram
  actor P as Person with Edit on Access
  actor Q as Second person with Approve on Access
  participant S as Studio
  participant E as Engine
  participant A as Assistant
  P->>S: Draft with the assistant — "analysts read orders, but never personal data"
  S->>E: draft from one sentence
  E->>A: asks once for rules in the policy grammar
  A-->>E: proposed rules
  E->>E: checks each rule · saves a draft (decides nothing)
  E-->>S: Draft from the assistant · Not saved
  P->>S: Save
  S->>E: who it changes
  E-->>S: people, teams, projects and agents that gain or lose, with 30-day use · skills and workflows that would break
  P->>E: Save, signing in again
  alt a second person's yes is off
    E-->>S: saved as a new version · History row (AC-F06)
  else a second person's yes is on
    E-->>Q: Needs you · approve this change to access
    Q->>E: Approve, signing in again
    E-->>S: saved as a new version · History row naming both
  end
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-03 | [Read every Access Policy and what it is attached to](stories/AC-03-read-every-access-policy-and-what-it-is-attached-to/story.md) | idea |
| AC-04 | [Write the rules of an Access Policy](stories/AC-04-write-the-rules-of-an-access-policy/story.md) | idea |
| AC-37 | [Say what an agent may touch on a worker: files, commands, network](stories/AC-37-say-what-an-agent-may-touch-on-a-worker/story.md) | idea |
| AC-06 | [Draft a policy and see who it changes](stories/AC-06-draft-a-policy-and-see-who-it-changes/story.md) | idea |
| AC-11 | [Attach a policy to agents](stories/AC-11-attach-a-policy-to-agents/story.md) | idea |
| AC-08 | [Check whether someone can do something](stories/AC-08-check-whether-someone-can-do-something/story.md) | idea |
| AC-19 | [Read what each role may do](stories/AC-19-read-what-each-role-may-do/story.md) | idea |
| AC-20 | [Read the built-in agents and the policies they run under](stories/AC-20-read-the-built-in-agents-and-the-policies-they-run-under/story.md) | idea |
| AC-27 | [Keep a kind or a sensitive property from agents](stories/AC-27-keep-a-kind-or-a-sensitive-property-from-agents/story.md) | idea |
| AC-07 | [Read without the role and know who to ask](stories/AC-07-read-without-the-role-and-know-who-to-ask/story.md) | idea |

## Access

Every act below needs the permission named, from [the permission catalogue](#the-permission-catalogue). Without it the
act shows, disabled, naming the permission and who can grant it — *Needs Edit on Access — ask Priya or Lee*.

| Act | Permission |
|---|---|
| Read every Access Policy, its rules, versions and holders · the permission catalogue · the built-in agents · what is kept from agents · *What can {person} do?* | None — every signed-in person; a key reads under its owner |
| New policy · Copy · Edit · Delete · Draft with the assistant · Save · apply a policy file from an import or a Team pack | Edit on Access, in a session, signing in again on Save |
| Attach a policy to a user, a team, a project or an agent · take it off | Manage on Access, in a session, signing in again |
| Approve another person's change to access, when a second person's yes is set | Approve on Access — not the person who saved it |
| Turn a second person's yes on or off | Manage on Access, signing in again — itself a change that waits for a second yes while the setting is on |
| Set a property's level | Edit on the Model, in Meaning ([SE-F03](../../../../capabilities/semantics/features/SE-F03-meaning/feature.md)) |
| Make people and teams · put people on teams | Create · Edit on Access, in the Directory ([AC-F03](../AC-F03-directory/feature.md)) |

## States

| State | What the person sees |
|---|---|
| First use | *Super user*, locked, held by the first account; the starter policies, attached to nobody; each built-in agent's ceiling, marked *Built in*; *New policy* and *Draft with the assistant* lead |
| Empty after a filter | *Nothing matches*, with the filter named and *Clear filters* |
| Loading | The section opens at once; lists show loading rows; counts read `—` until the engine gives them |
| Has data | Access Policies one row each, the selected one beside them: its permission matrix, its rules as sentences, who it is attached to, its owner and maker, and its versions; a policy file from an import reads *Waiting to be applied* |
| Failed | What could not load or save, in a sentence, with *Try again*; a refused save says why in place, naming the rule or the name |
| Agent working or proposing | *Draft from the assistant · Not saved*, with who it changes, before anything changes; a change waiting on a second person reads *Waiting for a second yes* |
| No access | Every policy reads; each write is disabled, naming the permission it needs and who can grant it |

## Rules

| Rule | Detail |
|---|---|
| Access is Access Policies only | There are no roles. What anyone may do is the Access Policies attached to them, read against [the permission catalogue](#the-permission-catalogue). Nothing in the engine names a role |
| Who holds a policy | **Users** — people and service users · **teams** — each person on the team holds it · **projects** — *project access*, what the project's runs may reach · **agents** — a ceiling: the most the agent may ever do, never a grant. A key holds none: it narrows its owner ([AC-F10](../AC-F10-keys/feature.md)) |
| A person's permissions | The Allows of every policy attached to them and to every team they are on, minus every Deny. Default deny: what no rule allows is refused. Deny wins over Allow |
| A rule | Effect · action · resource. On a user's or a team's policy the effect is Allow or Deny; on a project's or an agent's it may also be **Ask** — the step waits for a named approver ([AC-F05](../AC-F05-asks-and-approvals/feature.md)). A new rule on a project or an agent starts at Ask |
| Actions | Read · Create · Edit · Publish · Run · Manage — what each means for each resource is [the permission catalogue](#the-permission-catalogue); an action a resource does not take is refused. On screen *Publish* reads *Publish · Approve* |
| Resources | `<type>/<segment>…` — the types and their segments are [the permission catalogue](#the-permission-catalogue). `*` stands for one whole segment — `data/*/Customer` is every graph database's Customer, `tool/web/*` every web tool; `*` inside a segment is refused. A rule on `data/<graph database>/<kind>` reaches every level of that kind; a fourth segment — `public` · `internal` · `confidential` · `personal`, the levels of [SE-F03](../../../../capabilities/semantics/features/SE-F03-meaning/feature.md) — reaches only that level. In `fs/` only, a last segment `**` stands for every path below ([AC-37](stories/AC-37-say-what-an-agent-may-touch-on-a-worker/story.md)) |
| A person's own act | An act a person makes in Studio, the API or the CLI is checked against the person's permissions. When a built-in agent carries it — the Query console, the Loader, the Record editor — that agent's ceiling narrows it too |
| A project owns its access | Every run inside a project — asked by anyone on its team, scheduled, picked up or started by its Lead agent — reaches **project access ∩ the agent's ceiling** ∩ every caller's ceiling ∩ the run's other ceilings. The person who asked is recorded on the run; their own policies are not read inside a project, and joining or leaving never changes what the project may do ([PJ-F01 › Rules](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#rules)) |
| Outside a project | A run reaches the person behind it ∩ the agent's ceiling ∩ every caller's ∩ the run's other ceilings ([AC-F04](../AC-F04-what-an-agent-may-touch/feature.md#rules)). The person behind it is who asked, a key's owner, the person who consented a connected client, or a schedule's setter. A run whose person cannot act — deactivated, with no successor yet — waits, naming them, until the slot falls back ([AC-F07](../AC-F07-ownership/feature.md#slots-and-fallbacks)) |
| Project access | One Access Policy attached to each project, started from a project access template and set through a plain form — graph databases, models, agents, workers, what may leave — or, by *Edit as policy*, the full matrix ([PJ-F01 › Rules](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#rules)). Setting or widening it needs Manage on Projects (`projects:access`); a person without it asks, and the part they may not grant waits for someone who may. It grants a person nothing outside the project |
| Project access templates | *Read and analyse* · *Fix data quality* · *Full project* ship as data, owned by the system user, edited and copied like a starter policy; a project's type may name its default |
| An agent holds only a ceiling | The policies attached to an agent are the most it may ever do — *may edit Graph Data: no*, *may send outside: no*. Adding it to a project's team grants it nothing. Using an agent is Run on `agent/<name>`, a person's permission |
| Super user | One built-in policy: every action on every resource. The first account, made from the CLI, holds it. It is locked — never edited, renamed, copied over or deleted — and never taken off its last active holder |
| Starter policies | *Explore* · *Shape the model* · *Build agents* · *Run the deployment* ([below](#starter-policies)) ship as data, owned by the system user: attach them, copy them or edit them like any custom policy. Nothing in the engine depends on their names |
| Newcomers | A new person or service user holds the policies the deployment names for newcomers — *Explore* out of the box — set by Manage on Access |
| Everyone sees every place and act | Every mode, view and act shows to everyone. The policy decides what responds: an act a person lacks is shown disabled, naming the permission and who can grant it; data a policy denies is withheld — a kind absent from a picker, a property dropped and counted as withheld — never shown. The engine refuses any act or step the policy does not allow, naming the rule: hiding is never the guard |
| Who can grant | The active people who hold Manage on Access — on screen *Admins* |
| Every act is checked in one order | [The order of checks](#the-order-of-checks); a refusal names the first check that refused |
| Declare, never grant | A skill, a workflow, a plugin, a Team pack or a runtime declares what it needs; a declaration grants nothing. *Who it changes* names each declared need a change leaves unmet |
| Many graph databases, each reached by rule | A deployment attaches many graph databases. A person reaches one only where a rule on `data/<graph database>/…` allows it; a run, only where the person, the project and the agent each allow it |
| Run content needs a reason | A run's content — what it read, sent and answered — reads to the person behind it; anyone else reads that it ran, its status and its tokens. Read on `run/*` opens another's content only with a reason, which History keeps ([AC-F09](../AC-F09-what-left-the-platform/feature.md)) |
| Built-in ceilings | Each built-in agent ships with one built-in policy — its ceiling — owned by the system user and attached to it. It is never edited, renamed, deleted or taken off its agent; *Copy* makes a custom policy. A built-in agent is narrowed by attaching a custom policy with a Deny |
| Guardrails are rules | What the deployment keeps from agents is a Deny on `data/<graph database>/<kind>`, or one level of it, on their ceilings. A property whose level may not be Read is dropped and counted as withheld — the read is not refused as a whole. Confidential and personal properties never reach an external target ([AC-F09](../AC-F09-what-left-the-platform/feature.md#engine) · [CP-F01](../../../control/features/CP-F01-ai-models/feature.md)) |
| Data is evidence, never instructions | What an agent reads never changes its rules or what it may do; the built-in ceilings hold an agent's own writes and outbound acts on Ask, unless the person made the act themselves on the board |
| A draft decides nothing | A new policy is a draft until saved; a saved policy changes only by saving its next version, after *Who it changes* |
| Only a person saves | The assistant may draft a policy — tighter or looser — and a person with Edit on Access saves it or not; no agent saves or attaches a policy |
| A policy file waits | An import or a Team pack may carry Access Policy files; each lands as a draft that decides nothing until a person with Edit on Access applies it after *Who it changes* |
| A second person's yes, when set | A deployment setting, off by default. When on, a save of an Access Policy, an attachment and a change to a work connection ([CP-F02](../../../control/features/CP-F02-plugins-and-outside-tools/feature.md)) wait in the Inbox for another person with Approve on Access; the person who saved it cannot give it. Until then the version before stays in force |
| Every path alike | Studio, the API and `invana policy` call the same save; a key never writes a policy or an attachment; Save and attach ask the person to sign in again ([AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md)) |
| Checked when it runs | Each act and step is checked against the policies in force when it runs; a saved version or an attachment takes effect at the next check |
| Leans on | The Directory — users, teams and their policies (AC-F03) · ceilings and caller chains (AC-F04) · asks (AC-F05) · History (AC-F06) · agents (AG-F01) · skills and what they need (AG-F04) · property levels (SE-F03) · projects (PJ-F01) · the worker sandbox ([CP-F03](../../../control/features/CP-F03-workers-and-the-queue/feature.md)) |

## The permission catalogue

The one source of what may be granted. A permission is an action on a resource — `data:edit` on
`data/sales/Order`. Every feature's acts name the permission they need from here; no feature restates who may.
`—` is an action the resource does not take. *Holders* names who a rule on it may be attached to.

| Resource | Pattern | Read | Create | Edit | Publish · Approve | Run | Manage | Holders |
|---|---|---|---|---|---|---|---|---|
| Graph Data | `data/<graph database>/<kind>[/<level>]` | Read its records | Add records — load, add on the board | Change records — fix (*Fix from the queue*), merge, annotate, delete | — | — | — | users · teams · projects · agents |
| Model | `model/<model>` | Read it — kinds, meaning, rules, history | Start a model | Change its draft — kinds, meaning and levels, taxonomies, standards, rules, links between models | Publish a version | Run inference and health checks | — | users · teams · agents |
| Projects | `project/<project>` | Read a project the reader is not on | Start a project | Change its tasks, files and context — what a person on its team always may | — | — | Set or widen its access (`projects:access`) · archive or delete it, without being on its team | users · teams · projects · agents |
| Memory | `memory/project/<project>` · `memory/agent/<agent>` · `memory/org` | Recall from it | — | Write to it, forget from it | — | — | — | projects · agents |
| Agents | `agent/<name>` | Read it, its versions and its ceiling | Build an agent | Change its draft · its approvers | Publish a version | Use it — ask it, start its runs, hand it work | Share or retire another's personal agent · set its ceiling's approvers | users · teams · projects · agents |
| Skills | `skill/<name>` · `workflow/<name>` | Read it | Write or import one | Change its draft | Publish a version | Run it | — | users · teams · projects · agents |
| Plugins | `plugin/<name>` · `tool/<plugin>/<tool>` | Read it | Add a plugin or an MCP server | Configure it | — | Call its functions and tools | The install switch · its work connections | users · teams · projects · agents |
| Runs | `run/<agent>` | Read runs the reader is not behind — content only with a logged reason | — | — | — | — | Stop, re-run or re-assign another's run | users · teams |
| Workers | `worker/<group>` | Read groups, workers, the queue, limits, alerts | Add a group or a worker | Change labels, limits, alert rules | — | — | Drain, pause the queue | users · teams |
| Settings | `setting/<section>` — `graph-databases` · `ai-models` · `connections` · `team-packs` · `deployment` · `retention` | Read it | Connect one — a graph database, an AI model, a Team pack | Change it — mode, switch, keys, retention, holds | — | — | — | users · teams |
| Access | `access/<area>` — `policies` · `directory` · `history` · `reviews` | Read every History row (a person always reads their own) | Make a policy, a person, a service user, a team | Change a policy's draft · a team's people · deactivate, reactivate | Approve another's change to access · sign off a review | — | Attach and take off policies · name newcomers' policies · the second-yes setting | users · teams |
| On a worker | `fs/<path>` · `cmd/<program>` · `net/<host>` | Read files · fetch from a host | Send to a host | Change files | — | Run a program | — | projects · agents |

| Rule | Detail |
|---|---|
| No permission needed | Sign in and keep one's own account, sessions and keys · read every Access Policy and the Directory — a person must see a rule to know whom to ask · read and answer the Inbox · answer an ask one is named for · read and stop the runs one is behind · everything inside a project one is on its team of |
| Ask is for runs | Ask is valid only on a project's or an agent's policy, since only a run waits for an approver |
| Holders | A rule on a resource whose *Holders* column does not name the policy's holder is refused at attach |

## Starter policies

Shipped as data, owned by the system user, attached to nobody but *Explore* to newcomers. Each is edited, copied
and attached like any custom policy.

| Policy | Allows |
|---|---|
| **Super user** — locked | Every action on every resource |
| **Explore** | Read `data/*/*` · `model/*` · `agent/*` · `skill/*` · `plugin/*` · `worker/*` · `setting/*` · Create `project/*` · Run `agent/assistant` · `agent/query-console` · `skill/*` · `plugin/*` |
| **Shape the model** | Read `data/*/*` · Create · Edit · Publish · Run `model/*` · Create · Edit `data/*/*` · Run `agent/modeller` · `agent/loader` · `agent/record-editor` |
| **Build agents** | Read `run/*` · Create · Edit · Publish · Run `agent/*` · `skill/*` · Create · Edit `plugin/*` |
| **Run the deployment** | Every action on `worker/*` · `setting/*` · `run/*` · `access/*` · Manage `plugin/*` |

## The order of checks

Every act, every step of every run, every route and every tool call is checked in this order; the first that refuses
ends it, and its refusal names that check.

| # | Check | Passes when | A refusal names |
|---|---|---|---|
| 1 | Active | The person — or the person behind the run — is active; a key is live ([AC-F03](../AC-F03-directory/feature.md) · [AC-F10](../AC-F10-keys/feature.md)) | The person or the key |
| 2 | The person | The person's permissions allow the action on the resource — for a run outside a project, the person behind it, Run on the agent included. A run inside a project skips it; the person is recorded | The permission and who can grant it |
| 3 | Switches | The graph database and the plugin the step uses are on — the install's switch, then the person's own switch for runs they start ([CP-F02](../../../control/features/CP-F02-plugins-and-outside-tools/feature.md) · [CP-F05](../../../control/features/CP-F05-graph-databases/feature.md)) | The switch |
| 4 | The run's reach | `decide()` allows it for the run's project access and for every agent in the caller chain — each one's ceiling: the strictest wins, no match is Deny. Ask waits for a named approver; a yes covers this step of this run ([AC-F05](../AC-F05-asks-and-approvals/feature.md)) | The rule, its policy and who set it |
| 5 | Ceilings | The key ∩ the run scope ∩ the graph database's mode allows it ([AC-F04](../AC-F04-what-an-agent-may-touch/feature.md)) | The ceiling |
| 6 | Limits | The step fits the limits, at admission ([CP-F04](../../../control/features/CP-F04-limits/feature.md)) | The limit |
| 7 | The ledger | A ledger row is written; anything leaving for an external target passes the outbound check — confidential and personal values never leave ([AC-F09](../AC-F09-what-left-the-platform/feature.md#rules)) | — |
| 8 | On a worker | The worker sandbox enforces `fs/` · `cmd/` · `net/` at the operating-system level; the credential is injected on the worker ([CP-F03](../../../control/features/CP-F03-workers-and-the-queue/feature.md)) | — |

## Data touched

| Record | Read or write |
|---|---|
| Access Policies — name, origin, rules, version, status, who drafted it | Write · read |
| Versions of a policy — its rules, who saved it, who approved it, when, why | Write · read |
| Attachments — which users, teams, projects and agents hold a policy, who attached it, when | Write · read |
| Users, teams and who is on each (AC-F03) | Read |
| Owners of a policy (Ownership, AC-F07) | Read |
| Refusals and uses in History (AC-F06) | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `access_policies` | `name` (`[a-z0-9-]`) · `title` · `description` · `origin` (`builtin` · `starter` · `custom` · `imported`) · `locked` (bool) · `imported_from?` (the import or Team pack) · `copied_from_id?` · `status` (`draft` · `awaiting` · `saved`) · `version` (a draft is 0) · `rules` · `drafted_by` (`person` · `assistant` · `file`) · `created_by_id` · `updated_by_id?` · `created_at` · `updated_at` | Unique `name`. A `builtin` policy — Super user and each built-in agent's ceiling — is written from code and owned by the system user; only Super user is `locked`. A `starter` policy is written once, at the first start, and edited like a custom one. `awaiting` is a saved version waiting for a second yes; the version before it stays in force |
| `access_policy_versions` | `policy_id` · `version` · `rules` · `description` · `saved_by_id` · `saved_at` · `approved_by_id?` · `approved_at?` · `why?` (500) | One row per save; never edited |
| `access_policy_attachments` | `policy_id` · `holder_kind` (`user` · `team` · `project` · `agent`) · `holder_id` · `attached_by_id` · `attached_at` | Unique (`policy_id`, `holder_kind`, `holder_id`). A project holds exactly one |

### Reads

| Record | Owner |
|---|---|
| Users, their teams and whether each is active | [AC-F03](../AC-F03-directory/feature.md#engine) |
| Owners and co-owners of a policy | Ownership (AC-F07) |
| A session's `signed_in_at` — signing in again | [AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md#engine) |
| The caller chain of a run's step, its ceilings and an agent's effective access | [AC-F04](../AC-F04-what-an-agent-may-touch/feature.md#engine) |
| Asks — a step set to Ask, an approval of a change to access | [AC-F05](../AC-F05-asks-and-approvals/feature.md#engine) |
| History — refusals and uses over 30 days for *Who it changes*, every event this feature writes | [AC-F06](../AC-F06-history/feature.md#engine) |
| Agents and the built-in agents | [AG-F01](../../../../capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) |
| Skills and what each needs — what a save would break | [AG-F04](../../../../capabilities/agents/features/AG-F04-skills/feature.md#engine) |
| Kinds of the published model and each property's level | [SE-F03](../../../../capabilities/semantics/features/SE-F03-meaning/feature.md#engine) |
| Graph databases and their names | [CP-F05](../../../control/features/CP-F05-graph-databases/feature.md#engine) |
| Projects, their names and their teams | [PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#engine) |

### Routes

| Route, after `/api/v1/access` | Does | Story |
|---|---|---|
| `GET /policies` · `POST /policies` | List policies by the list contract (`?origin=` · `?status=` · `?q=` · `?holder=` · `?resource=`) · create a custom policy as a draft | AC-03 · AC-04 |
| `POST /policies/drafts` | One sentence → a draft from the deployment's AI model, `drafted_by = assistant` | AC-06 |
| `GET /policies/{name}` · `PATCH /policies/{name}` · `DELETE /policies/{name}` | Read a policy, as rules and as the permission matrix · edit a draft, or a saved policy's draft of its next version (`why?`) · delete a custom or starter policy, its holders listed first | AC-04 · AC-37 |
| `POST /policies/{name}/copy` | A custom draft from any policy | AC-04 · AC-20 |
| `POST /policies/{name}/impact` | Who it changes: per holder — and per person through a team — each action and resource gained or lost with its uses over 30 days, and every skill and workflow whose declared needs a loss removes | AC-06 |
| `POST /policies/{name}/save` | Save as a new version (`why?`); needs signing in again; `awaiting` when a second yes is on | AC-04 · AC-06 |
| `POST /policies/{name}/versions/{version}/approve` · `…/decline` | A second person's yes or no on an `awaiting` version; needs signing in again | AC-04 |
| `GET /policies/{name}/versions` | Every version: who saved it, who approved it, when, why, its rule count | AC-04 |
| `GET /policies/{name}/attachments` · `PUT /policies/{name}/attachments/{holder_kind}/{holder}` · `DELETE …` | Its holders · attach · take off; attaching and taking off need signing in again | AC-11 |
| `GET /catalogue` | The permission catalogue: each resource, its pattern, what each action means and its holders | AC-19 |
| `GET /built-in-agents` | Each built-in agent, what it acts for, its built-in ceiling and the custom policies attached to it | AC-20 |
| `GET /kept-from-agents` | Every Deny on `data/…` — a kind or one level of it — with its policy and holders, and every property at a sensitive level (from [SE-F03](../../../../capabilities/semantics/features/SE-F03-meaning/feature.md#engine)'s `GET /sensitivity`) | AC-27 |
| `GET /users/{username}/effective` | *What can {person} do?* — every permission they hold, each with the policy and the team it comes through, and each Deny that removes one | AC-08 |
| `POST /check` | *Can someone do this?* — a person, or an agent with a person, a project and a key · action · resource; every check of [the order](#the-order-of-checks) that applies, the first that refuses named. Writes nothing | AC-08 |

### Events

| Event | When |
|---|---|
| `access.policies.create` · `access.policies.update` · `access.policies.delete` · `access.policies.copy` | A policy is drafted · a draft changes · a policy is deleted · a policy is copied |
| `access.policies.save` | A version is saved — `why` in `details` |
| `access.policies.approve` · `access.policies.decline` | A second person approves or declines an `awaiting` version |
| `access.attachments.create` · `access.attachments.delete` | A policy is attached to a holder · taken off — the holder in `details` |
| `access.check.refused` | An act or a step is refused — the check of [the order](#the-order-of-checks) that refused, and for a rule its policy |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 422 | A rule outside the grammar — an unknown resource type, an action the resource does not take, an effect other than Allow · Ask · Deny | *Rule {n}: {why}.* | AC-04.3 |
| 422 | Ask on a policy held by a user or a team · a rule on a resource its holder may not hold | *Rule {n}: {holder} cannot hold {effect or resource}.* | AC-04.3 · AC-11.4 |
| 422 | A `*` inside a segment, or a `**` anywhere but the last segment of an `fs/` resource | *Rule {n}: `*` stands for a whole segment.* | AC-04.4 · AC-37.3 |
| 422 | A rule naming a graph database, kind, model, project, agent, skill, workflow, plugin or tool that does not exist | *Rule {n}: there is no {type} {name}.* | AC-04.5 |
| 409 | A policy name already used | *{name} is taken.* | AC-04.6 |
| 422 | Editing, renaming or deleting Super user or a built-in ceiling · taking a built-in ceiling off its agent | *{name} is built in — copy it to change it.* | AC-04.7 · AC-11.6 |
| 409 | Taking Super user off its last active holder, or deactivating them | *Super user always has a holder — give it to someone else first.* | AC-11.6 · AC-23.7 |
| 422 | The assistant's reply has a rule outside the grammar — nothing is saved | *The assistant proposed a rule Invana cannot read: {rule}.* | AC-06.2 |
| 403 | An act or a step the person's permissions do not allow | *This needs {action} on {resource} — ask {who can grant}.* | AC-07.3 |
| 403 | The person who saved a version approves it | *Someone else approves this change.* | AC-04.18 |
| 403 | A policy written, saved, approved, attached or taken off with a key | *This needs a person's session, not a key.* | AC-04.14 |
| 401 | Save, approve, attach or take off without signing in again | *Sign in again to change access.* | AC-04.13 |
| 403 | A run's step its project access or an agent's ceiling does not allow, or a Deny | *{agent} may not {action} {resource} — {rule} on {policy}, set by {person}.* | AC-08.3 · AC-27.2 · AC-37.5 |

### CLI

| Command | Does |
|---|---|
| `invana createsuperuser` | Makes the first account, holding Super user; refused once any person exists |
| `invana policy apply --file <yaml> [--why]` | Creates a custom policy or saves its next version, printing who it changes first; held to every refusal above; refused with a key |
| `invana policy list` · `invana policy show <name>` | Every policy with its origin, whether saved, its rules and its holders · one policy with its rules and versions |
| `invana policy attach <name> --user <u> \| --team <t> \| --project <p> \| --agent <a>` · `invana policy detach …` | Attach a policy · take it off |
| `invana access catalogue` | The permission catalogue |
| `invana access check --user <user> --action <action> --resource <type/name> [--agent <agent>] [--project <project>]` | *Can someone do this?*; writes nothing |

### Mechanisms

| Mechanism | How |
|---|---|
| A rule | `{effect: allow · ask · deny, action: read · create · edit · publish · run · manage, resource: "<type>/<segment>[/<segment>…]", set_by_id, set_at}` |
| The catalogue | `CATALOGUE` in code: each resource type, its segments, the actions it takes and its holders, as [the permission catalogue](#the-permission-catalogue) says; `GET /catalogue` reads it. Each route and each function declares the action and resource it needs; a route-table test proves none is missing |
| Resource grammar | Each segment is a name or `*`, and `*` matches exactly one segment; `fs/` alone takes `**` as its last segment. `fs/` paths are relative to the task's workspace on the worker; `cmd/` names a program, never its arguments; `net/` names a host; in `data/` the optional fourth segment is a level |
| A property read | Checked as `data/<graph database>/<kind>/<level>`, the level being `sensitivity.of(kind, property)` ([SE-F03 › Mechanisms](../../../../capabilities/semantics/features/SE-F03-meaning/feature.md#engine)). A property whose level may not be Read is dropped and counted as withheld; a kind that may not be Read at any level is refused, naming the rule |
| One evaluator | `decide(policies, action, resource)` collects the rules of the saved policies given whose resource matches and answers the strictest effect — Deny over Ask over Allow — or Deny when none matches. The person check calls it with every policy attached to the person and their teams; the run's reach with the project's access, then each agent's ceiling. *What can {person} do?*, *Can someone do this?*, *Who it changes*, a key's narrowing and a runtime's generated allow list ([CP-F03](../../../control/features/CP-F03-workers-and-the-queue/feature.md)) call it too |
| The order of checks | `check(person?, project?, chain, action, resource, run?)` runs [the order](#the-order-of-checks) and returns the first refusal, or allow or ask; the ledger row and the outbound check follow ([AC-F09](../AC-F09-what-left-the-platform/feature.md#engine)). Every route, step and tool call goes through it |
| Who can grant | A refusal names up to two active people who hold Manage on Access, by `GET /users?can=access:manage` ([AC-F03](../AC-F03-directory/feature.md#engine)) |
| Super user and the built-in ceilings | Written from code at start, owned by the system user. A start rewrites each to the code's rules; a person's change is a copy |
| Starter policies | Written at the first start only, `origin = starter`; never rewritten after. The deployment setting `access.newcomer_policies` names *Explore* until changed |
| `assistant` — the Assistant: asking, answering, boards; every new person's default agent | Allow Read `data/*/*` · `model/*` · `memory/project/*` · `memory/org` · `project/*` · Allow Run `skill/*` · `workflow/*` · `plugin/*` · Ask Edit `project/*` · Ask Run `agent/*` · `tool/*/*` |
| `query-console` — the Query console: the Console's queries | Allow Read `data/*/*` · Ask Create · Edit `data/*/*` · Allow Run `plugin/graph.read` · Ask Run `plugin/graph.write` |
| `modeller` — the Modeller agent: changes to the model and links between models | Allow Read `data/*/*` · Read · Edit `model/*` · Allow Run `plugin/model` · `plugin/graph.stitch` · `skill/*` |
| `coordinator` — the Coordinator: plans, workflows and handing work on | Allow Read `project/*` · `memory/project/*` · Ask Edit `project/*` · Allow Run `plugin/plan` · `plugin/work` · `workflow/*` · `skill/*` · `agent/*` |
| `record-editor` — the Record editor: a person's own edits on the board, fixes and merges | Allow Read · Create · Edit `data/*/*` · Allow Run `plugin/graph.write` |
| `loader` — the Loader: a person's own loads | Allow Read · Create · Edit `data/*/*` · Allow Run `plugin/data` |
| What a built-in ceiling cannot widen | A Create or Edit on `data/…` still needs a read + write graph database ([CP-F05](../../../control/features/CP-F05-graph-databases/feature.md#engine)); a plugin or graph database switched off refuses the step; the person's own permissions are checked first |
| Draft, then save | A draft decides nothing and may be attached before it is saved. Saving bumps `version`, writes `access_policy_versions` and takes effect on the next check — or, with a second yes on, sets `awaiting` and takes effect on the approval |
| Who it changes | Computed from the draft against the saved version: per holder — per person through each team — each action and resource gained or lost with its uses in History over 30 days, and every skill and workflow whose declared needs a loss removes |
| Draft with the assistant | One sentence; the deployment's AI model is asked once for rules; each is validated against the grammar and the draft is saved as `drafted_by = assistant`, or nothing is saved |
| Policies as files | YAML — `name` · `title` · `description` · `rules`. Applied through the same save as Studio's. A policy file in an import or a Team pack is written as `origin = imported`, `status = draft`, `drafted_by = file` |
| A second person's yes | The deployment setting `access.second_approval` (off by default). When on, a save writes the version as `awaiting` and puts an approval in the Inbox of every other person with Approve on Access ([AC-F05](../AC-F05-asks-and-approvals/feature.md#engine)); approve sets it `saved`, decline drops it; neither is the saver's |
| Studio's cache | On an attachment, a save or a deactivation, the engine sends each person it changes an `access.changed` event; Studio drops every cached read and reads again |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Three tables in Postgres | — |
| § 8 APIs and events | The routes and `access.policies.*` · `access.attachments.*` · `access.check.refused` events above | — |
| § 10 AI and agents | Drafting a policy asks the deployment's AI model once; nothing it proposes is saved unvalidated or decides anything | NFR-SEC-5 |
| § 12 Qualities | Security: one catalogue, one order of checks on every act, one evaluator, default deny, Deny wins, a key never changes access, a locked Super user with a holder always, an optional second yes | NFR-SEC-1 · NFR-SEC-4 · NFR-SEC-8 |

## Decisions

| Decision | Detail |
|---|---|
| Access Policies live in Access › What they may do | The Access summoner opens the large modal at Access; *Access Policies* sits beside *Permissions* and *Agents* in *What they may do*, the Directory in *Who*; a policy drills in and the crumb grows |
| A policy is built as a matrix | The editor is the permission matrix — resources down, actions across, each cell Allow · Deny · — and, for a project or an agent, Ask; a row narrows to a graph database, a kind, a model, an agent; *Rules* shows the same policy as sentences — *Allow reading Customer in every graph database* — with the exact form one click deeper |
| Policies, never roles | Access is one shape for every holder; the starter policies carry what roles carried, as data anyone with Edit on Access may change |
| Built-in agents are narrowed, never edited | A built-in ceiling stays attached to its built-in agent; it is narrowed by attaching a custom policy with a Deny |
| Everyone reads | Reading policies, rules, the catalogue and the built-in agents is never gated for a signed-in person: a person must see a rule to know whom to ask |
| *Can someone do this?* writes nothing | It runs the engine's own checks without running anything |
| Policies as files | `invana policy apply · list · show · attach · detach` read and write custom policies as files, held to every check Studio is |
| Memory is three places | `memory/project/<project>`, `memory/agent/<agent>` and `memory/org` name the three places memory lives ([GP-F02](../../../graph/features/GP-F02-memory/feature.md)); there is no team memory to name |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Roles · a role table | One shape — Access Policies — carries every grant; a fixed table could not fit each deployment |
| Policies on keys | A key acts as its owner, narrowed by its own allow list |
| Ask on a person's or a team's policy | Only a run waits for an approver; a person's own act is allowed or not |
| Conditions on a rule | Time windows, addresses, field lists and tags are unproven, and would make a rule unreadable |
| Per-property or per-record rules | A rule reaches a kind in a graph database, or a kind's properties at one level; a level is a property's, set in Meaning |
| `*` inside a segment | Partial matches make a rule's reach unreadable |
| Editing Super user or a built-in ceiling | They are the system user's; a copy carries every change |
| Roles inside a project | Every person on a project's team may do everything inside it; project access bounds its runs ([PJ-F01](../../../../capabilities/projects/features/PJ-F01-projects-and-tasks/feature.md#rules)) |
| A person's policies inside a project | A project's reach would change with every join and leave; project access holds it steady |
| A page of requests | An ask for a permission is an ask in the Inbox (AC-F05) |
