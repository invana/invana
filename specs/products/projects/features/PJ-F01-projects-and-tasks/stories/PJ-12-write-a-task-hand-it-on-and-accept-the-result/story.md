---
id: PJ-12
title: Write a task, hand it on and accept the result
feature: PJ-F01
status: idea
personas: [analyst, decision-maker]
boards: [projects.list, projects.task, projects.task.thinking]
---

# PJ-12 · Write a task, hand it on and accept the result

**As** anyone with work to get done **I want** to write a task once, with or without a project, hand it to a person or
an agent, watch it run and accept the result **so that** one list tracks both and a stray task has a home without a
"misc" project. For an agent: *the agent proposes → the person decides.*

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Write a task, assign it to a person or an agent, start, answer an agent's question, cancel, accept or reject a result; read every task they may see | A task on a private project they are not staffed on is absent |
| Operator | Read every task they may see, its thread, its runs and its state; open *How it got here* | *New task*, *Assign*, *Start*, *Cancel*, *Accept* and *Reject* disabled, naming *Can work on projects*. *With Can work on projects: as Admin* |

## Flow

```mermaid
flowchart TD
  s([Projects › Tasks]) --> sc{"Which tasks?"}
  sc -->|no project open| all["Every task on the Graph · mine first, titled My tasks"]
  sc -->|a project open| pr["That project's tasks"]
  all --> new
  pr --> new["New task: title · body · project or none · assignee"]
  new -->|Operator| na["New task disabled, naming Can work on projects"]
  new --> who{"Assign to?"}
  who -->|nobody| open["Open · the picker explains staffing"]
  who -->|a person| ap["Assigned · they start it"]
  who -->|an agent| ag["Assigned · one run opens, on behalf of the assigner"]
  ag --> ip["In progress · the steps stream"]
  ip --> out{"What happened?"}
  out -->|asked a question| ni["Needs input · the question is on the task"]
  ni -->|a person answers| ip
  out -->|waits on another task, a paused agent, an open sub-task| bl["Blocked · names what it waits on · reassign offered"]
  out -->|result posted| rv["In review · the result with How it got here"]
  out -->|broke| fl["Failed · the diagnosis on the task"]
  rv --> dec{"A person decides"}
  dec -->|Accept| dn["Done"]
  dec -->|Reject, with a note| rj["The note is on the task · back to Assigned"]
  rj --> ag
  ap --> rv
  open --> ag
  ip -->|Cancel| cn["Cancelled · open sub-tasks cancel with it, and say so"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-12.1 | A Graph with no tasks | a member opens Projects with no project open | it reads *No tasks yet* with *New task* |
| PJ-12.2 | No project open | the Tasks list shows | it lists every task on the Graph, the signed-in person's first under *My tasks*; a task with no project is in this list, never lost |
| PJ-12.3 | A project open | the Tasks list shows | it narrows to that project's tasks while the projects list keeps its place above |
| PJ-12.4 | The Tasks list | counts are drawn | the count of the listed tasks and how many sit in each state come from the engine, not from rows on screen |
| PJ-12.5 | A member who can work on projects | they save a new task with a title and a body | it is created with or without a project, in state *Open* |
| PJ-12.6 | A task with no assignee | its page opens | it reads *Open*, and the assignee picker explains that staffing fills the picker and is not a grant |
| PJ-12.7 | A task | it is assigned to a person | it reads *Assigned* and names them; nothing runs |
| PJ-12.8 | A task | it is assigned to an agent, staffed or not | exactly one run opens, on behalf of whoever assigned it, and the task reads *In progress* |
| PJ-12.9 | A task whose run is going | its page opens | the steps stream in `projects.task.thinking`, and *How it got here* shows the steps and sources so far |
| PJ-12.10 | A run asks a question | it is read | the task reads *Needs input* with the question on its thread; answering resumes the run |
| PJ-12.11 | A task waiting on an unmet dependency, a paused agent, an exhausted token budget or an open sub-task | its page opens | it reads *Blocked*, naming exactly what it waits on, with *Reassign* offered when the agent is paused |
| PJ-12.12 | A run that has posted a result | the task is read | it reads *In review*, shows the result, and *How it got here* shows its steps, sources and assumptions |
| PJ-12.13 | A task in review | a person presses *Accept* | it reads *Done*, History records who accepted it, and nobody but a person can have done so |
| PJ-12.14 | An agent's result | it is posted | the agent cannot accept it; no screen or call offers an agent acceptance |
| PJ-12.15 | A task in review | a person presses *Reject* and writes a note | the note is kept on the task, which returns to *Assigned* and may be started again |
| PJ-12.16 | A run that failed | the task is read | it reads *Failed* with the diagnosis on the task |
| PJ-12.17 | A task with open sub-tasks | its run settles | it stays *In progress*, listing them |
| PJ-12.18 | A task cancelled | its page is read | its open sub-tasks are cancelled with it, and the page says so |
| PJ-12.19 | An archived project | its tasks are read | they are read only; a run already going finishes |
| PJ-12.20 | A task's *Runs* tab | it opens | it shows the Graph's runs filtered to this task, not a list of its own |
| PJ-12.21 | A task on a private project | a member who is not on the project asks for it | it reads as not found |
| PJ-12.22 | An Operator | they open a task | the thread, the state, the runs and *How it got here* read; *New task*, *Assign*, *Start*, *Cancel*, *Accept* and *Reject* are disabled, naming *Can work on projects* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Tasks | Admin | projects.list · No tasks yet | projects.list · No tasks match | projects.list · Loading tasks | projects.list · Tasks | projects.list · Could not load tasks | projects.list · Tasks running | — |
| Tasks | Operator | projects.list · No tasks yet · Read only | projects.list · No tasks match | projects.list · Loading tasks | projects.list · Tasks · Read only | projects.list · Could not load tasks | projects.list · Tasks running | projects.list · Tasks · Read only |
| New task | Admin | projects.task · New | — | — | projects.task · Assign | projects.task · New refused | — | — |
| New task | Operator | — | — | — | — | — | — | projects.list · Tasks · Read only |
| A task | Admin | projects.task · Open | — | projects.task · Loading | projects.task · In review | projects.task · Could not load | projects.task.thinking | — |
| A task | Operator | projects.task · Open · Read only | — | projects.task · Loading | projects.task · In review · Read only | projects.task · Could not load | projects.task.thinking · Read only | projects.task · Read only |
| A task that cannot go on | Admin | — | — | — | projects.task · Blocked | projects.task · Failed | projects.task · Needs input | — |
| A task that cannot go on | Operator | — | — | — | projects.task · Blocked · Read only | projects.task · Failed · Read only | projects.task · Needs input · Read only | projects.task · Read only |
| A closed task | Admin | — | — | — | projects.task · Done | — | — | — |
| A closed task | Operator | — | — | — | projects.task · Done · Read only | — | — | projects.task · Read only |
