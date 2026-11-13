---
id: AC-F03
title: Directory
product: AC
status: idea
personas: [admin, analyst, builder]
stories: [AC-22, AC-33, AC-09, AC-39, AC-38, AC-23]
journeys: [J05, J07, J12]
boards: [settings.people, settings.access, access.sign_in_again, access.locked]
nfrs: [NFR-SEC-1, NFR-SEC-2]
depends_on: [AC-F01, AC-F02, AC-F05, AC-F06, AC-F07]
---

# Directory

> Every user of the deployment — people, agents, service users and the system user — each person's one role, the flat
> teams people are on, the agents granted to each person and team with a preview of who gains or loses them, each
> person's one default agent, and deactivating a person who leaves, naming the successor who takes every place they held.
> The decision it helps make: *who is in this deployment, with which role, on which teams — and which agents may they
> use?*

## User journey

Journeys this feature is a step of: [J05 · Join a team](../../../../journeys/J05-join-a-team.md) ·
[J12 · A person leaves and the team keeps working](../../../../journeys/J12-a-person-leaves-and-the-team-keeps-working.md) ·
[J07 · Ready a deployment](../../../../journeys/J07-ready-a-deployment.md)

```mermaid
flowchart TD
  start([Settings › People and access › Users]) --> users["AC-22 · Every user: kind · role · teams · agents granted · default agent"]
  users --> who{"Is the reader an Admin?"}
  who -->|no| ro["Everything reads · each write names the Admin role and the Admins"]
  who -->|yes| role["AC-22 · Set a person's role"]
  role -->|fewer than two Admins left| last["Refused · there are always two Admins"]
  role --> saved(["From their next step · History"])
  users --> grant["AC-22 · Grant an agent to a person · or take it away"]
  start --> teams["AC-09 · Teams: make one · put people on it"]
  teams --> tgrant["AC-39 · Grant agents to a team"]
  grant --> prev{"AC-39 · Preview: which agents each person gains or loses"}
  tgrant --> prev
  teams -->|add or take off a person| prev
  prev -->|someone would lose their default agent| dflt["Names them · their default falls back to the Assistant"]
  dflt --> saved
  prev -->|confirm| saved
  prev -->|cancel| users
  users --> def["AC-38 · Choose a person's default agent"]
  def -->|not granted to them| defr["Refused · names the agent"]
  def --> saved
  teams -->|delete a team an agent's approvers name| held["Refused · names the agents"]
  users -->|a person leaves| deact["AC-23 · Deactivate"]
  deact --> succ["Name a successor · tasks to them or back to Open"]
  succ --> off(["Deactivated · sessions end · keys revoked · every slot falls back · AC-F07"])
  off --> keep(["Personal-connection data erased · name kept or pseudonymised · AC-F12"])
  off --> adopt(["The successor may adopt their personal agents · AC-43"])
  deact -->|one of two Admins · themselves| refd["Refused · names why"]
  users --> svc["AC-33 · New service user: role · owners"]
  svc -->|no active person to own it · Admin role| svr["Refused · names why"]
  svc --> saved
  svc --> keys(["Its owners mint its keys · AC-F10"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-22 | [See every user and set a person's role](stories/AC-22-see-every-user-and-set-a-persons-role/story.md) | idea |
| AC-33 | [Make a service user for automation](stories/AC-33-make-a-service-user-for-automation/story.md) | idea |
| AC-09 | [Make teams and put people on them](stories/AC-09-make-teams-and-put-people-on-them/story.md) | idea |
| AC-39 | [Grant agents to a team and see who gains them](stories/AC-39-grant-agents-to-a-team-and-see-who-gains-them/story.md) | idea |
| AC-38 | [Choose a person's default agent](stories/AC-38-choose-a-persons-default-agent/story.md) | idea |
| AC-23 | [Deactivate a person who leaves](stories/AC-23-deactivate-a-person-who-leaves/story.md) | idea |

## Access

| Act | Role ([the role table](../AC-F02-access-policies/feature.md#the-role-table)) | Everyone else sees |
|---|---|---|
| Read every user, their kind, role, teams, the agents granted to them and their default agent · every team, its people and its agents | Every signed-in person — Operator, Modeller, Admin | — |
| Set a person's role · grant an agent to a person or a team, or take it away · set a person's default agent | Admin, in a session, signing in again | Disabled — *Needs the Admin role — ask Priya or Lee* |
| New team · rename · describe · delete · add or remove a person | Admin, in a session | As above |
| Deactivate · reactivate a person or a service user, naming the successor | Admin, in a session, signing in again | As above |
| Make a service user | Admin, in a session, signing in again | As above |
| Mint and revoke a service user's keys · add its co-owners | Its owners ([AC-F10](../AC-F10-keys/feature.md) · [AC-F07](../AC-F07-ownership/feature.md)) | — |

## States

| State | What the person sees |
|---|---|
| First use | Users: the first Admin, the system user and the built-in agents. Teams: *No teams yet — grant a whole team its agents at once* with *New team* |
| Empty after a filter | *Nothing matches*, with the filter named and *Clear filters* |
| Loading | The sheet opens at once; lists show loading rows; counts read `—` until the engine gives them |
| Has data | Users one row each, by kind; teams one row each; the selected one beside them |
| Failed | What could not load or save, in a sentence, with *Try again*; a refused save says why in place, naming the person, the team or the agent |
| Agent working or proposing | — no agent changes the Directory; a grant's preview shows who gains or loses each agent before it is saved |
| No access | Everything reads; each write is disabled, naming the Admin role and the Admins |

## Rules

| Rule | Detail |
|---|---|
| Four kinds of user | **Person** — signs in, holds one role · **Agent** — acts only through the Access Policies attached to it, holds no role · **Service user** — a user for automation, owned by people, never signs in, acts only through keys ([AC-F10](../AC-F10-keys/feature.md)), Operator or Modeller · **System** — the one system user, owns what Invana ships, never signs in, holds no role |
| One role each | A person and a service user hold exactly one role — Operator · Modeller · Admin — read against [the role table](../AC-F02-access-policies/feature.md#the-role-table). A new person or service user is an Operator unless the Admin who makes them says otherwise; a service user is never an Admin |
| A service user is owned, and owns nothing | At least one active person owns it ([AC-F07](../AC-F07-ownership/feature.md)); its owners mint its keys. What a run it is behind makes is the organisation's, made by the service user |
| People pick agents, not permissions | An Admin grants agents to people and to teams; a person may use the agents granted to them and to every team they are on, and nothing else. What an agent may touch is only its Access Policies'; a grant gives the agent, never more reach ([AC-F02](../AC-F02-access-policies/feature.md#rules)). A built-in agent starts granted to every person whose role holds the feature it acts for ([AC-F02](../AC-F02-access-policies/feature.md#decisions)) |
| A grant shows who it changes | Granting or taking away an agent, and adding a person to a team or taking one off, previews which agents each person gains or loses before it is saved ([AC-39](stories/AC-39-grant-agents-to-a-team-and-see-who-gains-them/story.md)) |
| One default agent each | Each person has one default agent, granted to them; every Studio screen reads through it ([AC-F02](../AC-F02-access-policies/feature.md#rules)). A new person's default is the built-in Assistant; an Admin may set another ([AC-38](stories/AC-38-choose-a-persons-default-agent/story.md)). A person who loses the grant of their default agent falls back to the Assistant |
| Teams are flat and own nothing | A team is a list of people and service users. No team is on another team; a team owns no resource, holds no rule and is never an agent's caller. A team receives grants of agents and may be an agent's named approvers ([AC-26](../AC-F05-asks-and-approvals/stories/AC-26-name-who-answers-an-agents-asks/story.md)) |
| There are always two Admins | A role change or a deactivation that would leave fewer than two active Admins is refused; a deployment with one Admin is told to name a second |
| Deactivating names a successor | A deactivated user signs in to nothing, their sessions end and their keys are revoked; their work, authorship and History stay. The Admin names a successor — an active person — who takes every place the leaver held, by [AC-F07 › Slots and fallbacks](../AC-F07-ownership/feature.md#slots-and-fallbacks); their schedules and pick-up keep running as their agent; their personal-connection data is erased and their name kept or pseudonymised ([AC-F12](../AC-F12-leaving-and-keeping/feature.md)) |
| Changes take effect at the next step | A role, a team, a grant, a default agent or a deactivation is read at each step's check, so a run already going meets it at its next step |
| A revoke clears what Studio holds | When a grant is taken away, a role changes or a person is deactivated, the engine tells Studio to clear its cache of what that person read; nothing read through a lost agent stays on their screen |
| Leans on | Accounts and sign-in (AC-F01) · keys (AC-F10) · Access Policies and the role table (AC-F02) · named approvers (AC-F05) · History (AC-F06) · Ownership (AC-F07) · agents (AG-F01) · schedules (AG-F07) |

## Data touched

| Record | Read or write |
|---|---|
| Users — kind, role, active or deactivated, who deactivated them, when and their successor | Write · read |
| Teams and the people on them | Write · read |
| Grants — which agents each person and each team is granted | Write · read |
| Each person's default agent | Write · read |
| Owners of what a leaver owns, their chats and their slots (AC-F07) | Write, through the successor |
| Owners of a service user (AC-F07) | Write, when it is made |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `access_users` — the Directory's columns | `kind` (`person` · `agent` · `service` · `system`) · `role?` (`operator` · `modeller` · `admin`; `operator` · `modeller` for a service user; none for an agent and the system user) · `agent_id?` (an agent user's agent) · `default_agent_id?` (a person's or a service user's; the built-in Assistant when none is set) · `description?` (a service user's) · `is_active` · `deactivated_at?` · `deactivated_by_id?` · `successor_id?` (a person) | The account and sign-in columns are [AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md#engine)'s; only a person has an email and a password. One `system` row, written at start |
| `access_teams` | `name` (`[a-z0-9-]`, unique) · `title` · `description` · `created_by_id` · `created_at` · `updated_at` | No team holds another |
| `access_team_members` | `team_id` · `user_id` (a person or a service user) · `added_by_id` · `added_at` | Unique (`team_id`, `user_id`) |
| `access_agent_grants` | `agent_id` · `grantee_kind` (`user` · `team`) · `grantee_id` · `origin` (`role` · `admin`) · `granted_by_id?` · `granted_at` | Unique (`agent_id`, `grantee_kind`, `grantee_id`). `origin = role` for a built-in agent's starting grant |

### Reads

| Record | Owner |
|---|---|
| Accounts, passwords, sessions and signing in again | [AC-F01](../AC-F01-sign-in-account-and-sessions/feature.md#engine) |
| Keys — a service user's only credential | [AC-F10](../AC-F10-keys/feature.md#engine) |
| The role table, Access Policies, the order of checks and the one evaluator | [AC-F02](../AC-F02-access-policies/feature.md#engine) |
| Named approvers that name a team or a person | [AC-F05](../AC-F05-asks-and-approvals/feature.md#engine) |
| History — every event this feature writes | [AC-F06](../AC-F06-history/feature.md#engine) |
| Owners — what a user owns, alone or with others, and hand-over | [AC-F07](../AC-F07-ownership/feature.md#engine) |
| Agents and the built-in agents | [AG-F01](../../../../capabilities/agents/features/AG-F01-build-an-agent/feature.md#engine) |
| Schedules and pick-up a deactivated person set — the setter kept | [AG-F07](../../../../capabilities/agents/features/AG-F07-schedules/feature.md#engine) |
| Retention, holds, the names setting and a departure's erasure | [AC-F12](../AC-F12-leaving-and-keeping/feature.md#engine) |

### Routes

| Route, after `/api/v1/access` | Does | Story |
|---|---|---|
| `GET /users` | Every user by the list contract (`?kind=` · `?role=` · `?team=` · `?active=` · `?q=` on name, username or email): `username` · `name` · `kind` · `role?` · `teams[]` · `agents_count` · `default_agent` · `is_active` · `last_signed_in_at?`; the tab counts are the engine's | AC-22 |
| `POST /service-users` | Make a service user `{username, name, description?, role?, owners[], password}` — `role` is `operator` unless `modeller` | AC-33 |
| `GET /users/{username}` · `PATCH /users/{username}` | One user with their teams, the agents granted to them and how (`direct` · a team · `role`), their default agent, and what they own (AC-F07) · set `role` or `default_agent`; needs signing in again | AC-22 · AC-38 |
| `GET /users/{username}/departure` · `POST /users/{username}/deactivate` · `POST /users/{username}/reactivate` | What deactivating them does — their slots, service users, personal agents, chats, keys, personal connections and copies to erase, counted · deactivate `{successor, tasks: successor \| open}`; needs signing in again · reactivate — a pseudonymised person `{name, email}` | AC-23 · AC-45 |
| `GET /teams` · `POST /teams` | Teams: `name` · `title` · `people_count` · `agents_count` · make one | AC-09 |
| `GET /teams/{name}` · `PATCH /teams/{name}` · `DELETE /teams/{name}` | One team with `members[]`, the agents granted to it and the agents it approves for · rename or describe · delete one no approver names | AC-09 |
| `POST /teams/{name}/members` · `DELETE /teams/{name}/members/{username}` | Put a person or a service user on it · take one off; each returns the preview first unless `confirm` | AC-09 · AC-39 |
| `GET /grants` · `POST /grants` · `DELETE /grants/{id}` | Grants by the list contract (`?agent=` · `?user=` · `?team=`) · grant an agent `{agent, user? \| team?}` · take it away; writes need signing in again | AC-22 · AC-39 |
| `POST /grants/preview` | For a grant, a take-away, or a person added to or taken off a team: per person, each agent gained or lost, and whose default agent falls back. Writes nothing | AC-39 |

### Events

| Event | When |
|---|---|
| `access.users.create` | A service user is made — its role and owners in `details` |
| `access.users.role` | A person's or a service user's role changes — `{from, to}` in `details` |
| `access.users.deactivate` · `access.users.reactivate` | A user is deactivated — the successor and what went where in `details` · reactivated |
| `access.teams.create` · `access.teams.update` · `access.teams.delete` | A team is made · changed · deleted |
| `access.teams.members.add` · `access.teams.members.remove` | A person joins · leaves a team |
| `access.grants.create` · `access.grants.delete` | An agent is granted to a person or a team · taken away — the people who gained or lost it in `details` |
| `access.users.default_agent` | A person's default agent changes — `{from, to, why}` in `details`; `why` is `admin` or `grant_lost` |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 409 | A role change or a deactivation that leaves fewer than two active Admins | *There are always two Admins — make another first.* | AC-22.5 · AC-23.7 |
| 422 | A role set on an agent or the system user | *{user} holds no role — {kind}.* | AC-22.3 |
| 422 | The Admin role on a service user | *A service user is an Operator or a Modeller.* | AC-33.2 |
| 422 | A service user with no owner, or an owner who is not an active person | *A service user needs at least one active person to own it.* | AC-33.3 |
| 409 | A username already used | *{username} is taken.* | AC-33.12 |
| 409 | A team name already used | *{name} is taken.* | AC-09.3 |
| 422 | Putting an agent, the system user or a team on a team | *Only people and service users join a team.* | AC-09.5 |
| 409 | Deleting a team an agent's approvers name | *{team} answers asks for {agents} — change them first.* | AC-09.9 |
| 422 | A default agent not granted to the person | *{agent} is not granted to {person} — grant it first.* | AC-38.3 |
| 422 | Deactivating oneself | *Ask another Admin to deactivate you.* | AC-23.8 |
| 422 | Deactivating the system user or an agent | *{user} cannot be deactivated — {why}.* | AC-23.9 |
| 422 | Deactivating with no successor, or one who is not an active person | *Name an active person to take over from {person}.* | AC-23.3 |
| 401 | A deactivated user signs in, or one of their keys calls | *This account is deactivated.* | AC-23.4 |
| 403 | A write by someone whose role is not Admin | [AC-F02 › Refusals](../AC-F02-access-policies/feature.md#refusals) | AC-22.10 · AC-09.11 · AC-33.10 |
| 403 | A Directory write with a key | [AC-F02 › Refusals](../AC-F02-access-policies/feature.md#refusals) | AC-22.11 · AC-33.11 |

### CLI

| Command | Does |
|---|---|
| `invana users list` · `invana users role <username> <role>` | Every user · set a person's or a service user's role; refused with a key |
| `invana users create-service <username> --name --owner <username>… [--role modeller]` | Makes a service user, as `POST /service-users` |
| `invana users deactivate <username> --successor <username> [--tasks open]` | Deactivates, as `POST /users/{username}/deactivate`, printing what goes where first |
| `invana teams list` · `invana teams add <team> <username>` · `invana teams remove <team> <username>` | Teams and their people; a change prints its preview first |
| `invana grants add <agent> --user <username> \| --team <team>` · `invana grants remove <id>` | Grant an agent or take it away, printing the preview first |

### Mechanisms

| Mechanism | How |
|---|---|
| The system user | One `access_users` row, `kind = system`, no password, written at start; it owns the built-in agents, policies, workflows and skills ([AC-F07](../AC-F07-ownership/feature.md#engine)) |
| A service user | An `access_users` row of `kind = service`, no email, no password; its owners are `access_owners` rows of `resource_type = service_user` written in the same transaction ([AC-F07](../AC-F07-ownership/feature.md#engine)). Its keys are its only credential ([AC-F10](../AC-F10-keys/feature.md#engine)); a sign-in as it is refused like a wrong password |
| An agent is a user | Each agent has an `access_users` row of `kind = agent` linked by `agent_id`, so History and ownership name it as one user; it holds no role and never signs in |
| May a person use an agent | At each step, the first check of [the order](../AC-F02-access-policies/feature.md#the-order-of-checks): an `access_agent_grants` row for the person or a team they are on, and the person active — or the agent is in the run's delegation chain. A refusal names the agent and the Admins ([AC-F02 › Refusals](../AC-F02-access-policies/feature.md#refusals)) |
| The preview | `preview(change)` lists, for every person the change reaches, the agents granted before and after; a person who still has the agent through another grant gains or loses nothing. A person whose default agent is lost falls back to the built-in Assistant, named in the preview |
| Clearing Studio's cache | On a take-away, a role change, a default agent change or a deactivation, the engine sends the person's open Studio sessions an `access.changed` event; Studio drops every cached read and reads again through the agents the person holds now |
| Built-in starting grants | At start, each built-in agent is granted with `origin = role` to every person whose role holds its feature; a role change adds the grant of a feature the new role holds. An Admin's take-away stays taken away |
| Deactivating | In one transaction: `is_active` false, `successor_id` set; every session ends; every key they minted is revoked ([AC-F10](../AC-F10-keys/feature.md#engine)); the successor takes their service users, their chats outside projects and — as chosen — their tasks, and each slot falls back ([AC-F07 › Succession](../AC-F07-ownership/feature.md#mechanisms)); their personal agents retire; the departure's erasure runs ([AC-F12 › Departure](../AC-F12-leaving-and-keeping/feature.md#mechanisms)); asks they raised close expired; their schedules and pick-up keep running as their agent with the setter recorded ([AG-F07](../../../../capabilities/agents/features/AG-F07-schedules/feature.md#engine)); their team places and grants stay, counting for nothing. A refusal changes nothing |
| Reactivating | `is_active` true; nothing handed on comes back and erased data stays erased; a pseudonymised person is given a name and an email again |
| Two Admins | Every role change and deactivation counts the active Admins it would leave and refuses below two; `GET /users` returns `admins_short` while fewer than two are active, for the warning |
| Team places and grants read at the check | The first check of the order reads them at each step, never copied; the rules never read them ([AC-F02 › One evaluator](../AC-F02-access-policies/feature.md#mechanisms)) |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Three tables and the Directory's columns on `access_users` in Postgres | — |
| § 8 APIs and events | The users, teams and grants routes and `access.users.*` · `access.teams.*` · `access.grants.*` events above | — |
| § 12 Qualities | Security: one role each, read at every step; grants previewed before saved; a deactivated user's sessions and keys stop at once; Studio's cache cleared on a revoke or a role change; there are always two Admins | NFR-SEC-1 · NFR-SEC-2 |

## Decisions

| Decision | Detail |
|---|---|
| The Directory is tabs of one sheet | *Settings › People and access* — *Users* and *Teams* beside *Access Policies* and *Roles*; a user or a team drills in and the crumb grows |
| Deactivate, never delete | A person who leaves is deactivated, so their work, authorship and History keep a name |
| The successor is part of deactivating | The Admin names the successor in the same act; one person takes every place the leaver held, so nothing is left to chase afterwards |
| Two Admins, never one | An Admin who is away or leaves never locks the deployment; a fresh deployment with one Admin is told to name a second |
| Agents appear as users | One list answers "who acts here"; an agent's row opens its sheet, where its policies are |
| An Admin sets the default agent | A person reads their default agent in *You*; an Admin sets it in the Directory, so what every screen reads through stays an Admin's choice |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Nested teams · teams that own | A flat list of people carries every team we know of |
| Invitations | An Admin makes the account directly ([AC-18](../AC-F01-sign-in-account-and-sessions/stories/AC-18-give-a-person-an-account/story.md)) |
| Deleting a user | Work and History must keep a name; deactivating is enough |
| Several roles per person | One fixed role reads plainly on every screen |
| A team lead role | Teams own nothing and decide nothing on their own; a team may be named as an agent's approvers |
| Rules held by a team · narrowing by a person's teams | The same agent does the same thing for everyone who may use it; a team that needs other reach is granted another agent |
