---
id: AG-37
title: Build a skill once, for every agent that does the work
feature: AG-F04
status: idea
personas: [builder, admin]
boards: [agents.skills, agents.skill]
---

# AG-37 · Build a skill once, for every agent that does the work

**As** an agent builder **I want** to write down once how a piece of work should be done — what it is, when to use it,
its instructions and what it needs — and see the plan and the functions it uses **so that** every agent doing that work
is offered the same tested approach, within what each agent is allowed.

Tasks: [task.md](task.md) · Feature: [AG-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Create a skill; on any skill not built in: name it, say what it is and when to use it, choose guided or planned, keep files beside its instructions, delete it while it never published; copy a built-in skill | A built-in skill has no Edit or Delete — *Built in — copy it to change it* |
| Modeller | Create a skill — they are its first owner — and copy a built-in skill; act as Admin on the skills they own | On a skill they do not own, every act is disabled, naming its owners — *Only its owners or an Admin — ask Lee* |
| Operator | Read every skill, its owners, versions and what it needs | *New skill*, *Copy* and *Delete* disabled, naming the role — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart LR
  s([Agents › Skills]) -->|New skill| d["An untitled draft, open on its instructions — its maker is its first owner"]
  s -->|a skill| sh["The skill's sheet — its owners in the head"]
  s -->|a built-in skill| bi["Built in · System — no Edit"]
  bi -->|Copy| d
  d --> n["A name · what it is · when to use it"]
  n -->|name already in the catalogue| nx["Refused, linking the skill that has it"]
  n --> i["Instructions and files beside them — AG-19"]
  i -->|no steps at all| r["Not a skill — offered as a rule"]
  i -->|a line needs an unapproved library function| ap["Waits for an Admin — AG-40"]
  i -->|a script not approved| sp["Waits for an Admin — CP-F06"]
  n --> md{"Guided or planned"}
  md -->|planned, the default| i
  md -->|guided| gi["No plan drawn — its needs listed under metadata"] --> i
  gi -->|names something its needs lack| gx["Publish refused, naming it"]
  i -->|no when to use| wx["Publish refused, naming the field"]
  i --> p(["Published version 1 — offered to the agents it is added to"])
  s -->|not Modeller or Admin| ro["Reads; New skill disabled — Needs the Modeller role"]
  sh -->|not an owner| no["Reads; acts disabled — ask its owners"]
  sh -->|Delete| dl{"Ever published, or built in?"}
  dl -->|no| gone(["Deleted — taken off its agents, in History"])
  dl -->|yes| dx["Refused — Remove it from its agents"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-37.1 | Agents › Skills | it opens | each skill reads its name, *vN* or *draft*, its whole *when to use* sentence, its plan's step count, and *Built in* or its owners |
| AG-37.2 | A Modeller or an Admin | they press *New skill* | an *untitled* draft opens on Instructions holding the four headings — Goal · Arguments · Steps · When things go wrong — with *Nothing needed yet* and *Nothing to draw yet*; they are its first owner |
| AG-37.3 | A draft | its owner names it | the name is lowercase and hyphenated, up to 64 characters; a name another skill of the deployment has is refused, linking that skill |
| AG-37.4 | A draft with no *when to use* | its owner publishes | publishing is refused, naming *when to use* |
| AG-37.5 | A skill | it is read | what it is and when to use it read as two fields; *when to use* is the sentence the planner matches on |
| AG-37.6 | A published version | an owner edits the skill | the edit is a draft of the next version; the published version never changes, and every run that named it still opens it |
| AG-37.7 | A skill with only a draft | an agent it is added to runs | the skill is not offered; the list and the sheet read *draft* |
| AG-37.8 | A version | it is saved | it is kept whole as a standard skill folder — `SKILL.md` with `name` and `description` in its front matter, Invana's own fields (when to use, how it runs, model version, a guided skill's needs) under `metadata:`, the instructions as its body, and `references/`, `scripts/` and `assets/` beside it; Invana's plan, evals and usage stay beside the folder, never inside it |
| AG-37.9 | A file in `references/` | a step that needs it runs | it is given to that step as context; it is never drawn as a step |
| AG-37.10 | A line that needs a library | the plan is drawn | it maps only to a function an Admin approved (AG-40); until then the line is flagged and publishing waits |
| AG-37.11 | The default skills | Skills opens | each default skill is listed *Built in*, owned by *System*, its plan drawn; it has no Edit or Delete, an edit through the API or the command line is refused — *{skill} is built in — copy it to change it* — and *Copy* makes a custom skill under a new name, owned by the person who copied it and added to no agent |
| AG-37.12 | Instructions that draw no step | the draft is drawn | it says a playbook with no steps is a rule, and offers to move it to the rules (SE-F07) |
| AG-37.13 | A published skill | its sheet opens | *What it needs* lists every function and workflow its plan calls, with its bound, and every resource it needs — the plugin or tool it runs, the workflow, the kinds it reads or writes and in which graph database — read from the plan |
| AG-37.14 | An Operator | they open Skills or a skill | everything reads; *New skill*, *Copy* and every write are disabled, naming the role — *Needs the Modeller role — ask an Admin*; the API and the command line refuse the same way |
| AG-37.15 | A file in `scripts/` | the draft is saved | it runs unchanged, and only once an Admin approved its exact content (CP-F06); until then it reads *Waiting for an Admin* and a skill that calls it does not publish |
| AG-37.16 | A new skill | it opens | it is *Planned*; its owner may switch it to *Guided*, and the choice is written under `metadata:` in `SKILL.md` |
| AG-37.17 | A plugin that ships skills, switched on | Skills opens | each of its skills is listed *Built in*, owned by *System*, its instructions and plan as the plugin ships them; it cannot be edited or removed, and *Copy* makes one to change |
| AG-37.18 | A skill that never published | an owner deletes it | the skill, its draft and its plan go, it is taken off every agent it was added to, and History records who deleted it |
| AG-37.19 | A skill with a published version | anyone deletes it | it is refused — runs name its versions — with *Remove it from its agents* opening its Agents tab; nothing is deleted |
| AG-37.20 | A Modeller who does not own a skill | they open it | everything reads; every act is disabled, naming its owners — *Only its owners or an Admin — ask Lee*; the API and the command line refuse the same way |
| AG-37.21 | A guided draft | its owner publishes | its needs are the `needs` list under `metadata:`, read on *What it needs*; a function or workflow the instructions name that the list lacks refuses the publish, naming it |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Skills — the list | Admin | agents.skills · Shipped only | — | agents.skills · Loading | agents.skills | agents.skills · Could not load | — | — |
| Skills — the list | Operator | agents.skills · Shipped only | — | agents.skills · Loading | agents.skills · Read only | agents.skills · Could not load | — | agents.skills · Read only |
| A new skill | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill · Draft | agents.skill · Name taken | agents.skill · Drawing | — |
| A new skill | Operator | — | — | — | — | — | — | agents.skills · Read only |
| Guided or planned | Admin | agents.skill · New draft | — | — | agents.skill · Guided | agents.skill · Needs missing | agents.skill · Drawing | — |
| Guided or planned | Operator | agents.skill · Read only | — | — | agents.skill · Guided | — | agents.skill · Drawing | agents.skill · Read only |
| A skill's head and versions | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill | agents.skill · Could not load | — | — |
| A skill's head and versions | Operator | agents.skill · Read only | — | agents.skill · Loading | agents.skill · Read only | agents.skill · Could not load | — | agents.skill · Read only |
| A built-in skill and Copy | Admin | — | — | agents.skill · Loading | agents.skill · Built in | agents.skill · Name taken | — | — |
| A built-in skill and Copy | Operator | — | — | agents.skill · Loading | agents.skill · Built in | agents.skill · Could not load | — | agents.skill · Built in |
| Delete a skill | Admin | — | — | — | agents.skill · Delete | agents.skill · Delete refused | — | — |
| Delete a skill | Operator | — | — | — | — | — | — | agents.skill · Read only |
| Not a skill — a rule | Admin | — | — | — | agents.skill · No steps | — | — | — |
| Not a skill — a rule | Operator | — | — | — | agents.skill · Read only | — | — | agents.skill · Read only |
