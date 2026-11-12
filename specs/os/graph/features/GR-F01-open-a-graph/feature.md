---
id: GR-F01
title: Open a graph
product: GR
status: idea
personas: [analyst, owner, admin]
stories: [GR-01, GR-02, GR-03]
journeys: [J01, J02, J05]
boards: [graphs.home, graphs.graph_picker]
nfrs: [NFR-PERF-3]
depends_on: [GR-F02, GR-F04, AC-F01]
---

# Open a graph

> Land on Home off any Graph, and open the Graph your work is in — or, on an empty install, start from the
> question you are deciding. The decision it helps make: *where do I start — which Graph, or which way in?*

## User journey

Journeys this feature is a step of: [J01 · From an empty install to a first answer](../../../../journeys/J01-from-an-empty-install-to-a-first-answer.md) · [J02 · Ask and trust the answer](../../../../journeys/J02-ask-and-trust-the-answer.md) · [J05 · Join a Graph someone set up](../../../../journeys/J05-join-a-graph-someone-set-up.md)

```mermaid
flowchart TD
  s([Invana's address]) --> si(["AC-01 · Sign in"])
  si --> h{"Any Graph I can open?"}
  h -->|none, and none archived| fr["GR-02 · What are you trying to decide? · three ways in"]
  fr -->|Create a graph| cg(["GR-F02 · Create a graph"])
  fr -->|Start from data| dt(["Records · upload a file into a model (RC-08)"])
  fr -->|Try a sample Graph| sm{"A sample Graph I can open?"}
  sm -->|yes| ex(["Explore, in the sample Graph"])
  sm -->|no| ld["Says how one is loaded · Ask an Admin"]
  h -->|yes| home["GR-01 · Home: my Graphs, pinned first, each with its question and progress"]
  h -->|only archived| arc["GR-01 · Home lists them under Archived"]
  home --> op["Open a Graph"] --> mode(["The mode this browser last had open, else Explore"])
  home -->|mid set-up| cs(["GR-F02 · Continue set-up"])
  mode --> gp["GR-01 · Graph picker: switch Graph, keep the mode"]
  home --> nav["GR-03 · With no Graph open: no modes, no This graph"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| GR-01 | [Open a Graph I can reach](stories/GR-01-open-a-graph-i-can-reach/story.md) | idea |
| GR-02 | [Start an empty install from a question](stories/GR-02-start-an-empty-install-from-a-question/story.md) | idea |
| GR-03 | [See only what works with no Graph open](stories/GR-03-see-only-what-works-with-no-graph-open/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| See a Graph on Home and in the Graph picker · open it | Operator — every member of that Graph; an Admin reaches every Graph | A Graph they are not a member of is never listed |
| Pin a Graph | Operator — every member, for themselves | — |
| Create a graph | Anyone signed in — they become its Owner (GR-F02) | — |
| Start from data | As RC-F02 | As RC-F02 |
| Try a sample Graph | Operator — a member of the sample Graph | *No sample Graph here yet*; an Admin reads how one is loaded, everyone else *Ask an Admin* |
| Restore an archived Graph | `owner` · shown as *Owner* (GR-15) | The archived Graph reads; *Unarchive* shown as *Ask Priya (owner)* |

## States

| State | What the person sees |
|---|---|
| First use | No Graph to open: *What are you trying to decide?* and three ways in |
| Empty after a filter | Home's filters or the Graph picker's search match nothing: *No Graph matches* and *Clear* |
| Loading | Home draws its regions and fills the Graph cards in place |
| Has data | Home lists the Graphs I can open, pinned first, each with its question, my access, progress and what needs me |
| Failed | Home names what it could not read and offers *Try again* |
| Agent working or proposing | A Graph card names the agent working on its question and what waits on me |
| No access | A Graph I am not on is never listed |

## Rules

| Rule | Detail |
|---|---|
| Every sign-in lands on Home | Off any Graph, even on an install with one Graph |
| Membership is checked on every call | Removing a person takes effect on their next call; a Graph they lose leaves Home and the picker on the next read |
| The Graph's own address | `/u/:user/:graph` opens the mode this browser last had open there, else Explore. With storage blocked, Explore |
| Switching Graph keeps the mode | The Graph picker opens the same mode in the other Graph, at its landing |
| Home shows numbers the engine counts | Progress, counts and what needs me come from the engine; Home never derives them |
| A sample Graph is a Graph | It is opened, searched and asked like any other; it is never written into a person's own database |
| Leans on | Signing in (AC-F01) · creating a Graph (GR-F02) · archiving and restoring a Graph (GR-15) · keys and sessions (AC-F01) · Records (RC-F02) |

## Data touched

| Record | Read or write |
|---|---|
| Accounts and sessions (AC-F01) | Read · write a session |
| Graphs I am a member of — name, question, archived, set-up progress | Read |
| My pins and the last mode per Graph (this browser) | Read · write |
| What needs me per Graph (AC-F05) | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| — | — | No table of its own; pins and the last mode per Graph are kept in the browser |

### Reads

| Record | Owner |
|---|---|
| The Graphs, their status and members | [GR-F04](../GR-F04-this-graph/feature.md#engine) |
| Each Graph's set-up steps and progress | [GR-F02](../GR-F02-create-a-graph/feature.md#engine) |
| What needs the reader on each Graph — the Inbox count | [GR-F05](../GR-F05-the-inbox/feature.md#engine) |
| Live runs on each Graph | [AG-F03](../../../../capabilities/agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| The account and the roles it holds in each Graph | [AC-F01](../../../access/features/AC-F01-sign-in-account-and-sessions/feature.md#engine) |

### Routes

| Route, install-wide | Does | Story |
|---|---|---|
| `GET /api/v1/graphs` | The Graphs the reader is a member of, by the list contract — `?q=` the name · `?status=` · `?owner=mine · shared` · `?connector=` · `?role=`. Each: `slug` · `owner` · `name` · `instructions` · `status` · `roles` · `setup {required_done, required_total}` · `needs_me` · `live_runs` | GR-01 |

### Events

| Event | When |
|---|---|
| — | No event of its own; opening a Graph writes nothing |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| — | A Graph the reader is not on is never listed; its address is the membership gate's `404` ([GR-F04](../GR-F04-this-graph/feature.md#refusals)) | — | GR-01.5 · GR-01.9 |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| One read for Home | `GET /api/v1/graphs` returns each Graph with the counts Home shows — set-up progress, what needs the reader, live runs — counted by the engine; Studio never asks per card |
| Only members | The list joins `graphs_members` on the reader; a Graph they leave drops off on the next read |
| Archived | `?status=archived` lists them; a reader whose only Graphs are archived sees them there, never the first run |
| A sample Graph | An ordinary Graph the reader is a member of; nothing writes sample data into another database |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 8 APIs and events | One install-wide list route with Home's counts | — |

## Decisions

| Decision | Detail |
|---|---|
| Home is off any Graph | Plain *Invana* in the wordmark, no Graph picker crumb, no modes |
| The Graph picker replaces a Graphs page | Every Graph I can open is one click from the header; Home is the place to read them, the picker the place to switch |
| Three ways in, one question | An empty install asks *What are you trying to decide?* and offers Create a graph · Start from data · Try a sample Graph |
| Off a Graph, only what works install-wide | No modes, no Inbox, no *This graph*; Records, Agents and Settings stay, each as its own access allows |
| Archived is not first run | A person whose only Graphs are archived sees them under *Archived*, where an Owner restores them |

## Open questions

| Question | Who answers |
|---|---|
| Does Home carry the assistant — a brief across my Graphs, acting in each and answering from one? Recommend: no for now; the assistant's sessions are a Graph's, and Home names what waits on me per Graph with a link to its Inbox | Ravi |

## Not building

| Item | Why not |
|---|---|
| A product launcher | The person works in a mode; everything else is summoned |
| A tour or coach marks | Each empty state names the one step that fills it |
| Writing sample data into a person's database | Their database is theirs; sample data lives in a sample Graph |
| Metrics on Home | Home is where a person picks up their decisions, not a dashboard |
