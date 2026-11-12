---
id: AC
title: Access
status: idea
owner: Ravi
personas: [owner, admin, analyst, builder, decision-maker]
---

# Access

> Who may act, and what did they do: sign-in, accounts, sessions and keys; access lines — Allow · Ask · Deny — for
> people, agents and keys alike; asks and approvals; and History.
> The decision it helps make: *who may do what in this Graph — and should this go?*

## Problem

Without access a person can read as sentences, a Graph is either open to everyone or closed to the people who need
it. An agent that must ask before it sends, changes or spends is useless if the ask is lost; and a Graph whose history
nobody can read cannot be audited.

## Users

| Persona | Comes here to |
|---|---|
| Graph owner | Set access rules, groups and keys; allow access, budget and sends; read and export who did what |
| Analyst · Decision maker | Sign in; keep their own account, sessions and keys; answer the asks waiting on them |
| Agent builder | See what an agent may touch and why; compare a new version with the one before |
| Install admin | Sign in; reach every Graph's access as its own access allows |

## Goals

| Goal | Measured by |
|---|---|
| Every refusal names who can grant it | Open — set at the spec review |
| No ask waits unseen; at its deadline it is *expired, not sent*, never approved | Open — set at the spec review |
| Every act by a person or an agent is in History, append-only and provably unedited | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| AC-F01 | [Sign in, account and sessions](features/AC-F01-sign-in-account-and-sessions/feature.md) | AC-01 · AC-02 · AC-18 | idea |
| AC-F02 | [Access rules](features/AC-F02-access-rules/feature.md) | AC-03 · AC-04 · AC-05 · AC-06 · AC-07 · AC-08 | idea |
| AC-F03 | [Groups, keys and who holds a rule](features/AC-F03-groups-keys-and-holders/feature.md) | AC-09 · AC-10 · AC-11 | idea |
| AC-F04 | [What an agent may touch](features/AC-F04-what-an-agent-may-touch/feature.md) | AC-12 · AC-13 · AC-14 | idea |
| AC-F05 | [Asks and approvals](features/AC-F05-asks-and-approvals/feature.md) | AC-15 | idea |
| AC-F06 | [History — what people and agents did, and every change](features/AC-F06-history/feature.md) | AC-16 · AC-17 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Sign in | page | `access.signin` |
| People | modal | `settings.people` |
| Access rules | sheet | `settings.access` |
| You | modal | `settings.me` |
| An ask in Needs you | modal | `inbox` |
| History | modal | `inbox.history` |
| No access | every surface | `access.locked` — the act reads *Ask Priya (owner)* |

## Rules

| Rule | Detail |
|---|---|
| Every write is in History | Graph, model, skill, rule, agent, task, load, connection — none is silent; the actor and whom it acted for are kept apart, and what caused it is linked |
| One record, many readings | History, a run's history, the evidence memory draws on and how the agents are doing all read the same record; none copies it |
| Nothing leaves without a person | An outward send waits for an ask unless a schedule's owner switched it off for that schedule; an ask is never decided by itself |
| Numbers come from the record | What is slow, what spends and what fails are counted from stored runs and History, never from a second pipeline |
| History removes windows, never rows | Old rows go a whole window at a time, and the removal is a row |

## Decisions

