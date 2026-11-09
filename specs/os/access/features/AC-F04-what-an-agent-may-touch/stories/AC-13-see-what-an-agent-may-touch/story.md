---
id: AC-13
title: See what an agent may touch
feature: AC-F04
status: idea
personas: [owner, builder]
boards: [settings.access, shell.locked]
---

# AC-13 · See what an agent may touch

**As** the owner of a Graph **I want** one read of everything an agent may touch — every connector, data, AI model,
plugin, tool, skill and agent — with its mode in the Graph and for the agent, and who set each **so that** I know
before any run what it will do on its own, what it will ask about, and what it is denied, and where to change it.

Tasks: [task.md](task.md) · Feature: [AC-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every item's mode at every level and who set it; open the line or the agent's sheet that sets it | — |
| Operator | Read every item's mode at every level and who set it | *Change* opens the line read-only; editing it is shown as *Ask Priya*, naming someone who can manage people. With *Can build agents*: changes the agent's own modes on its sheet (AG-21) |

## Flow

```mermaid
flowchart TD
  t([People and access › Agents › an agent]) --> w["What it may touch · grouped: connectors · data · AI models · plugins · tools · skills · agents"]
  w --> row["Each item: this Graph · this agent · in effect — Allow · Ask · Deny · who set it"]
  w -->|filter by mode or by group| f{"Anything matches?"}
  f -->|no| nm["Nothing matches · Clear filters"]
  row -->|no line reaches it| df["No line — denied"]
  row -->|a built-in rule's starting line| sl["Starting line, naming its rule"]
  row -->|data with no sensitivity| ul["Flagged · Unlabelled"]
  row -->|an access change| ac["Never Allow — fixed"]
  row -->|Change| ch{"Who set it?"}
  ch -->|a rule's line| ln(["AC-04 · the rule, at that line"])
  ch -->|the agent's own| sh(["AG-21 · the agent's sheet"])
  ch -->|the reader may not change it| ask["Ask Priya"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-13.1 | An agent in People and access | *What it may touch* opens | every item it may touch reads, grouped — connectors · data · AI models · plugins · tools · skills · agents — each with its mode in this Graph and for this agent, and the mode in effect |
| AC-13.2 | An item's value | it is read | it names who set it and where — a rule and its line, a built-in rule's starting line, or the agent's own |
| AC-13.3 | Levels that disagree | the mode in effect is read | it is the tightest — Deny over Ask over Allow — and the level that set it is marked |
| AC-13.4 | An item no line reaches | it is read | it reads *No line — denied*; an item reached only by a starting line reads *Starting line*, naming its built-in rule ([Deny by default](../../../../product.md#decisions)) |
| AC-13.5 | An access change | it is read | it is Ask or Deny, never Allow, and says it is fixed |
| AC-13.6 | Data | it is read | each line that reaches data names whether it reaches by sensitivity or by kind, and the kind or the sensitivity; data with no sensitivity is flagged *Unlabelled* |
| AC-13.7 | A filter by mode or by group with no match | it is applied | *Nothing matches*, naming the filter, with *Clear filters* |
| AC-13.8 | An item | the reader presses *Change* | the place that sets it opens — the rule at that line or the agent's sheet; nothing is changed here |
| AC-13.9 | An Operator | they open *What it may touch* | everything reads; *Change* on a rule opens it read-only, its edit shown as *Ask Priya* |
| AC-13.10 | An agent's step | its run is read in *How it got here* | each step names its value, the level and who set it, as they were when that step ran |
| AC-13.11 | A line tightened while a run is going | the run's next step runs | it is held to the tightened line, checked when it runs, never when the run opened; an ask still open on an act the line now denies closes refused, naming the line |
| AC-13.12 | An agent's step | it runs | the engine keeps with it the value that applied, its level, the line's version and who set it; a decision on an ask keeps the hash of the act it decided; *How it got here* reads these, never today's lines. Every change to a line's value, and every Allow that lapses or ends, is a History row (AC-F06) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| What it may touch | Admin | settings.access · What it may touch · Starting lines only | settings.access · What it may touch · Nothing matches | settings.access · What it may touch · Loading | settings.access · What it may touch | settings.access · What it may touch · Could not load | — | — |
| What it may touch | Operator | shell.locked · What it may touch · Starting lines only | shell.locked · What it may touch · Nothing matches | shell.locked · What it may touch · Loading | shell.locked · What it may touch | shell.locked · What it may touch · Could not load | — | shell.locked · What it may touch |
