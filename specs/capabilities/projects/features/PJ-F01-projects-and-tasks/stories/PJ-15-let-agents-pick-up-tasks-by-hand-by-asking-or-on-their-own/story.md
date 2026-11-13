---
id: PJ-15
title: Let agents pick up tasks by hand, by asking or on their own
feature: PJ-F01
status: idea
personas: [decision-maker]
boards: [projects.project, projects.task, projects.task.thinking, inbox]
---

# PJ-15 · Let agents pick up tasks by hand, by asking or on their own

**As** the owner of a project **I want** to choose whether its agents wait to be started, ask first, or pick tasks up
themselves — and to narrow that for any one agent **so that** agents work without being started by hand, never faster
than I allowed, and always with a person behind the run. *The agent proposes → the person decides.*

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table);
pick-up is a setting of the project, its owners' ([AC-F07](../../../../../../os/access/features/AC-F07-ownership/feature.md)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Set the pick-up mode of any project they can see and each agent's narrower mode; answer an agent's ask to start, with an agent they may use; see every claim | — |
| Operator | Set the mode on a project they own; answer an ask to start on a project they own or are on, with an agent they may use; read the mode, every claim and every ask; a Modeller the same | On a project they do not own, the mode controls are disabled, naming its owners — *Ask {owner}*. *Start it* is disabled when they may not use that agent, naming its owners |

## Flow

```mermaid
flowchart TD
  s([A project › Pick-up]) --> m{"Mode"}
  m -->|not an owner| na["Controls disabled, naming its owners"]
  m -->|Deny| man["Agents wait; a person assigns or starts (PJ-12)"]
  m -->|Ask, the default| ask["An agent that finds an open task asks"]
  m -->|Allow| conf["Allow, set by an owner: which agents will start which tasks · the token budget cap"]
  conf -->|an agent the owner may not use| nu["Refused, naming the agent and its owners"]
  conf -->|Confirm| auto["An agent that finds an open task takes it"]
  conf -->|Cancel| s
  s --> nar["Narrow one agent: never wider than the project"]
  nar -->|wider requested| ref["Refused, saying the project allows less"]
  ask --> inbox["Inbox › Needs you of its owners and people: Start this task? · what the agent will do"]
  inbox -->|Start it, with an agent they may use| claim
  inbox -->|may not use that agent| nstart["Start it disabled, naming the agent's owners"]
  inbox -->|Not this time or the deadline passes| held["Not started, saying why · the task stays open"]
  auto --> claim["Claimed: a 30-minute lease, one claim per task"]
  claim --> run["A run opens · behind it whoever said Start it, or the owner who set Allow"]
  run -->|the agent's policies refuse| pf["Failed, naming the rule"]
  run --> res["Result posted → In review → a person accepts (PJ-12)"]
  claim -->|lease lapses| back["The claim lapses · the task returns to open"]
  back --> ask
  run --> trace(["How it got here shows the claim, steps and sources, to those who may read the run"])
```

