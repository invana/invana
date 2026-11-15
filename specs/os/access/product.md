---
id: AC
title: Access Plane
status: idea
owner: Ravi
personas: [admin, analyst, builder, modeller, decision-maker]
---

# Access Plane

> Who may do what, and what did they do: sign-in with a password or the company's SSO and a second factor, sessions,
> keys and connected MCP clients; Access Policies built from one permission catalogue and attached to people, teams,
> projects and — as ceilings — agents; the Directory of users and teams; ownership; asks and approvals; access reviews;
> and History.
> The decision it helps make: *who may do what, what may each agent ever do — and should this go?*

## Problem

An agent that reads, writes and runs for people is only trusted when a person can read, as plain rules, what it may
touch, knows it never does more for a person than that person may, can see who decides when it must ask, and can audit
afterwards what it did. Without that, a deployment is either open to every agent or closed to the people who need them.

## Users

| Persona | Comes here to |
|---|---|
| Admin — holds Manage on Access | Add people and teams, write Access Policies and attach them to people, teams, projects and agents, see what each person can do and why, review each agent's access every quarter, read who did what; deactivate a person who leaves and name their successor; set how long each store is kept, hold it, forget a subject and export what is held about a person |
| Analyst · Decision maker | Sign in; keep their own account, sessions, keys and connected clients; see what they may do and the policy behind each permission, and their default agent; answer the asks they are named for |
| Agent builder | See what an agent may touch and why; name who answers its asks; make a personal agent |
| Modeller | Read the policies that keep a kind or a sensitive property from agents |

## Goals

| Goal | Measured by |
|---|---|
| Every refusal names the check that refused — the permission and who can grant it, the rule and its policy, the switch, the ceiling or the limit | Open — set at the spec review |
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
| Sign in again — the password or the SSO for a risky act | modal | `access.signin · Sign in again` |
| Connect an MCP client — consent | page | `access.consent` |
| Access Policies | modal | `settings.policies` |
| Permissions — the permission catalogue | modal | `settings.roles` |
| Directory — users, teams, the policies attached to each, every key and connected client | modal | `settings.people` |
| Owners of what a person owns | modal | `settings.me · Owners` |
| You — profile, default agent, sessions, keys, connected clients | modal | `settings.me` |
| An ask in Needs you | modal | `inbox` |
| Access usage — what each agent touched, access never used, the quarterly access review | modal | `access.usage` |
| What left the platform — the ledger | modal | `access.ledger` |
| History | modal | `settings.history` |
| Leaving and keeping — retention per store, legal holds, a departed person's name, subjects forgotten | modal | `settings.keeping` |
| Forget a subject | modal | `settings.keeping · Forget` |
| Export everything held about a person | modal | `settings.people · Export their data` |
| No access | every surface | The Operator lens of each board, `<board> · Locked` — the act names the check that refused it: the permission it needs and who can grant it, the rule and its policy, or the approver who decides |

## Rules

| Rule | Detail |
|---|---|
| Every write is in History | Every change to a policy, an attachment, a team, a default agent, an owner, an approver, a user, a graph database, the model, a skill, an agent, a workflow or a load is a History row; the person, the agent it ran through and what caused it are kept apart |
| One record, many readings | History, a run's history, access usage and what left the platform read the same records; none copies them |
| Nothing leaves without a person | An outward send waits for a named approver's yes unless a rule allows it; an ask is never decided by itself |
| Numbers come from the record | What is used, refused and spent is counted by the engine from stored runs, the ledger and History, never from a second pipeline |

## Decisions

