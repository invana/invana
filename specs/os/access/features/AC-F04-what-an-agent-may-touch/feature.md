---
id: AC-F04
title: What an agent may touch
product: AC
status: idea
personas: [owner, builder, analyst]
stories: [AC-12, AC-13, AC-14]
journeys: [J06]
boards: [settings.access, shell.locked, inbox, agents.run]
depends_on: [AC-F02, AC-F05, AC-F06, AG-F01]
---

# What an agent may touch

> What each agent can actually do in this Graph and why not, every item's value at every level and who set it — and
> the ask a denied agent raises for more. The decision it helps make: *should this agent be able to touch this — and
> should it have more when it asks?*

## User journey

Journeys this feature is a step of: [J06 · Set what an agent may touch](../../../../journeys/J06-set-what-an-agent-may-touch.md)

```mermaid
flowchart TD
  start([Settings › People and access]) --> ag["AC-12 · Agents — what each can actually do, and why not"]
  ag -->|Open in Agents| agx(["AG-F01 · the agent's sheet"])
  ag --> touch["AC-13 · What it may touch — each item's mode at every level, and who set it"]
  touch -->|Change| where(["The line that sets it · AC-04, or the agent's sheet"])
  run([A run's step]) --> modeThe strictest line, when it runs
  mode -->|Allow| go(["It runs"])
  mode -->|Deny| blk["AC-14 · Refused · the agent asks for more"]
  blk -->|past the daily cap| cap(["Refused · names the cap"])
  blk --> moreAC-15 · whoever may change that mode decides
  more -->|Allow · for this run, N days or always| go
  more -->|Decline · for N days · expires| refd(["The step ends refused · named in How it got here"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-12 | [See why an agent can or cannot](stories/AC-12-see-why-an-agent-can-or-cannot/story.md) | idea |
| AC-13 | [See what an agent may touch](stories/AC-13-see-what-an-agent-may-touch/story.md) | idea |
| AC-14 | [A denied agent asks for more](stories/AC-14-a-blocked-agent-asks-for-more/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| An agent's access from its own sheet | Read: every member · attach a rule: `iam-admin` | As above |
| Read what an agent may touch — every item's value, its level and who set it | Operator — every member | — |
| Lock a Deny line on a holder's own rule — never one on an Owner's access changes · mark a key or service account agent-operated | `iam-admin` · shown as *Can manage people* | As above |
| Edit an agent's own rule — tighten, or loosen back no further than the Graph, never past a locked line | `builder` · shown as *Can build agents* · Admin, from the agent's sheet (AG-F01) | Each value reads; changing it is disabled, naming *Can build agents* |
| Change the daily caps on asks for more — per holder and for the Graph | `owner` · shown as *Owner*, in *This graph › General* (GR-15) | The caps read in *Usage and limits* (GR-14); changing them is shown as *Ask Priya (owner)* |
| Decide an ask — an agent's ask for more, or a person's act set to Ask | Someone who holds Allow on that act, from a signed-in session, never the asker nor whoever it benefits; the Owner always holds Allow on access changes (AC-F05) | The ask reads; its acts are disabled, naming who it waits on |

## States

| State | What the person sees |
|---|---|
| First use | Each agent of the Graph with what it may touch on the starting lines of its own rule |
| Empty after a filter | *Nothing matches*, with the filter named and *Clear filters* |
| Loading | The sheet opens at once; lists show loading rows; counts read `—` until the engine gives them |
| Has data | Each agent, what it can actually do and why not; every item's value at every level and who set it |
| Failed | What could not load or save, in a sentence, with *Try again* |
| Agent working or proposing | An agent denied by a line, asking for more in Needs you |
| No access | Every agent's access reads; each write is shown as *Ask Priya*, naming someone who can manage people |

## Rules

| Rule | Detail |
|---|---|
| An agent never does more than its starter | A run a person started is bounded by what that person may do |
| Helpers hold their maker's access | A helper an agent makes holds its root agent's access, narrowed; never rules of its own. An agent handed work holds its own, narrowed by the root agent's own rule; the strictest value along the caller chain binds ([the strictest along the caller chain](../../product.md#decisions)) |
| A locked Deny | Someone who can manage people may lock a Deny line on a holder's own rule — never one that reaches an Owner's access changes; a builder cannot change or remove it |
| Asks for more are bounded | An *item* is one act on one thing — a function, a kind or a sensitivity, an AI model version, an agent, or a line. Asks for more are capped at 20 per holder per day, and at 200 for the whole Graph — limits its Owner changes in *This graph › General* (GR-15). A helper's or a delegate's asks count against its root agent. A repeat of an open ask joins it rather than making another (AC-14) |
| Asks for access go to the Inbox | An ask for access, a higher limit, or more than a line allows (AC-14) is an ask in Needs you (AC-15); allowed, it adds the holder for this run · N days · always, and *Who holds it* says when it ends |
| Leans on | Access rules (AC-F02) · asks (AC-F05) · History of every refusal (AC-F06) · agents built in Agents (AG-F01) |

## Data touched

| Record | Read or write |
|---|---|
| The Graph's daily caps on asks for more — per holder and for the Graph — and the asks made today | Write · read |
| Refusals in History (AC-F06) | Read |

## Decisions

| Decision | Detail |
|---|---|
| Agents are read here, built in Agents | The Agents tab reads each agent's access; *Open in Agents* opens its sheet. A rule added to an agent from either side is one record |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Building agents here | Agents builds them (AG-F01); this reads them |
| Rules on workers | Workers run any agent's steps; access belongs to the agent |
