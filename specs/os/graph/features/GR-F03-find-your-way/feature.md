---
id: GR-F03
title: Find your way — modes, crumbs, ⌘K, no access
product: GR
status: idea
personas: [analyst, builder, modeller, owner]
stories: [GR-08, GR-09, GR-10, GR-11, GR-12]
journeys: [J05]
boards: [explore.board, explore.board.left_closed, model.board, projects.list, agents.agent, shell.command, shell.locked, settings.me]
depends_on: [GR-F01, AC-F02, AC-F01]
---

# Find your way — modes, crumbs, ⌘K, no access

> The frame every surface sits in: three modes and what is summoned over them, a crumb that says where you are,
> ⌘K to do, open or ask anything, a frame that works your way, and no dead end when you lack the grant. The decision it
> helps make: *where is the thing I need, and who can act on it if I cannot?*

## User journey

Journeys this feature is a step of: [J05 · Join a Graph someone set up](../../../../journeys/J05-join-a-graph-someone-set-up.md)

```mermaid
flowchart TD
  g([A Graph open]) --> m["GR-08 · leftNav: Explore · Model · Projects — the wordmark names the mode"]
  m -->|a summoner: Data · Agents · Inbox · Settings| ov["An overlay over the work · its icon outlined · Esc returns"]
  m -->|switch mode| keep(["Same Graph, the other mode at its landing"])
  ov --> cr["GR-09 · The crumb: Graph › section › item"]
  cr -->|drill in| grow["The overlay's content is replaced · the crumb grows · Back steps up"]
  cr -->|deep| ell["First · … · last two"]
  g --> k["GR-10 · ⌘K: do, open or ask"]
  k -->|a match| open(["The record, section or act opens"])
  k -->|nothing matches| ask["Ask the assistant: the text in its composer, never sent"]
  k -->|not mine to open| hid["Never a hit"]
  g --> pr["GR-11 · My way: close the assistant · collapse the sidebar · light or dark"]
  pr --> kept(["Kept for me, across sessions"])
  g --> na["GR-12 · An act without the grant"]
  na --> who["Ask Priya (owner) — the role named, and who holds it"]
  who -->|asks| inb(["The ask reaches them in the Inbox"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| GR-08 | [Switch mode and keep the open Graph](stories/GR-08-switch-mode-and-keep-the-open-graph/story.md) | idea |
| GR-09 | [Know where I am and step back up](stories/GR-09-know-where-i-am-and-step-back-up/story.md) | idea |
| GR-10 | [Do, open or ask anything from ⌘K](stories/GR-10-do-open-or-ask-anything-from-k/story.md) | idea |
| GR-11 | [Make the frame work my way](stories/GR-11-make-the-frame-work-my-way/story.md) | idea |
| GR-12 | [Read without the grant and see who can act](stories/GR-12-read-without-the-grant-and-see-who-can-act/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Switch mode · open a summoner · follow a crumb | Operator — every member | — |
| Find with ⌘K | Operator — every member; hits are only what they may open | A record they may not open is never a hit |
| Run an act from ⌘K | The role the act needs | The act listed disabled, naming the role |
| Ask the assistant from ⌘K | Operator — every member, on a Graph | Absent off a Graph |
| Close the assistant · collapse the sidebar · pick light or dark | Every signed-in person, for themselves | — |
| Any act a surface offers | The role its feature's Access table names | Disabled, *Ask Priya (owner)* — the role named and who holds it; a surface they may not read at all is absent |

## States

| State | What the person sees |
|---|---|
| First use | ⌘K with nothing typed lists the open mode's sections and acts, and recent records |
| Empty after a filter | ⌘K matches nothing: *Nothing found* and *Ask the assistant* |
| Loading | ⌘K opens at once and fills each group as its list arrives; a mode switch draws the frame at once |
| Has data | ⌘K's hits grouped by where they live; the crumb to the item; the mode lit |
| Failed | A group ⌘K could not read says so in its place; the others still match |
| Agent working or proposing | — the frame shows no agent work of its own; the Inbox's count says what needs the person |
| No access | Every surface reads; each act the person lacks shows *Ask Priya (owner)* with the role named |

## Rules

| Rule | Detail |
|---|---|
| Three modes, summoned overlays | Explore, Model and Projects change main; Data, Agents, Inbox and Settings open over the work and close with Esc |
| The wordmark names the mode | It changes with the mode (`specs/design-language.md` §2); the crumb never repeats it |
| The summoner lights | While an overlay is open, its leftNav icon is outlined |
| Every overlay has an address | It survives a reload and can be shared; an old page address opens its overlay over the last workspace |
| One level of overlay | Never a modal on a modal; a drill-in replaces the overlay's content and its crumb grows |
| Crumb levels | Graph › section › item › drill-in. Tabs are not a level |
| Every crumb but the last links | The last is plain; long names truncate with the full name on hover |
| Deep crumbs fold | More than four segments read first · … · last two; … opens the hidden levels |
| No back links in a page | The crumb is the way up; inside an overlay, Back steps up one level |
| ⌘K reads only what may be opened | Every list it reads is scoped by the engine to the person: their Graphs, and the private projects they are on |
| ⌘K ranks names | Exact, then prefix, then contains; meaning-based matches wait for a vector index and then show as *Related* |
| ⌘K never sends | *Ask the assistant* puts the text in the composer and focuses it; the person still picks the agent and the view before any tokens are spent |
| The Graph's own records are found by asking | An airport or a gene is reached through Explore and the assistant, not ⌘K |
| Preferences are the person's | Theme and the closed assistant follow the person across sessions; the collapsed sidebar is this browser's |
| Light and dark are equals | Every surface, the canvas included, is checked in both; print and export use light |
| Colour carries meaning once | A status reads the same colour everywhere |
| Experimental is shown, not hidden | A mode, summoner or act not yet launched carries an *Experimental* badge; nothing launched depends on one |
| People are named | Rules, schedules and asks name people, never ids; the signed-in person reads *you* |
| Without the grant, the surface stays | The act reads *Ask Priya (owner)* — never a dead end; a surface the person may not read at all is absent |
| Leans on | Access rules and who holds them (AC-F03) · the person's own settings (AC-F01) · the Inbox for an ask (AC-F05) |

## Data touched

| Record | Read or write |
|---|---|
| The lists each mode and summoner serves — boards, conversations, models and kinds, views, agents, skills, projects and tasks, recent runs, Graphs | Read |
| The person's access on the open Graph and who holds each role | Read |
| The person's theme and assistant preference | Read · write |

## Decisions

| Decision | Detail |
|---|---|
| No launcher | The person never picks a product; the leftNav holds the modes and the summoners |
| ⌘K is the one door | *Do, open or ask anything* — acts, records and sections in one palette, with no products to switch between |
| ⌘K matches in the browser | It reads the lists each mode already serves, once per opening, and matches as the person types; a record with no address of its own opens its section |
| Ask is the last ⌘K entry | Whenever something is typed on a Graph; off a Graph there is no assistant |
| The assistant closes, never disappears | Closed, it is reopened from the header; it is always one click away |
| Tools on right-click | A canvas's tools are on its right-click menu, not a toolbar that is always shown |
| Without the grant reads, never hides | An act is disabled with the role it needs and who holds it; a detail surface opens saying *You can read this. Changing it needs …* |

## Open questions

| Question | Who answers |
|---|---|
| Does *Ask Priya (owner)* send an ask to the Inbox, or only name the person? Recommend: it opens an ask in the Inbox naming what the person wanted to do — AC-F03 holds the same question | Ravi |

## Not building

| Item | Why not |
|---|---|
| A product launcher | Three modes and what is summoned replace it |
| ⌘K over the Graph's own records | That is the graph database's, through Explore and the assistant |
| Search history or saved searches | Not asked for |
| A theme editor or per-Graph branding | One product, one look; themes ship with it |
| Switching the assistant off for good | It is always one click away; closing it is enough |
| Per-element saved colours | Colour by kind keeps meaning the same |
