---
id: ST
title: Settings
status: idea
owner: Ravi
personas: [owner, admin, analyst]
---

# Settings

> Run this Graph, the install and your own account: who may do what, the connection, AI models, plugins, workers and
> limits — summoned over the work, never a page of its own.
> The decision it helps make: *who may do what in this Graph and install, with which models and limits?*

## Problem

Without access a person can read as sentences, a Graph is either open to everyone or closed to the people who need
it. Without limits an install can be spent dry by one Graph's agents.

## Users

| Persona | Comes here to |
|---|---|
| Graph owner | Name the Graph, keep its connection working, invite people and agents, set access rules, read usage |
| Install admin | AI models, plugins and outside tools, workers, each Graph's limits |
| Analyst | Their own account, sessions and tokens |

## Goals

| Goal | Measured by |
|---|---|
| Every refusal names who can grant it | Open — set at the spec review |
| An install's spend stays inside each Graph's limits | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| ST-F01 | This graph — name, connection, members, usage | ST-12 · ST-13 · ST-14 | idea |
| ST-F02 | People and access | ST-01 · ST-02 · ST-03 · ST-05 · ST-06 · ST-07 · ST-08 · ST-09 · ST-10 · ST-11 | idea |
| ST-F03 | You — account and sessions | ST-15 | idea |
| ST-F04 | Plugins and outside tools | ST-26 · ST-27 · ST-29 | idea |
| ST-F05 | AI models | ST-28 | idea |
| ST-F06 | Workers and limits | ST-16 · ST-17 · ST-18 · ST-19 · ST-20 · ST-21 · ST-22 · ST-23 · ST-24 · ST-25 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| People | modal | `settings.people` |
| Access rules | sheet | `settings.access` |
| Usage | modal | `settings.usage` |
| AI models | modal | `settings.ai` |
| Workers | modal | `settings.workers` |
| Notifications | modal | `settings.notifications` |
| You | modal | `settings.me` |

## Decisions

