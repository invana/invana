---
id: AC
title: Access Plane
status: idea
owner: Ravi
personas: [admin, analyst, builder, modeller, decision-maker]
---

# Access Plane

> Who may act, through which agent, and what did they do: sign-in, sessions, keys and connected MCP clients; Access Policies — Allow · Ask ·
> Deny on Read · Write · Run — and the one role table; the Directory of users and teams; ownership; asks and
> approvals; and History.
> The decision it helps make: *which agent may do what, for whom — and should this go?*

## Problem

An agent that reads, writes and runs for people is only trusted when a person can read, as plain rules, what it may
touch and for whom, can see who decides when it must ask, and can audit afterwards what it did. Without that, a
deployment is either open to every agent or closed to the people who need them.

## Users

| Persona | Comes here to |
|---|---|
| Admin | Add people and teams, set each person's role, write Access Policies and attach them to agents, hand over what a leaver owns, read who did what |
| Analyst · Decision maker | Sign in; keep their own account, sessions, keys and connected clients; see which agents they may use; answer the asks they are named for |
| Agent builder | See what an agent may touch and why; name who approves its asks; add co-owners |
| Modeller | Read the policies that keep a kind or a sensitive property from agents |

## Goals

| Goal | Measured by |
|---|---|
| Every refusal names the rule, its policy and who can change it | Open — set at the spec review |
| No ask waits unseen; unanswered, it expires refused, never allowed | Open — set at the spec review |
| Every act by a person or an agent is in History, append-only and provably unedited | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| AC-F01 | [Sign in, account and sessions](features/AC-F01-sign-in-account-and-sessions/feature.md) | AC-01 · AC-34 · AC-02 · AC-18 | idea |
| AC-F02 | [Access Policies](features/AC-F02-access-policies/feature.md) | AC-03 · AC-04 · AC-06 · AC-07 · AC-08 · AC-11 · AC-19 · AC-20 · AC-21 · AC-27 | idea |
| AC-F03 | [Directory](features/AC-F03-directory/feature.md) | AC-22 · AC-33 · AC-09 · AC-23 | idea |
| AC-F04 | [What an agent may touch](features/AC-F04-what-an-agent-may-touch/feature.md) | AC-12 · AC-13 · AC-14 | idea |
| AC-F05 | [Asks and approvals](features/AC-F05-asks-and-approvals/feature.md) | AC-15 · AC-26 · AC-32 | idea |
| AC-F06 | [History — what people and agents did, and every change](features/AC-F06-history/feature.md) | AC-16 · AC-17 | idea |
| AC-F07 | [Ownership](features/AC-F07-ownership/feature.md) | AC-24 · AC-25 | idea |
| AC-F08 | [Access usage](features/AC-F08-access-usage/feature.md) | AC-28 · AC-29 | idea |
| AC-F09 | [What left the platform](features/AC-F09-what-left-the-platform/feature.md) | AC-30 · AC-31 | idea |
| AC-F10 | [Keys](features/AC-F10-keys/feature.md) | AC-10 | idea |
| AC-F11 | [Connect an MCP client](features/AC-F11-connect-an-mcp-client/feature.md) | AC-35 · AC-36 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Sign in | page | `access.signin` |
| Sign in again — the password for a risky act | modal | `access.sign_in_again` |
| Connect an MCP client — consent | page | `access.consent` |
| Access Policies | sheet | `settings.access` |
| Roles — what each role may do | sheet | `settings.roles` |
| Directory — users, service users, teams, every key and connected client | sheet | `settings.people` |
| Owners of a resource | modal | `access.owners` |
| You — profile, sessions, keys, connected clients | modal | `settings.me` |
| An ask in Needs you | modal | `inbox` |
| Access usage — what each agent touched, access never used | sheet | `access.usage` |
| What left the platform — the ledger | sheet | `access.ledger` |
| History | modal | `inbox.history` |
| No access | every surface | `access.locked` — the act names the role it needs, or the approver who decides |

## Rules

| Rule | Detail |
|---|---|
| Every write is in History | Every change to a policy, a role, a team, an owner, an approver, a user, a graph database, the model, a skill, an agent, a workflow or a load is a History row; the person, the agent it ran through and what caused it are kept apart |
| One record, many readings | History, a run's history, access usage and what left the platform read the same records; none copies them |
| Nothing leaves without a person | An outward send waits for a named approver's yes unless a rule allows it; an ask is never decided by itself |
| Numbers come from the record | What is used, refused and spent is counted by the engine from stored runs, the ledger and History, never from a second pipeline |

## Decisions

