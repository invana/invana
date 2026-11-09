---
id: AC-F03
title: Groups, keys and who holds a rule
product: AC
status: idea
personas: [owner, builder, curator, analyst]
stories: [AC-09, AC-10, AC-11]
journeys: [J05]
boards: [settings.access, settings.me, shell.locked]
depends_on: [AC-F02, AC-F05, AC-F06]
---

# Groups, keys and who holds a rule

> Who holds each access rule — people, groups, agents and service accounts — and the keys that act as their holder,
> narrowed. The decision it helps make: *should this person, team or key hold this — and for how long?*

## User journey

Journeys this feature is a step of: [J05 · Join a Graph someone set up](../../../../journeys/J05-join-a-graph-someone-set-up.md)

```mermaid
flowchart TD
  start([Settings › People and access]) --> ppl["AC-09 · People and groups"]
  ppl -->|Add person · no account| nf["Refused in place — there is no invitation"]
  ppl --> grp["A group: its people, agents and rules"]
  rule(["AC-04 · A rule"]) --> held["AC-11 · Who holds it · Add people, a group or an agent"]
  held -->|widens one's own access · gives or takes Owner| two(["Waits for an Owner it does not benefit · one Owner: takes effect in 24 hours, alerted"])
  held -->|cannot manage people| ask(["Shown as Ask Priya · AC-15"])
  me([Settings › You › Profile and keys]) --> key["AC-10 · New key — narrowed, expiring, shown once"]
  start --> keys["AC-10 · Every key that reaches this Graph"]
  key --> once(["The secret, once · Copy"])
  keys -->|another holder's key, without the grant| dis["Revoke disabled, naming who can manage people"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| AC-09 | [Grant a team once, with people and groups](stories/AC-09-grant-a-team-once-with-people-and-groups/story.md) | idea |
| AC-10 | [Mint a key that acts as its holder, narrowed](stories/AC-10-mint-a-key-that-acts-as-its-holder-narrowed/story.md) | idea |
| AC-11 | [See and change who holds an access rule](stories/AC-11-see-and-change-who-holds-an-access-rule/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read people, service accounts, groups and each agent's access | Operator — every member | — |
| Add people, a group or an agent to a rule · take them off | `iam-admin` · shown as *Can manage people*; widening one's own access is an Ask, and Owner and *Can manage people* are given or taken only by an Owner it does not benefit (AC-11.10) | As above |
| Add person · New service account · New group · a group's members | `iam-admin` · shown as *Can manage people* | As above |
| Mint and revoke one's own key · mark it agent-operated | Operator — every member | — |
| Mint a key for a service account · revoke another holder's key | `iam-admin` · shown as *Can manage people* | The holder field offers only *You*; *Revoke* on another's key is disabled, naming who can manage people |

## States

| State | What the person sees |
|---|---|
| First use | People: the Graph's members; Groups: *No groups yet — attach a rule once, to a team* with *New group*. Keys: *No keys yet* — what a key is for, and *New key* |
| Empty after a filter | *Nothing matches*, with the filter named and *Clear filters* |
| Loading | The sheet opens at once; lists show loading rows; counts read `—` until the engine gives them |
| Has data | People, groups and service accounts one row each; who holds the selected rule; every key that reaches this Graph |
| Failed | What could not load or save, in a sentence, with *Try again*; a refused save says why in place, naming the line or the name |
| Agent working or proposing | — no agent changes who holds a rule |
| No access | Every person, group and holder reads; each write is shown as *Ask Priya*, naming someone who can manage people |

## Rules

| Rule | Detail |
|---|---|
| Who holds access | People (members and service accounts), groups and agents. A key acts as its holder. Workers hold none — they only run steps |
| A group passes on what it holds | Every person and agent in it holds what the group holds, built-in rules included; nothing is copied |
| A key can only narrow | A key acts as its holder and may carry its own rule; it is never wider than the holder, and the holder's own access still applies |
| Agent-operated keys | A key or service account marked *agent-operated* — by someone who can manage people, or by a holder on their own key — is held to every rule agents are: its access changes are never Allow, and its asks are an agent's. A service account's keys start agent-operated; clearing the mark widens its holder |
| Leans on | Access rules (AC-F02) · asks (AC-F05) · History of every change (AC-F06) · members of the Graph (GR-F04) |

## Data touched

| Record | Read or write |
|---|---|
| Holdings — who holds a rule, how (directly · via a group · for a run), who added them, when it ends | Write · read |
| A key's or service account's *agent-operated* mark | Write · read |
| Groups and their people and agents | Write · read |
| Service accounts | Write · read |
| Keys — name, holder, its own rule, expiry, last used | Write · read |

## Decisions

| Decision | Detail |
|---|---|
| Keys are shown once | A key's secret is shown once, at creation, and never again |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| Nested groups | One level carries teams |
| Invitations | A member is added directly by email or username |
| Showing a key's secret again | A secret that can be read back is a stored password |
| What a key did, per key | Last used is the key's only record of use; History records the person |