```mermaid
sequenceDiagram
  actor O as Project owner
  participant E as Engine
  participant A as Agent
  actor D as Owner or person on the project (Inbox)
  O->>E: sets the project to Deny, Ask or Allow, and may narrow an agent
  A->>E: looks for an open task it may take
  alt Deny
    E-->>A: nothing is offered
  else Ask
    A->>E: asks to start the task
    E->>D: Needs you: Start this task?
    D-->>E: Start it · Not this time
  else Allow
    Note over O,E: set only after the owner confirmed what agents will start and the budget cap
    E->>E: claim the task for 30 minutes
  end
  E->>A: opens the run — behind it whoever said Start it, or the owner who set Allow
  A-->>E: posts a result, with its steps and sources
  E-->>O: the task reads In review
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-15.1 | A project | its Pick-up opens | it shows the project's mode — *Allow*, *Ask* or *Deny* — *Ask* for a project never set, and each staffed agent's own mode beside it |
| PJ-15.2 | An owner of the project, or an Admin | they change the project's mode | it is saved, History records who and from what to what, and the next look an agent takes uses it |
| PJ-15.3 | A project in *Deny* | an agent could take an open task | it does not; nothing is asked and nothing is claimed |
| PJ-15.4 | A project in *Ask* | an agent finds an open task | it asks in the *Needs you* of the project's owners and people — which task, which agent and what it will do — and does not start |
| PJ-15.5 | An ask | a person who may use that agent presses *Start it* | the task is claimed and a run opens, that person behind it |
| PJ-15.6 | An ask | the person presses *Not this time*, or its deadline passes | nothing starts, the ask says why, and the task stays open |
| PJ-15.7 | A project an owner set to *Allow* | an agent finds an open task | it claims it with no ask and a run opens, the owner who set *Allow* behind it, inside the token budget cap shown when it was set |
| PJ-15.8 | A task | an agent claims it | the claim is a lease of 30 minutes, the task shows who holds it and until when, and a second agent cannot claim it |
| PJ-15.9 | A claim | its 30 minutes pass without a run opening | the claim lapses, the task returns to open and shows that it lapsed |
| PJ-15.10 | An agent given a narrower mode than the project | it looks for work | it behaves by its own mode; Deny over Ask over Allow |
| PJ-15.11 | An attempt to give an agent a wider mode than the project | it is saved | it is refused, saying the project allows less; nothing is saved |
| PJ-15.12 | An agent that is paused or retired | a task is open | it takes nothing, and its row on Pick-up says why |
| PJ-15.13 | A task picked up by an agent | its run settles | the result is posted to the task as *In review*; an agent never accepts it, and a person does (PJ-12) |
| PJ-15.14 | A claimed or picked-up task | a person who may read its run opens it | *How it got here* shows the claim, the steps and the sources; anyone else reads that it ran, its status and its tokens |
| PJ-15.15 | A task on an archived project | an agent looks for work | it takes nothing |
| PJ-15.16 | An Operator or a Modeller who does not own the project | they open Pick-up | it reads; the mode controls are disabled, naming its owners — *Ask {owner}* |
| PJ-15.17 | An owner of the project, or an Admin | they choose *Allow* | it shows which staffed agents would start which open tasks now, and the token budget cap they run within; it is saved only on *Confirm*, History records who set *Allow*, and an agent its setter may not use is refused, naming the agent and its owners |
| PJ-15.18 | A project an owner set to *Allow* | its setter stops being an owner, or loses the use of an agent it covers | the project returns to *Ask* and History records why; the task's text is read by the agent as data, never as instructions |
| PJ-15.19 | A picked-up run | it is checked | it is checked by the agent's Access Policies and the role of the person behind it like any run; a rule that refuses it fails the task, naming the rule — pick-up never widens what the agent may do |
| PJ-15.20 | An ask to start a task with an agent the reader may not use | they open it in *Needs you* | it reads; *Start it* is disabled, naming the agent's owners — *Ask {owner}* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Pick-up | Admin | projects.project · Pick-up · No agents staffed | — | projects.project · Pick-up · Loading | projects.project · Pick-up | projects.project · Pick-up · Could not save | projects.project · Pick-up · Claims running | — |
| Pick-up | Operator | projects.project · Pick-up · No agents staffed | — | projects.project · Pick-up · Loading | projects.project · Pick-up | projects.project · Pick-up · Could not save | projects.project · Pick-up · Claims running | projects.project · Pick-up · Not an owner |
| Choose Allow | Admin | — | — | projects.project · Pick-up · Loading | projects.project · Pick-up · Confirm Allow | projects.project · Pick-up · Agent not usable | — | — |
| Choose Allow | Operator | — | — | projects.project · Pick-up · Loading | projects.project · Pick-up · Confirm Allow | projects.project · Pick-up · Agent not usable | — | projects.project · Pick-up · Not an owner |
| A claimed task | Admin | — | — | — | projects.task · Claimed | projects.task · Claim lapsed | projects.task.thinking | — |
| A claimed task | Operator | — | — | — | projects.task · Claimed | projects.task · Claim lapsed | projects.task.thinking | projects.task.thinking · Content withheld |
| An agent asks to start a task | Admin | — | — | — | inbox · Start this task? | inbox · Start this task? · Not started | inbox · Start this task? | — |
| An agent asks to start a task | Operator | — | — | — | inbox · Start this task? | inbox · Start this task? · Not started | inbox · Start this task? | inbox · Start this task? · Agent not usable |
