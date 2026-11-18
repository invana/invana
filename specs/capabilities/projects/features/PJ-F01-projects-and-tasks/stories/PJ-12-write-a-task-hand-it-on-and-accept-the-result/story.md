---
id: PJ-12
title: Write a task, hand it on and accept the result
feature: PJ-F01
status: idea
personas: [analyst, decision-maker]
boards: [projects.tasks, projects.reviews, inbox]
---

# PJ-12 · Write a task, hand it on and accept the result

**As** anyone with work to get done **I want** to write a task once, with or without a project, hand it to a person or
an agent the project allows — or, with no project, one granted to me — watch it run and have a person on the team accept the result **so that** one list tracks both and a stray task has a home
without a "misc" project. For an agent: *the agent proposes → the person decides.*

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* follows the [permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue),
within the projects the person may read; inside a project, with the agents its access allows, each run reaching the project's policies ∩ the agent's ceiling; a task with no project, with the agents granted to them; a result is accepted by the
project's people on the team; a run's content follows [AC-31](../../../../../../os/access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Write a task of a kind the project uses, assign it to a person or an agent — one the project's access allows, or with no project one granted to them — start, answer an agent's question, cancel; accept or send back a result — on any project | A task on a project they may not read: its head only, withheld. — |
| Operator | As a person on the project — or on a task with no project — the same, with the agents the project's access allows — or, with no project, those granted to them; as a person on the team, start and work the tasks assigned to them and post their results; read a task's run as [AC-31](../../../../../../os/access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md) allows | An agent the project's access does not allow is disabled in the picker — *Not allowed in this project*; with no project, an agent not granted to them — *Not granted to you*. Writing a task, *Accept* and *Send back* disabled when not a person on the team — *Join the team to change it* · *Join the team to change it*. A run they may not read: that it ran, its status and its tokens — *How it got here* reads *Content withheld* |

## Flow

```mermaid
flowchart TD
  s([Projects › Tasks]) --> sc{"Which tasks?"}
  sc -->|no project open| all["Every task the reader can see · theirs first, titled My tasks"]
  sc -->|a project open| pr["That project's tasks"]
  all --> new
  pr --> new["New task: kind (PJ-20) · its fields · title · body — what done means · checks (PJ-25) · project or none · group · assignee"]
  new --> who{"Assign to?"}
  who -->|nobody| open["Open · the picker explains the team"]
  who -->|a person| ap["Assigned · they start it"]
  who -->|an agent the project does not allow · with no project, not granted to the assigner| nu["Disabled: not allowed in this project · not granted to you"]
  who -->|an agent the project allows · with no project, granted to the assigner| ag["Assigned · one run opens · in a project: the project's policies ∩ ceiling, the assigner recorded"]
  ag --> ip["In progress · the steps stream to those who may read the run"]
  ip --> out{"What happened?"}
  out -->|asked a question| ni["Needs input · the question is on the task"]
  ni -->|a person answers| ip
  out -->|waits on another task, a paused agent, an open sub-task| bl["Blocked · names what it waits on · reassign offered"]
  out -->|the agent's policies refuse| rf["Failed · Needs {Action} on {Resource name}"]
  out -->|result posted| ck{"Checks? (PJ-25)"}
  ck -->|none, or each passed| rv["In review · in the project's people' Needs you · the result with How it got here"]
  ck -->|one failed| cf["Checks failed · Accept off"]
  cf -->|a person on the team sends it back| rj
  out -->|broke| fl["Failed · the diagnosis on the task"]
  rv -->|reader may not read the run| wh["Ran · status · tokens · Content withheld"]
  rv --> dec{"A person on the team decides"}
  rv -->|not a person on the team| nrv["Accept and Send back disabled: Join the team to change it"]
  dec -->|Accept| dn["Done"]
  dec -->|Send back, with a note| rj["The note is on the task · back to Assigned"]
  rj --> ag
  ap -->|they press Start| ips["In progress · named, no run"]
  ips -->|they post a result| ck
  run([An agent's run needs a helper or a person]) -->|raises a task| new
  rv --> hist["History of the task: who did what, for whom, caused by what"]
  open --> ag
  ip -->|Cancel| cn["Cancelled · every open sub-task at every level cancels with it, and says so"]
  ip -->|break it down| sub["Sub-tasks · any depth for people · bounded by the run's limits for an agent"]
  sub -->|an agent passes its run's limits| sl["Refused · names the limit"]
  sub --> bl
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-12.1 | No task the reader can see | they open Projects with no project open | it reads *No tasks yet* with *New task* |
| PJ-12.2 | No project open | the Tasks list shows | it lists every task the reader can see, theirs first under *My tasks*; a task with no project is in this list, never lost |
| PJ-12.3 | A project open | the Tasks list shows | it narrows to that project's tasks while the projects list keeps its place above |
| PJ-12.4 | The Tasks list | counts are drawn | the count of the listed tasks and how many sit in each state come from the engine, not from rows on screen |
| PJ-12.5 | A person who may read the project, or any person for a task with no project | they save a new task of a kind the project uses, with a title and a body saying what done means | it is created with or without a project, in state *Open*, its kind's fields and default checks with it |
| PJ-12.6 | A task with no assignee | its page opens | it reads *Open*, and the assignee picker explains that the project's team fills the picker and being on it grants nothing |
| PJ-12.7 | A task | it is assigned to a person | it reads *Assigned* and names them; nothing runs |
| PJ-12.8 | A task | it is assigned to an agent the project's access allows — or, for a task with no project, one granted to the assigner | exactly one run opens through that agent, the assigner recorded on it, and the task reads *In progress*; inside a project the run reaches the project's policies ∩ the agent's ceiling, with no project the assigner's reach ∩ the ceiling |
| PJ-12.9 | A task whose run is going | a person who may read the run opens its page | the steps stream in `projects.tasks · Detail · How it got here`, and *How it got here* shows the steps and sources so far |
| PJ-12.10 | A run asks a question | it is read | the task reads *Needs input* with the question on its thread; answering resumes the run |
| PJ-12.11 | A task waiting on an unmet dependency, a paused agent, an exhausted token budget or an open sub-task | its page opens | it reads *Blocked*, naming exactly what it waits on, with *Reassign* offered when the agent is paused |
| PJ-12.12 | A run that has posted a result on a task with no checks, or whose checks all passed | the task is read | it reads *In review* and shows the result; for a reader who may read the run, *How it got here* shows its steps, sources and assumptions |
| PJ-12.13 | A task in review | a person on the project presses *Accept* — the author, for a task with no project | it reads *Done*, History records who accepted it, and nobody but a person can have done so |
| PJ-12.14 | An agent's result | it is posted | the agent cannot accept it; no screen or call offers an agent acceptance |
| PJ-12.15 | A task in review or with checks failed | a person on the team presses *Send back* and writes a note | the note is kept on the task, which returns to *Assigned* and may be started again |
| PJ-12.16 | A run that failed | the task is read | it reads *Failed* with the diagnosis on the task |
| PJ-12.17 | A task with open sub-tasks | its run settles | it stays *In progress*, listing them |
| PJ-12.18 | A task cancelled | its page is read | every open sub-task at every level below it is cancelled with it, and the page says so |
| PJ-12.27 | A person working a task | they add a sub-task to a sub-task, at any depth | it is created under its parent; no depth limit applies to people |
| PJ-12.28 | An agent's run making sub-tasks | one more would pass the run's limits — depth, count or tokens (CP-F04) | it is refused, naming the limit; the run carries on without it |
| PJ-12.29 | A task with any sub-task still open, at any level | the task is read | it reads *Blocked*, naming the open sub-tasks |
| PJ-12.30 | A task with sub-tasks | its counts are read | the engine gives the count by state for each level and a rolled-up total; Studio adds nothing up |
| PJ-12.19 | An archived project | its tasks are read | they are read only, each act disabled, saying it is archived; a run already going finishes |
| PJ-12.20 | A task's *Runs* tab | it opens | it shows the runs (CP-F10) filtered to this task, not a list of its own |
| PJ-12.21 | A task on a project the reader may not read | they open it | its title, kind and state read; its body, result and thread read *Withheld — join the team or ask {who can grant}* |
| PJ-12.22 | An agent the project's access does not allow — or, for a task with no project, not granted to the assigner | they open the assignee picker | the agent is disabled — *Not allowed in this project* · *Not granted to you*; a call that assigns it is refused the same way |
| PJ-12.23 | A task assigned to a person | they press *Start* | it reads *In progress* and names them; no run opens |
| PJ-12.24 | A person working a task | they post a result | it reads *In review* with the result, waiting for a person to accept or send it back |
| PJ-12.25 | An agent's run that needs a helper or a person | it raises a task from inside the run | the task is created in the run's project or none, reads who raised it and from which run, and *How it got here* opens that run for those who may read it |
| PJ-12.26 | A task | its *History* opens | every act on the task and each run's attempts read as one tree — who did it, on whose behalf and caused by what — with a delegated run under the step that opened it; the *on behalf of* line comes from the run, never from the task's text, and a skill reads *offered* or *reported*, never *used* |
| PJ-12.31 | A task in review or with checks failed | Inbox › Needs you is read | the task is listed for the project's people — its author, for a task with no project — and for the person behind its run, with what it is, its project and its age; it opens on the task ([CP-36](../../../../../../os/control/features/CP-F08-the-inbox/stories/CP-36-see-what-needs-me-in-one-inbox/story.md)) |
| PJ-12.32 | A task's run the reader may not read ([AC-31](../../../../../../os/access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)) | they open the task or *How it got here* | the task, its result and its state read; the run reads that it ran, its status and its tokens, and its steps read *Content withheld* |
| PJ-12.33 | A step of a task's run outside its reach — the project's policies ∩ the agent's ceiling inside a project; the person behind it ∩ the ceiling with no project | the run is checked | the task reads *Failed*, naming the rule that refused — a place on the team grants a person nothing outside the project |
| PJ-12.34 | A task in review and a person who is not a person on its project | they open it | the result reads; *Accept* and *Send back* are disabled — *Join the team to change it*; a call is refused the same way |
| PJ-12.35 | Tasks written by or handed to the person, in projects or in none | they open Projects › My tasks | those tasks list across every project, grouped by status, each with its project and kind as badges |
| PJ-12.36 | Results waiting on the person as a person on the team | they open Projects › Reviews | each task in review lists with its project, who posted the result and since when, oldest first; opening one opens the task at its result |
| PJ-12.37 | A person on the team of the project, or a person not on its team, who is not an Admin | they press *New task*, add a check, draw a dependency or make a group | each is disabled — *Join the team to change it*; a call is refused the same way; a person on the team still starts and works the tasks assigned to them |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Tasks | Admin | projects.tasks · No tasks yet | projects.tasks · No tasks match | projects.tasks · Loading tasks | projects.tasks · Tasks | projects.tasks · Could not load tasks | projects.tasks · Tasks running | — |
| Tasks | Operator | projects.tasks · No tasks yet | projects.tasks · No tasks match | projects.tasks · Loading tasks | projects.tasks · Tasks | projects.tasks · Could not load tasks | projects.tasks · Tasks running | — |
| New task | Admin | projects.tasks · New | — | — | projects.tasks · New · Assign | projects.tasks · New · Refused | — | — |
| New task | Operator | projects.tasks · New | — | — | projects.tasks · New · Assign | projects.tasks · New · Refused | — | projects.tasks · New · Assign · Agent not granted |
| A task | Admin | projects.tasks · Detail · Open | — | projects.tasks · Detail · Loading | projects.tasks · Detail · In review | projects.tasks · Detail · Could not load | projects.tasks · Detail · How it got here | — |
| A task | Operator | projects.tasks · Detail · Open | — | projects.tasks · Detail · Loading | projects.tasks · Detail · In review | projects.tasks · Detail · Could not load | projects.tasks · Detail · How it got here | projects.tasks · Detail · How it got here · Content withheld |
| A task that cannot go on | Admin | — | — | — | projects.tasks · Detail · Blocked | projects.tasks · Detail · Failed | projects.tasks · Detail · Needs input | projects.tasks · Detail · Withheld |
| A task that cannot go on | Operator | — | — | — | projects.tasks · Detail · Blocked | projects.tasks · Detail · Failed | projects.tasks · Detail · Needs input | projects.tasks · Detail · Archived |
| A closed task | Admin | — | — | — | projects.tasks · Detail · Done | — | — | projects.tasks · Detail · In review · Not a person on the team |
| A closed task | Operator | — | — | — | projects.tasks · Detail · Done | — | — | projects.tasks · Detail · In review · Not a person on the team |
| A result in Needs you | Admin | — | — | inbox · Loading | inbox · A result to accept | inbox · Could not load | — | — |
| A result in Needs you | Operator | — | — | inbox · Loading | inbox · A result to accept | inbox · Could not load | — | — |
| A task's History | Admin | projects.tasks · Detail · History · Nothing yet | — | projects.tasks · Detail · Loading | projects.tasks · Detail · History | projects.tasks · Detail · Could not load | projects.tasks · Detail · History | — |
| A task's History | Operator | projects.tasks · Detail · History · Nothing yet | — | projects.tasks · Detail · Loading | projects.tasks · Detail · History | projects.tasks · Detail · Could not load | projects.tasks · Detail · History | projects.tasks · Detail · History · Content withheld |
| Reviews on the left | Admin | projects.reviews · Nothing to review | projects.reviews · No review matches | projects.reviews · Loading | projects.reviews | projects.reviews · Could not load | — | — |
| Reviews on the left | Operator | projects.reviews · Nothing to review | projects.reviews · No review matches | projects.reviews · Loading | projects.reviews | projects.reviews · Could not load | — | — |
