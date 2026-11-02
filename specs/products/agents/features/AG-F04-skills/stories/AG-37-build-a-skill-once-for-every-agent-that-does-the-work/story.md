---
id: AG-37
title: Build a skill once, for every agent that does the work
feature: AG-F04
status: idea
personas: [admin, builder]
boards: [agents.skills, agents.skill]
---

# AG-37 · Build a skill once, for every agent that does the work

**As** an install admin **I want** to write down once how a piece of work should be done — what it is, when to use it
and its instructions — and see the plan and the functions it uses **so that** every agent doing that work is offered
the same tested approach.

Tasks: [task.md](task.md) · Feature: [AG-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Create a skill, name it, say what it is and when to use it, keep files beside its instructions | — |
| Operator | Read every skill, its versions and the functions it uses | *New skill* disabled, naming *Can build agents* — *Ask Priya (owner)*. With *Can build agents*: as Admin |

## Flow

```mermaid
flowchart LR
  s([Agents › Skills]) -->|New skill| d["An untitled draft, open on its instructions"]
  s -->|a skill| sh["The skill's sheet"]
  d --> n["A name · what it is · when to use it"]
  n -->|name already in the catalogue| nx["Refused, linking the skill that has it"]
  n --> i["Instructions and files beside them — AG-19"]
  i -->|no steps at all| r["Not a skill — offered as a rule"]
  i -->|a line needs an unapproved function| ap["Waits for an Admin — AG-40"]
  i -->|no when to use| wx["Publish refused, naming the field"]
  i --> p(["Published version 1 — offered to the agents it is added to"])
  s -->|cannot build agents| ro["Reads; New skill disabled — Ask Priya (owner)"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-37.1 | Agents › Skills | it opens | each skill reads its name, *vN* or *draft*, its whole *when to use* sentence and its plan's step count |
| AG-37.2 | A builder | they press *New skill* | an *untitled* draft opens on Instructions holding the four headings — Goal · Arguments · Steps · When things go wrong — with *No functions yet* and *Nothing to draw yet* |
| AG-37.3 | A draft | the builder names it | the name is lowercase and hyphenated, up to 64 characters; a name another skill of the install has is refused, linking that skill |
| AG-37.4 | A draft with no *when to use* | the builder publishes | publishing is refused, naming *when to use* |
| AG-37.5 | A skill | it is read | what it is and when to use it read as two fields; *when to use* is the sentence the planner matches on |
| AG-37.6 | A published version | anyone edits the skill | the edit is a draft of the next version; the published version never changes, and every run that named it still opens it |
| AG-37.7 | A skill with only a draft | an agent it is added to runs | the skill is not offered; the list and the sheet read *draft* |
| AG-37.8 | A version | it is saved | it is kept whole as a standard skill folder — `SKILL.md` with its name, what it is, when to use it and its instructions, and `references/`, `scripts/` and `assets/` beside it; Invana's own plan, evals and usage stay beside the folder, never inside `SKILL.md` |
| AG-37.9 | A file in `references/` | a step that needs it runs | it is given to that step as context; it is never drawn as a step |
| AG-37.10 | A file in `scripts/`, or a line that needs a library | the plan is drawn | it becomes a function only once an Admin approves it (AG-40); until then the line is flagged and publishing waits |
| AG-37.11 | The skills that ship with Invana | Skills opens in any graph | *Answer in natural language* is listed and cannot be removed; a builder may publish a new version over it |
| AG-37.12 | Instructions that draw no step | the draft is drawn | it says a playbook with no steps is a rule, and offers to move it to the graph's rules (MO-F06) |
| AG-37.13 | A published skill | its sheet opens | *Functions it needs* lists every function its plan calls, with its bound, read from the plan |
| AG-37.14 | An Operator without *Can build agents* | they open Skills or a skill | everything reads; *New skill* and every write are disabled, naming *Can build agents*, with *Ask Priya (owner)* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Skills — the list | Admin | agents.skills · Shipped only | — | agents.skills · Loading | agents.skills | agents.skills · Could not load | — | — |
| Skills — the list | Operator | agents.skills · Shipped only | — | agents.skills · Loading | agents.skills · Read only | agents.skills · Could not load | — | agents.skills · Read only |
| A new skill | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill · Draft | agents.skill · Name taken | agents.skill · Drawing | — |
| A new skill | Operator | — | — | — | — | — | — | agents.skills · Read only |
| A skill's head and versions | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill | agents.skill · Could not load | — | — |
| A skill's head and versions | Operator | agents.skill · Read only | — | agents.skill · Loading | agents.skill · Read only | agents.skill · Could not load | — | agents.skill · Read only |
| Not a skill — a rule | Admin | — | — | — | agents.skill · No steps | — | — | — |
| Not a skill — a rule | Operator | — | — | — | agents.skill · Read only | — | — | agents.skill · Read only |