| Decision | Detail |
|---|---|
| Access belongs to the Graph | Access rules, groups and tokens are the Graph's; an agent's access is its access rules here |
| Membership reads, grants write | A member reads everything in the Graph through the Operator rule's starting lines; each grant lets them change one part of it (`.claude/team/TEAM.md` §7) |
| Allowed only where every check allows | A request is its holder's access rules, narrowed by its own rule — a person's, or a key's; a run's step is what its skill needs ∩ the agent's rules, narrowed by its own rule ∩ the person who started it ∩ the view of the graph ∩ rules for everyone. A refusal names the check and the rule (AC-F03) |
| Access is per Graph | Access rules, groups, service accounts' memberships and keys minted in a Graph are that Graph's. Nothing is install-wide but the install Admin |
| Being Admin opens no Graph | The install Admin runs install rules and standards; it grants no access to a Graph's contents |
| Every credential carries its holder | A session and a key both act as the person who holds them; a key minted in a Graph is bound to it and may be narrowed |
| Managing credentials needs a session | A call made with a key cannot mint or revoke a key, change a password, delete an account or add a user |
| A username is an address | It is mutable, rarely, and never forwards from an old one (AC-F01) |
| Deletes are outright | An account deletes with no trash tier; archive covers Graphs |
| One access model, three values | Every permission is a line of an access rule, and a line carries one value: **Allow** — it acts · **Ask** — it waits in Needs you, showing exactly what will happen (AC-F05) · **Deny** — it is refused before it runs, naming the line and who set it. Lines reach tools, skills, connectors, AI models, data by kind and by sensitivity, the Graph's model, agents (running one, handing work to one) and access changes |
| For everyone alike | The same lines bind people, agents and keys; a grant is a built-in rule whose lines carry these values |
| Deny by default | Nothing is permitted that no line reaches with Ask or Allow; there is no implicit default |
| The strictest wins | Where lines disagree — across rules, levels or a caller chain — Deny over Ask over Allow |
| Starting lines are shown | Each built-in rule (Operator · Can work on projects · Can build agents · Can shape the model · Owner · Can manage people) carries starting lines: reads Allow; the writes it gives Allow — *Operator* asking and its holder's own runs and keys · *Can work on projects* projects · *Can build agents* agents and skills · *Can shape the model* the model · *Can manage people* access changes; sends and spends Ask. The Owner's rule starts every act at Allow. A new agent's own rule starts reads at Allow, reading access at Deny; writes, sends and spends at Ask; access changes never Allow. A key's own rule starts reads at Allow, writes at Ask, and sends, spends and access changes at Deny unless set when the key is made (AC-10); an agent-operated key's own rule starts reading access at Deny, as an agent's does. Every starting line is shown and editable by someone who can manage people; none is implied |
| A new line starts at Ask | A line added by hand or by the assistant is preselected Ask; only the starting lines start elsewhere |
| Access tables name starting lines | A feature's Access table names the built-in rule whose starting line permits each act (`.claude/team/TEAM.md` §7) |
| What may be touched is a person's decision | Only a person sets a line's value; an agent may propose a tighter one, never a looser one, and asks for more in Needs you (AC-14) |
| Where a value is set | On a connector, data, an AI model, a plugin, a tool, a skill, an agent and an access change — always as a line |
| One place decides | A value is a line of an access rule (AC-F02). Set by hand on an item, it writes that line; set by policy, a line reaches many items at once. There is no second editor, and each value names its line and who set it |
| Data by sensitivity and by kind | A line reaches data by its sensitivity — public · internal · confidential · personal — or names one kind; both apply and the strictest binds. Sensitivity is set on a property of a kind (AC-04). Lines are enforced on what a query returns, element by element and property by property |
| Levels only tighten | The Graph, then the holder's own rule. The holder's own rule keeps or tightens a value, never loosens it past the Graph's |
| Where Deny may sit | On the Graph's *For everyone* rule and on a holder's own rule — *A person's own*, *An agent's own*, *A key's own* (AC-F03). The other rules a holder has still add up |
| A person's Ask | Waits in Needs you (AC-F05), decided by people who hold Allow on that act — never by the asker, nor by the person or agent it benefits |
| Never decided by the one it benefits | An access change that widens the asker, its helpers, the person who started its run or its delegates, or that loosens any line, is never decided by whoever it benefits. A change *benefits* the one it widens, the groups they are in, the agents they own or started, and their service accounts |
| No one widens their own access | A person's own change that widens what they hold — directly, through a group, or through an agent, service account or key of theirs — is an Ask, routed to someone it does not benefit, whatever the lines say. Owner and *Can manage people* are given or taken only by an Owner it does not benefit (AC-11) |
| Loosening for the whole Graph takes two | Loosening a built-in rule or the *For everyone* rule waits for an Owner who did not make the change, with an alert to every Owner (AC-04) |
| One Owner: a delay, not a second person | When the Graph has only one Owner and the change needs an Owner it does not benefit, or an Owner who did not make it, the change takes effect after 24 hours, with an alert to that Owner and a History row; the Owner may cancel it until then |
| Only a person's session decides | An ask is decided only from a person's signed-in session — never by a key, a service account or an agent (AC-15) |
| A fresh sign-in for the riskiest acts | An access change, a send of confidential or personal data, and raising a limit — made or allowed by a person — need a sign-in within the last 15 minutes. Every access change an Owner makes or allows is a History row and an alert to the Graph's other Owners |
| An agent's access change is never Allow | Fixed, for every agent: one that widens it, its helpers, its starter or its delegates, or loosens any line, is Deny; any other is at most Ask. No line moves it (AC-14) |
| Someone can always decide | The Owner's rule starts every act at Allow, so on the starting lines every act set to Ask has someone holding Allow on it. The Owner always holds Allow on access changes: no line on any rule — *For everyone*, an Owner's own rule, a lock — makes it Ask or Deny, and only an Owner edits another Owner's own rule; *For everyone* never narrows the Owner's rule on access changes. A line that leaves an act with nobody able to decide it is refused; an ask nobody but whoever it benefits could decide fails closed at once, saying why, but for the one-Owner delay. A Graph warns while it has only one Owner (GR-13) |
| Every permission rule is the engine's | The engine enforces every line, every fixed value and every refusal on every path — Studio, the API, keys, `invana iam apply` and workers. Loosening a line, editing *For everyone*, and every change that widens a holder — a holding, a grant, a group's members, an unlock, clearing the *agent-operated* mark — need a person's session, never a key |
| Checked when the step runs | Each step is checked against the lines in force when it runs, not when its run opened. On a yes, the engine checks the decider and every check again before the act goes |
| A yes runs only what was asked | Every ask stores its exact act with a hash; a yes runs only that act. A write whose targets changed since the ask is refused |
| The strictest along the caller chain | A step of a helper or a delegate is bound by the strictest value along its whole caller chain; helpers and delegates hold the root agent's own rule as well as their own |
| A standing Allow is bounded | An Allow that runs work later — pick-up (PJ-15), a schedule's deliveries (AG-42) — is bounded by both the person who set it and the author of the work it runs; it lapses when its setter loses the right to set it |
| Allow never passes a limit | Allow on a spend never passes an access rule's limits or the Graph's (RT-F04) |
| Which act a call is | A model call within the holder's token budget is a read; past it, a spend; carrying data above the provider's clearance, a send (RT-F01). A tool call counts by what it touches: writing the graph or changing the model is a write; carrying Graph data out of the install is a send, whatever the tool says of itself; an outside call whose address or arguments the AI model produced is a send; one that only fetches from an address and arguments the model did not produce is a read. Each tool has its own line, so someone who can manage people may set one on purpose — *web search · send* to Allow. An MCP tool's read-only hint counts only once an Admin confirms it for that tool's revision (RT-F02) |
| Unlabelled data | Data with no sensitivity counts as *internal*, so it may reach an outside provider cleared for *internal* without asking — an accepted risk. *What it may touch* flags it (AC-13); adding an AI model endpoint says how much unlabelled data it can reach (RT-01); a personal property is labelled on its kind (AC-04) |
| Reading access is no act — for people | Every member, in a signed-in session, reads every access rule, its lines, holders and versions. For a person it is not an act a line governs, so no line — Deny included — and no default hides it: a person must see a rule to know what to ask for. For an agent or a key, reading access — rules, holders, *Can someone do this?* — is a read under a line, starting at Deny on an agent's own rule and on an agent-operated key's own rule. A key's details — its own rule, expiry, last use — read only to its holder and to someone who can manage people |
| An export | A person's export from their own session — a file of what they already see — is a read, held to the lines on data (AC-04). An export carrying confidential or personal data, or made by a key or an agent, is a send. Every export is a History row (AC-F06), and a CSV cell that would run as a formula is written as text |
| Every outcome names its value | A result, an ask or a refusal shows in *How it got here* the value that applied to each step, its level, the line's version and who set it, as they were when the step ran |
| Only a person answers an ask | An agent never approves an ask, its own or another's |

## Depends on

| Product or capability | For |
|---|---|
| Graph | The Graph its rules and History belong to; the Inbox where asks wait (GR-F05) |
| Runtime | The AI models, tools and limits a line reaches |
| Agents | The agents a Graph invites, and the runs asks are raised from (AG-F03) |

## Not building

| Item | Why not |
|---|---|
| Per-record permissions | What an access rule reaches is the unit; a finer grain is unproven |
| Invitations | A member is added directly; an invitation flow is a product of its own |
| Single sign-on and outside sign-in providers | Email and password first; a provider is a later decision |
| Install administration as a product surface | It lets the install's operator inspect state without SQL; it is never a way around the product |
| Soft deletes, trash, undo for accounts | Archive covers the real need for Graphs; accounts delete outright |
| Invana as a sign-in provider for outside apps | Keys cover it at this stage |
| A second editor for permissions | One record decides; a value set anywhere is an access rule's line |
| Install-wide permissions, set by an install admin | Access is per Graph today; control across every Graph is a later feature of its own |
| Editing history | History is append-only |
| A second pipeline for numbers | It would drift from the record it describes |
| A feed per person | History is read per subject — a run, an agent, a record, the Graph |
