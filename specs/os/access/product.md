---
id: AC
title: Access Plane
status: idea
owner: Ravi
personas: [admin, analyst, builder, modeller, decision-maker]
---

# Access Plane

> Who may act, through which agent, and what did they do: sign-in with a password or the company's SSO and a second
> factor, sessions, keys and connected MCP clients; Access Policies — Allow · Ask · Deny on Read · Write · Run — held
> by agents alone, and the one role table; the Directory of users and teams and the agents granted to them; ownership;
> asks and approvals; access reviews; and History.
> The decision it helps make: *which agent may do what — the same for everyone who may use it — and should this go?*

## Problem

An agent that reads, writes and runs for people is only trusted when a person can read, as plain rules, what it may
touch, knows it does the same for everyone who may use it, can see who decides when it must ask, and can audit
afterwards what it did. Without that, a deployment is either open to every agent or closed to the people who need them.

## Users

| Persona | Comes here to |
|---|---|
| Admin | Add people and teams, set each person's role, grant agents to people and teams, write Access Policies and attach them to agents, review each agent's access every quarter, read who did what; deactivate a person who leaves and name their successor; set how long each store is kept, hold it, forget a subject and export what is held about a person |
| Analyst · Decision maker | Sign in; keep their own account, sessions, keys and connected clients; see which agents they are granted and which is their default; answer the asks they are named for |
| Agent builder | See what an agent may touch and why; name who answers its asks; make a personal agent |
| Modeller | Read the policies that keep a kind or a sensitive property from agents |

## Goals

| Goal | Measured by |
|---|---|
| Every refusal names the check that refused — the role, the rule and its policy, the switch, the ceiling or the limit | Open — set at the spec review |
| No ask waits unseen; unanswered, it expires refused, never allowed | Open — set at the spec review |
| Every act by a person or an agent is in History, append-only and provably unedited | Open — set at the spec review |
| Every agent's access is signed off every quarter | Open — set at the spec review |
| No work waits on a person who left | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| AC-F01 | [Sign in, account and sessions](features/AC-F01-sign-in-account-and-sessions/feature.md) | AC-01 · AC-40 · AC-34 · AC-02 · AC-18 | idea |
| AC-F02 | [Access Policies](features/AC-F02-access-policies/feature.md) | AC-03 · AC-04 · AC-37 · AC-06 · AC-07 · AC-08 · AC-11 · AC-19 · AC-20 · AC-27 | idea |
| AC-F03 | [Directory](features/AC-F03-directory/feature.md) | AC-22 · AC-33 · AC-09 · AC-39 · AC-38 · AC-23 | idea |
| AC-F04 | [What an agent may touch](features/AC-F04-what-an-agent-may-touch/feature.md) | AC-12 · AC-13 · AC-14 | idea |
| AC-F05 | [Asks and approvals](features/AC-F05-asks-and-approvals/feature.md) | AC-15 · AC-26 · AC-32 | idea |
| AC-F06 | [History — what people and agents did, and every change](features/AC-F06-history/feature.md) | AC-16 · AC-17 | idea |
| AC-F07 | [Ownership](features/AC-F07-ownership/feature.md) | AC-24 · AC-25 · AC-43 | idea |
| AC-F08 | [Access usage and reviews](features/AC-F08-access-usage/feature.md) | AC-28 · AC-29 · AC-41 | idea |
| AC-F09 | [What left the platform](features/AC-F09-what-left-the-platform/feature.md) | AC-30 · AC-31 | idea |
| AC-F10 | [Keys](features/AC-F10-keys/feature.md) | AC-10 | idea |
| AC-F11 | [Connect an MCP client](features/AC-F11-connect-an-mcp-client/feature.md) | AC-35 · AC-36 | idea |
| AC-F12 | [Leaving and keeping](features/AC-F12-leaving-and-keeping/feature.md) | AC-44 · AC-45 · AC-46 · AC-47 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Sign in — a password, or the company's SSO, then a second factor | page | `access.signin` |
| Sign in again — the password or the SSO for a risky act | modal | `access.sign_in_again` |
| Connect an MCP client — consent | page | `access.consent` |
| Access Policies | sheet | `settings.access` |
| Roles — what each role may do | sheet | `settings.roles` |
| Directory — users, service users, teams, the agents granted to each, every key and connected client | sheet | `settings.people` |
| Owners of what a person owns | modal | `access.owners` |
| You — profile, default agent, sessions, keys, connected clients | modal | `settings.me` |
| An ask in Needs you | modal | `inbox` |
| Access usage — what each agent touched, access never used, the quarterly access review | sheet | `access.usage` |
| What left the platform — the ledger | sheet | `access.ledger` |
| History | modal | `inbox.history` |
| Leaving and keeping — retention per store, legal holds, a departed person's name, subjects forgotten | sheet | `settings.keeping` |
| Forget a subject | modal | `access.forget` |
| Export everything held about a person | modal | `access.subject_export` |
| No access | every surface | `access.locked` — the act names the check that refused it: the role it needs, the rule and its policy, or the approver who decides |