| Decision | Detail |
|---|---|
| Three parts | *This graph* (the open Graph) · *Invana* (the install, Admin only) · *You* (the person's own account) |
| Access belongs to the Graph | Access rules, groups and tokens are the Graph's; an agent's access is its access rules here |
| An agent is a member | Members list people and agents together; an agent's row opens the agent in this Graph — its version, access, runs and spend |
| Membership reads, grants write | A member reads everything in the Graph through the Operator rule's starting lines; each grant lets them change one part of it (`.claude/team/TEAM.md` §7) |
| Allowed only where every check allows | A request is its holder's access rules, narrowed by its own rule — a person's, or a key's; a run's step is what its skill needs ∩ the agent's rules, narrowed by its own rule ∩ the person who started it ∩ the view of the graph ∩ rules for everyone. A refusal names the check and the rule (ST-F02) |
| Access is per Graph | Access rules, groups, service accounts' memberships and keys minted in a Graph are that Graph's. Nothing is install-wide but the install Admin |
| Being Admin opens no Graph | The install Admin runs install rules, standards, datasets and retraction; it grants no access to a Graph's contents |
| Every credential carries its holder | A session and a key both act as the person who holds them; a key minted in a Graph is bound to it and may be narrowed |
| Managing credentials needs a session | A call made with a key cannot mint or revoke a key, change a password, delete an account or add a user |
| A username is an address | It is mutable, rarely, and never forwards from an old one (ST-F03) |
| Deletes are outright | An account deletes with no trash tier; archive covers Graphs |
| One access model, three values | Every permission is a line of an access rule, and a line carries one value: **Allow** — it acts · **Ask** — it waits in Needs you, showing exactly what will happen (IN-F01) · **Deny** — it is refused before it runs, naming the line and who set it. Lines reach tools, skills, connectors, AI models, data by kind and by sensitivity, the Graph's model, agents (running one, handing work to one) and access changes |
| For everyone alike | The same lines bind people, agents and keys; a grant is a built-in rule whose lines carry these values |
| Deny by default | Nothing is permitted that no line reaches with Ask or Allow; there is no implicit default |
| The strictest wins | Where lines disagree — across rules, levels or a caller chain — Deny over Ask over Allow |
| Starting lines are shown | Each built-in rule (Operator · Can work on projects · Can build agents · Can shape the model · Owner · Can manage people) and each new agent's own rule carries starting lines: reads Allow; sends and spends Ask. A new agent's own rule also starts writes and access changes at Ask. Every starting line is shown and editable by someone who can manage people; none is implied. The starting value of a grant's writes is open (ST-F02) |
| A new line starts at Ask | A line added by hand or by the assistant is preselected Ask |
| Access tables name starting lines | A feature's Access table names the built-in rule whose starting line permits each act (`.claude/team/TEAM.md` §7) |
| What may be touched is a person's decision | Only a person sets a line's value; an agent may propose a tighter one, never a looser one, and asks for more in Needs you (ST-31) |
| Where a value is set | On a connector, data, an AI model, a plugin, a tool, a skill, an agent and an access change — always as a line |
| One place decides | A value is a line of an access rule (ST-F02). Set by hand on an item, it writes that line; set by policy, a line reaches many items at once. There is no second editor, and each value names its line and who set it |
| Data by sensitivity and by kind | A line reaches data by its sensitivity — public · internal · confidential · personal — or names one kind; both apply and the strictest binds. Sensitivity comes from a dataset and its columns, and may also be set on a property of a kind (ST-02). Lines are enforced on what a query returns, element by element and property by property |
| Levels only tighten | The Graph, then the holder's own rule. The holder's own rule keeps or tightens a value, never loosens it past the Graph's |
| Where Deny may sit | On the Graph's *For everyone* rule and on a holder's own rule — *A person's own*, *An agent's own*, *A key's own* (ST-F02). The other rules a holder has still add up |
| A person's Ask | Waits in Needs you (IN-F01), decided by people who hold Allow on that act — never by the asker, nor by the person or agent it benefits |
| Never decided by the one it benefits | An access change that widens the asker, its helpers, the person who started its run or its delegates, or that loosens any line, is never decided by whoever it benefits |
| An agent's access change is never Allow | Fixed, for every agent: one that widens it, its helpers, its starter or its delegates, or loosens any line, is Deny; any other is at most Ask. No line moves it (ST-31) |
| Someone can always decide | The Owner always holds Allow on access changes; no edit removes it, so every Graph has someone who can decide |
| Every permission rule is the engine's | The engine enforces every line, every fixed value and every refusal on every path — Studio, the API, keys, `invana iam apply` and workers. Loosening a line or editing *For everyone* needs a person's session, never a key |
| Checked when the step runs | Each step is checked against the lines in force when it runs, not when its run opened. On a yes, the engine checks the decider and every check again before the act goes |
| A yes runs only what was asked | Every ask stores its exact act with a hash; a yes runs only that act. A write whose targets changed since the ask is refused |
| The strictest along the caller chain | A step of a helper or a delegate is bound by the strictest value along its whole caller chain; helpers and delegates hold the root agent's own rule as well as their own |
| A standing Allow is bounded | An Allow that runs work later — pick-up (PJ-15), a schedule's deliveries (AG-42) — is bounded by both the person who set it and the author of the work it runs; it lapses when its setter loses the right to set it |
| Allow never passes a limit | Allow on a spend never passes an access rule's limits or the Graph's (ST-F06) |
| Which act a call is | A model call within the holder's token budget is a read; past it, a spend; carrying data above the provider's clearance, a send (ST-F05). A tool call counts by what it touches: one that only fetches is a read; writing the graph or changing the model is a write; carrying Graph data out of the install is a send, whatever the tool says of itself. An MCP tool's read-only hint counts only once an Admin confirms it for that tool's revision (ST-F04) |
| Unlabelled data | Data with no sensitivity is never read as confidential; the level it counts as is open (ST-F02). *What it may touch* flags it (ST-30) |
| Every outcome names its value | A result, an ask or a refusal shows in *How it got here* the value that applied to each step, its level, the line's version and who set it, as they were when the step ran |

## Depends on

| Product or capability | For |
|---|---|
| Shell | Signing in and creating a Graph |
| Agents | The agents a Graph invites |

## Not building

| Item | Why not |
|---|---|
| Multi-tenancy · an Organisation record | One install is one organisation |
| Per-record permissions | What an access rule reaches is the unit; a finer grain is unproven |
| Invitations | A member is added directly; an invitation flow is a product of its own |
| Single sign-on and outside sign-in providers | Email and password first; a provider is a later decision |
| Install administration as a product surface | It lets the install's operator inspect state without SQL; it is never a way around the product |
| Soft deletes, trash, undo for accounts | Archive covers the real need for Graphs; accounts delete outright |
| Invana as a sign-in provider for outside apps | Keys cover it at this stage |
| A second editor for permissions | One record decides; a value set anywhere is an access rule's line |
| Install-wide permissions, set by an install admin | Access is per Graph today; control across every Graph is a later feature of its own |