| Decision | Detail |
|---|---|
| Access Policies only, no roles | What anyone may do is the Access Policies attached to them, built from [the permission catalogue](features/AC-F02-access-policies/feature.md#the-permission-catalogue) — the one source of what may be granted; no feature restates who may. *Super user* is locked and always held; the Access templates are data ([AC-F02 › Rules](features/AC-F02-access-policies/feature.md#rules)) |
| Policies attach to people, teams, projects and agents | A person holds the Allows on them and their teams, minus the Denies; a project holds policies the same way, and they bound its runs; an agent's is its ceiling, never a grant. Inside a project a run reaches the project's policies ∩ the agent's ceiling; outside one, the person behind it ∩ the ceiling ([AC-F02 › Rules](features/AC-F02-access-policies/feature.md#rules)) |
| Everyone sees, the policy decides | Every place and act shows to everyone; an act a person lacks is disabled with its reason and who can grant it, data a policy denies is withheld, and the engine refuses — hiding is never the guard ([AC-F02 › Rules](features/AC-F02-access-policies/feature.md#rules)) |
| Default deny · Deny wins | What no rule allows is refused; Deny over Ask over Allow, across policies and along a caller chain |
| Declare, never grant | Skills, workflows, plugins, Team packs and runtimes declare what they need; only an Access Policy grants it |
| Ceilings only narrow | A key, a run's scope, a credential's scope, a graph database's mode and the worker sandbox narrow what policies allow; none widens it ([AC-F04](features/AC-F04-what-an-agent-may-touch/feature.md)) |
| Teams are flat and own nothing | A team is a list of people that holds policies; no team holds another, and a team owns no resource |
| Only a person saves access | An agent may propose a rule — tighter or looser — and a person with Edit on Access saves it or not; no agent saves or attaches a policy. Every signed-in person reads every policy, rule and team: a person must see a rule to know whom to ask |
| A second person's yes, when set | A deployment setting, off by default: when on, a change to an Access Policy, an attachment or a work connection waits for another person's yes ([AC-F02](features/AC-F02-access-policies/feature.md#rules)) |
| A leaver names a successor | Deactivating a person names a successor, who takes every place they held on the work; their personal-connection data is erased and their name kept or pseudonymised, by one deployment setting ([AC-F03](features/AC-F03-directory/feature.md) · [AC-F12](features/AC-F12-leaving-and-keeping/feature.md)) |
| Kept until an Admin says otherwise | Memory, History, the ledger, the query log and recall each keep everything until an Admin sets a period; a legal hold on memory or History stops retention and erasure; a subject is forgotten through lineage; History is never edited ([AC-F12](features/AC-F12-leaving-and-keeping/feature.md)) |
| The organisation owns the work | The platform — the system user — owns built-in and shared agents, keeping who made each; a personal agent is its person's; an agent retires, never deletes. Every place a person sits on work is a slot with a fallback ([AC-F07](features/AC-F07-ownership/feature.md)) |
| Built-ins are the system user's | What Invana ships — built-in agents, built-in policies, built-in workflows, default skills — is owned by the system user, copied to change, never edited |
| Named approvers decide asks | Each agent names the people or teams who answer its asks; with none who can answer, Admins, with a *no approver* alert. An ask is never decided by the person it benefits, and its yes covers this step of this run ([AC-F05](features/AC-F05-asks-and-approvals/feature.md)) |
| Managing access needs a session | A key or a connected client never changes a policy, an attachment, a team, an approver, a key or a credential; a person signs in again — the password or the SSO, and the second factor — for each ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Software acts as a person, never more | A key acts as its owner, narrowed by the key ([AC-F10](features/AC-F10-keys/feature.md)); a connected MCP client acts as the person who consented, through their default agent, narrowed like a key ([AC-F11](features/AC-F11-connect-an-mcp-client/feature.md)) |
| Access is reviewed | Every quarter an Admin reviews each person's and agent's Access Policies and connections and signs it off; the sign-off is recorded ([AC-F08](features/AC-F08-access-usage/feature.md)) |
| Run content is private | A run's content — what it read, sent and answered — reads to the person behind it; anyone else reads that it ran, its status and its tokens, and its content only with Read on Runs and a logged reason ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every call is ledgered | Every call to an AI model, a tool or a graph database is a ledger row, schema-only or data-bearing, written before its result is used; a sensitive property never reaches an external model ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every act names its rule | A result, an ask or a refusal shows in *How it got here* the rule that applied to each step, its policy, its version and who set it, as they were when the step ran |
| Checked when the step runs | Each step is checked against the policies in force when it runs, not when its run opened |

## Depends on

| Product or capability | For |
|---|---|
| Control Plane | The graph databases, plugins, tools and AI models a rule names; the Inbox where asks wait; limits; the worker sandbox that enforces `fs/` · `cmd/` · `net/` |
| Graph Plane | The project memory, agent learnings and org knowledge a `memory/` rule names |
| Agents | The agents whose ceilings policies are, the built-in agents, personal agents, the runs asks are raised from |
| Projects | The projects a `project/` rule names, each project's policies, and a run's project for its run scope |
| Ontology | The kinds a rule on `data/…` names and the sensitive properties that never reach an external model |

## Not building

| Item | Why not |
|---|---|
| Per-record or per-property rules | A rule reaches a kind in a graph database; a property is kept from outside models by marking it sensitive |
| Roles | One shape — Access Policies — carries every grant ([AC-F02](features/AC-F02-access-policies/feature.md#not-building)) |
| Conditions on a rule | Time windows, addresses, teams and tags are unproven and make a rule unreadable |
| Nested teams · teams that own | A flat list of people carries every team we know of |
| Invitations | A person with Create on Access makes the account directly, or the first SSO sign-in does |
| SCIM provisioning | An Admin makes the account, or the first SSO sign-in does ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Workspaces, tenants or a unit inside the deployment | One deployment is everything; multi-tenancy is out of scope |
| Editing History | History is append-only |
| A second pipeline for numbers | It would drift from the record it describes |