## Rules

| Rule | Detail |
|---|---|
| Every write is in History | Every change to a policy, a role, a team, a grant, a default agent, an owner, an approver, a user, a graph database, the model, a skill, an agent, a workflow or a load is a History row; the person, the agent it ran through and what caused it are kept apart |
| One record, many readings | History, a run's history, access usage and what left the platform read the same records; none copies them |
| Nothing leaves without a person | An outward send waits for a named approver's yes unless a rule allows it; an ask is never decided by itself |
| Numbers come from the record | What is used, refused and spent is counted by the engine from stored runs, the ledger and History, never from a second pipeline |

## Decisions

| Decision | Detail |
|---|---|
| The agent is the only holder of reach | Only an agent holds reach — to data, memory, projects, skills, workflows, agents, plugins, tools, files, commands and the network — through the Access Policies attached to it. The same agent does the same thing for everyone who may use it |
| People pick agents, not permissions | A person holds one role, the agents granted to them, one default agent and their own personal connections. An Admin grants agents to people and to teams; every Studio screen reads through the person's default agent ([AC-F03](features/AC-F03-directory/feature.md)) |
| The role decides who may start an act | The person's role holds the feature, by the one role table ([AC-F02](features/AC-F02-access-policies/feature.md#the-role-table)) — whether they may start the act, never what the agent reaches. The agent's Access Policies decide the reach, with no term for the person or their teams. Neither widens the other; every check and its order is [AC-F02 › The order of checks](features/AC-F02-access-policies/feature.md#the-order-of-checks) |
| One role each, fixed | **Operator** · **Modeller** · **Admin**; each holds what the one before holds. The table is the engine's and no one edits it; there are no custom roles. Building agents is a Modeller's or an Admin's act |
| A rule is effect · verb · resource | Allow · Ask · Deny × Read · Write · Run × `type/name`, where `*` stands for one whole segment. A rule has no condition |
| Default deny · the strictest wins | What no rule reaches is denied. Where rules disagree — across policies or along a caller chain — Deny over Ask over Allow |
| Declare, never grant | Skills, workflows, plugins, Team packs and runtimes declare what they need; only an Access Policy grants it |
| Ceilings only narrow | A key, a run's scope, a credential's scope, a graph database's mode and the worker sandbox narrow what an agent's policies allow; none widens it ([AC-F04](features/AC-F04-what-an-agent-may-touch/feature.md)) |
| Policies attach to agents | Never to a person or a team. A team receives grants of agents; it holds no rule and narrows none |
| Teams are flat and own nothing | A team is a list of people; no team holds another, and a team owns no resource |
| Only a person sets an effect | An agent may propose a rule — tighter or looser — and a person saves it or not; no agent saves a rule |
| Only Admins change access | Writing and attaching Access Policies, applying a policy file from an import or a Team pack, setting a person's role, making teams and granting agents are Admin acts. Every signed-in person reads every policy, rule, team and role: a person must see a rule to know whom to ask |
| A second Admin's yes, when set | A deployment setting, off by default: when on, a change to an Access Policy or a work connection waits for a second Admin's yes ([AC-F02](features/AC-F02-access-policies/feature.md#rules)) |
| There are always two Admins | A role change or a deactivation that would leave fewer than two active Admins is refused ([AC-F03](features/AC-F03-directory/feature.md)) |
| A leaver names a successor | Deactivating a person names a successor, who takes every place they held on the work; their personal-connection data is erased and their name kept or pseudonymised, by one deployment setting ([AC-F03](features/AC-F03-directory/feature.md) · [AC-F12](features/AC-F12-leaving-and-keeping/feature.md)) |
| Kept until an Admin says otherwise | Memory, History, the ledger, the query log and recall each keep everything until an Admin sets a period; a legal hold on memory or History stops retention and erasure; a subject is forgotten through lineage; History is never edited ([AC-F12](features/AC-F12-leaving-and-keeping/feature.md)) |
| The organisation owns the work | The platform — the system user — owns built-in and shared agents, keeping who made each; a personal agent is its person's; an agent retires, never deletes. Every place a person sits on work is a slot with a fallback ([AC-F07](features/AC-F07-ownership/feature.md)) |
| Built-ins are the system user's | What Invana ships — built-in agents, built-in policies, built-in workflows, default skills — is owned by the system user, copied to change, never edited |
| Named approvers decide asks | Each agent names the people or teams who answer its asks; with none who can answer, Admins, with a *no approver* alert. An ask is never decided by the person it benefits, and its yes covers this step of this run ([AC-F05](features/AC-F05-asks-and-approvals/feature.md)) |
| Managing access needs a session | A key or a connected client never changes a policy, a role, a team, a grant, an approver, a key or a credential; a person signs in again — the password or the SSO, and the second factor — for each ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Software acts as a person, never more | A key acts as its owner, narrowed by the key ([AC-F10](features/AC-F10-keys/feature.md)); a connected MCP client acts through the default agent of the person who consented, narrowed like a key ([AC-F11](features/AC-F11-connect-an-mcp-client/feature.md)) |
| Access is reviewed | Every quarter an Admin reviews each agent's Access Policies, grants and connections and signs it off; the sign-off is recorded ([AC-F08](features/AC-F08-access-usage/feature.md)) |
| Run content is private | A run's content — what it read, sent and answered — reads to the person behind it and Admins; anyone else reads that it ran, its status and its tokens ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every call is ledgered | Every call to an AI model, a tool or a graph database is a ledger row, schema-only or data-bearing, written before its result is used; a sensitive property never reaches an external model ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every act names its rule | A result, an ask or a refusal shows in *How it got here* the rule that applied to each step, its policy, its version and who set it, as they were when the step ran |
| Checked when the step runs | Each step is checked against the policies and roles in force when it runs, not when its run opened |

## Depends on

| Product or capability | For |
|---|---|
| Control Plane | The graph databases, plugins, tools and AI models a rule names; the Inbox where asks wait; limits; the worker sandbox that enforces `fs/` · `cmd/` · `net/` |
| Graph Plane | The project memory, agent learnings and org knowledge a `memory/` rule names |
| Agents | The agents policies attach to, the built-in agents, personal agents, the runs asks are raised from |
| Projects | The projects a `project/` rule names, and a run's project for its run scope |
| Ontology | The kinds a rule on `data/…` names and the sensitive properties that never reach an external model |

## Not building

| Item | Why not |
|---|---|
| Per-record or per-property rules | A rule reaches a kind in a graph database; a property is kept from outside models by marking it sensitive |
| Custom roles | One fixed table keeps every screen's access readable |
| Policies on people or teams | Every reach is an agent's; a team receives grants of agents and holds no rule |
| Conditions on a rule | A rule holds the same for everyone who may use the agent; time windows, addresses, teams and tags are unproven |
| Nested teams · teams that own | A flat list of people carries every team we know of |
| Invitations | An Admin makes the account directly, or the first SSO sign-in does |
| SCIM provisioning | An Admin makes the account, or the first SSO sign-in does ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Workspaces, tenants or a unit inside the deployment | One deployment is everything; multi-tenancy is out of scope |
| Editing History | History is append-only |
| A second pipeline for numbers | It would drift from the record it describes |
