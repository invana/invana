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
| Membership reads, grants write | A member reads everything in the Graph; each grant lets them change one part of it (`.claude/team/TEAM.md` §7) |
| Allowed only where every check allows | A request is its holder's access rules, narrowed by a key's own rule; a run's step is what its skill needs ∩ the agent's rules ∩ the person who started it ∩ the view of the graph ∩ rules for everyone. A refusal names the check and the rule (ST-F02) |
| Access is per Graph | Access rules, groups, service accounts' memberships and keys minted in a Graph are that Graph's. Nothing is install-wide but the install Admin |
| Being Admin opens no Graph | The install Admin runs install rules, standards, datasets and retraction; it grants no access to a Graph's contents |
| Every credential carries its holder | A session and a key both act as the person who holds them; a key minted in a Graph is bound to it and may be narrowed |
| Managing credentials needs a session | A call made with a key cannot mint or revoke a key, change a password, delete an account or add a user |
| A username is an address | It is mutable, rarely, and never forwards from an old one (ST-F03) |
| Deletes are outright | An account deletes with no trash tier; archive covers Graphs |
| Three modes for what agents may touch | Every act an agent takes runs in one of three modes: **Allow** — it acts · **Ask first** — it waits in Needs you, showing exactly what will happen (IN-F01) · **Block** — it is refused before it runs, naming the mode and who set it. The acts: a tool or function call · a graph read or write · an AI model call · a send · a spend · an access change |
| Modes are for agents | People keep their grants; a mode never narrows or widens what a person may do |
| What agents may touch is the person's decision | Only a person sets a mode; an agent may propose a tighter one, never a looser one, and asks for more in Needs you (ST-31) |
| Where a mode is set | On a connector, data, an AI model, a plugin, a tool, a skill and an agent |
| One place decides | A mode is a value on an access rule's line (ST-F02). Set by hand on an item, it writes that line; set by policy, a line reaches many items at once. There is no second editor, and each mode names the line and who set it |
| Data by sensitivity and by kind | A policy line reaches data by its sensitivity — public · internal · confidential · personal; a line set by hand names one kind. Both apply; the tightest binds |
| Levels only tighten | The install, then the Graph, then the agent. Each level down keeps or tightens a mode, never loosens it; the tightest binds — Block over Ask first over Allow. The install level is what an Admin turns on, offers and limits — a plugin off, a model version not offered, a Graph's limits (ST-F04 · ST-F05 · ST-F06) |
| Defaults | Reads are Allow. Writes, sends, spends and access changes are Ask first — until a person sets otherwise |
| An access change is never Allow | For an agent, an access change is Ask first or Block — fixed, never a default a person may move |
| Every outcome names its mode | An agent's result, ask or refusal shows in *How it got here* the mode that applied to each step, its level and who set it |

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
| A second editor for modes | One record decides; a mode set anywhere is an access rule's line |
| Modes on people | A person's reach is their grants and access rules |