| Decision | Detail |
|---|---|
| Agents only | Every Read · Write · Run is an agent's. A person holds the agents they may use and one role; agents hold every Read · Write · Run through the Access Policies attached to them. A person's own act in Studio runs as the built-in agent for it ([AC-F02 › Built-in agents](features/AC-F02-access-policies/feature.md#rules)) |
| Two checks, both must pass | **The role**: the person's role holds the feature, by the one role table ([AC-F02](features/AC-F02-access-policies/feature.md#the-role-table)). **The policy**: the agent's Access Policies, narrowed to the teams of the person behind the run, allow the verb on the resource. Neither widens the other |
| One role each, fixed | **Operator** · **Modeller** · **Admin**; each holds what the one before holds. The table is the engine's and no one edits it; there are no custom roles |
| A rule is effect · verb · resource | Allow · Ask · Deny × Read · Write · Run × `type/name`, where `*` stands for one whole segment. A rule may name a team, its only condition, and then holds only when the person behind the run is on it |
| Default deny · the strictest wins | What no rule reaches is denied. Where rules disagree — across policies, teams or a caller chain — Deny over Ask over Allow |
| Policies attach to agents | Never to a person or a team. A person reaches data only through an agent they may use; a team narrows a rule, it never holds one |
| Teams are flat and own nothing | A team is a list of people; no team holds another, and a team owns no resource |
| Only a person sets an effect | An agent may propose a rule — tighter or looser — and a person saves it or not; no agent saves a rule |
| Only Admins change access | Writing and attaching Access Policies, setting a person's role, making teams and granting agents are Admin acts. Every signed-in person reads every policy, rule, team and role: a person must see a rule to know whom to ask |
| There is always an Admin | The last active Admin cannot lose the role or be deactivated |
| Owners are people | Only people and the system user own resources; co-owners are allowed. What an agent creates is owned by the person behind the run. Agents and service users own nothing ([AC-F07](features/AC-F07-ownership/feature.md)) |
| Built-ins are the system user's | What Invana ships — built-in agents, built-in policies, built-in workflows, default skills — is owned by the system user, copied to change, never edited |
| Named approvers decide asks | Each agent names the people or the team who answer its asks; with none named, its owners. An ask is never decided by the person it benefits ([AC-F05](features/AC-F05-asks-and-approvals/feature.md)) |
| Managing access needs a session | A key or a connected client never changes a policy, a role, a team, an owner, an approver, a key or a credential; a person signs in again — the password for the act — for each ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Software acts as a person, never more | A key acts as key ∩ its owner ([AC-F10](features/AC-F10-keys/feature.md)); a connected MCP client acts as the person who consented, through the agents they may use ([AC-F11](features/AC-F11-connect-an-mcp-client/feature.md)) |
| Run content is private | A run's content — what it read, sent and answered — reads to the person behind it, its agent's owners and Admins; anyone else reads that it ran, its status and its tokens ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every call is ledgered | Every call to an AI model, a tool or a graph database is a ledger row, schema-only or data-bearing, written before its result is used; a sensitive property never reaches an external model ([AC-F09](features/AC-F09-what-left-the-platform/feature.md)) |
| Every act names its rule | A result, an ask or a refusal shows in *How it got here* the rule that applied to each step, its policy, its version and who set it, as they were when the step ran |
| Checked when the step runs | Each step is checked against the policies and roles in force when it runs, not when its run opened |

## Depends on

| Product or capability | For |
|---|---|
| Control Plane | The graph databases, plugins, tools and AI models a rule names; the Inbox where asks wait; limits per team, user and agent |
| Agents | The agents policies attach to, the built-in agents, the runs asks are raised from |
| Ontology | The kinds a rule on `data/…` names and the sensitive properties that never reach an external model |

## Not building

| Item | Why not |
|---|---|
| Per-record or per-property rules | A rule reaches a kind in a graph database; a property is kept from outside models by marking it sensitive |
| Custom roles | One fixed table keeps every screen's access readable |
| Policies on people or teams | Every act is an agent's; a team narrows a rule and holds none |
| Nested teams · teams that own | A flat list of people carries every team we know of |
| Conditions beyond a team | Time windows, addresses and tags are unproven |
| Invitations | An Admin makes the account directly |
| Single sign-on, SAML, SCIM and MFA | Password sign-in only for now ([AC-F01](features/AC-F01-sign-in-account-and-sessions/feature.md)) |
| Workspaces, tenants or a unit inside the deployment | One deployment is everything; multi-tenancy is out of scope |
| Editing History | History is append-only |
| A second pipeline for numbers | It would drift from the record it describes |
