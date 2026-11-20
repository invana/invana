---
id: PJ-22
title: Set the project team and its Lead agent
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.settings]
---

# PJ-22 · Set the project team and its Lead agent

**As** a person on a project **I want** to put people and agents on its team side by side and tag one agent its
**Lead agent** **so that** an agent coordinates the work, every decision a person must give reaches the team's people,
and nothing stops when one of them leaves.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

Every person on a project's team may change its team; Manage on Projects may on any project. There are no roles inside
a project, and joining grants nothing outside it ([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | On any project: add users, teams and the agents the project's policies let work here, tag one Lead agent, take one off; approve a join where the project is set to *Adding people needs approval* | — |
| Operator | The same on a project they are on; a join on a project that needs approval is asked for | On a project they are not on, *Team* reads, its acts disabled — *Join the team or ask {who can grant}*; an agent access does not allow is disabled — *May not work here* |

## Flow

```mermaid
flowchart TD
  s([A project › Settings › Team]) --> p["People and agents side by side · one agent tagged Lead agent"]
  p -->|not on the team| na["Reads · acts disabled: join the team or ask who can grant it"]
  p --> pol["Each row: the access policy it holds here · chosen from Access · its effect shown"]
  pol -->|an agent with none| nopol["Chooses nothing yet · pick a policy"]
  p --> pause["Pause · Resume a row · it keeps its place and policy, holds nothing meanwhile"]
  p --> inv["Invite an agent from the catalogue"] --> add
  p --> add["Add a user, team or agent"]
  add -->|an agent the project's policies do not allow| ng["Disabled: may not work here"]
  add -->|a person, and Adding people needs approval| apr["Asked · waits for Manage on Projects · History"]
  apr -->|approved| ok
  apr -->|declined| dec(["Not added · the reason kept"])
  add --> ok["Saved · History records who added whom · the assignee picker and pick-up follow"]
  p --> lead["Tag an agent Lead agent"]
  lead -->|a second Lead agent| two["Refused: the project already has its Lead agent"]
  lead --> ok
  p --> off["Take one off"]
  off -->|the last active person| last["Refused: a project keeps at least one person on its team"]
  off --> ok
  ag([The Lead agent tries to decide]) --> prop["Refused · it proposes instead · a person on the team accepts or rejects"]
  leave([A person on the team leaves]) --> succ["Their successor joins the team · with no active person left, an alert to the Admins"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-22.1 | A project | its *Team* tab opens | it shows people, teams and agents side by side, who added each and when; the Lead agent reads *Lead agent* |
| PJ-22.2 | A person on the team | they tag an agent the project's policies allow as *Lead agent* | it is saved, History records who, and the project's thread and triage use it from the next message (PJ-21) |
| PJ-22.3 | A project whose Lead agent changes | the old one had open proposals | they stay open, attributed to the agent that made them |
| PJ-22.4 | An agent the project's policies do not let work here | a person opens the team picker | the agent is disabled — *May not work here*; a call naming it is refused the same way |
| PJ-22.5 | A person added to the team | they open the project | they may do everything inside it — write and assign tasks, accept proposals, plans and results, change its settings and narrow its access — and History records who added them |
| PJ-22.6 | A project with one active person on its team | someone takes them off | it is refused — *A project keeps at least one person on its team.*; nothing changes |
| PJ-22.7 | A project left with a single person on its team | it is saved | it is saved, and *Team* warns that one person decides everything |
| PJ-22.8 | A person on the team who is deactivated | a result waits in review | the other people on the team decide it; their successor joins the team; with no active person left, an alert to the Admins names the project ([AC-23](../../../../../../os/access/features/AC-F03-directory/stories/AC-23-deactivate-a-person-who-leaves/story.md)) |
| PJ-22.9 | A person not on the team, without Manage on Projects | they open *Team* | it reads; every act is disabled — *Join the team or ask {who can grant}*; a call is refused the same way |
| PJ-22.10 | Someone added or taken off | the assignee picker or Pick-up is next read | it lists the team as it is now; taking off an agent removes its narrower pick-up mode, and a claim it holds runs out |
| PJ-22.11 | Anyone joining or leaving the team | a run of the project starts | what it reaches is unchanged — the project's policies ∩ the agent's ceiling; being on the team grants nothing outside the project |
| PJ-22.13 | The Lead agent | it would write a task, a group, a check or a relation on the project, set a goal, change the team or its access, approve its plan or accept a result | the engine refuses it — *Only a person decides — {agent} may propose it.* — and it lands as a proposal in the Needs you of the project's people; *How it got here* shows the proposal's steps and sources |
| PJ-22.14 | A project with a Lead agent | someone tags a second agent | it is refused — *{project} already has {agent} as its Lead agent.*; nothing changes |
| PJ-22.15 | The Lead agent | it assigns an open task to another agent on the team | the task is assigned and a run opens, reaching the project's policies ∩ that agent's ceiling; the assignment is in History |
| PJ-22.16 | The project is set to *Adding people needs approval* | a person on the team adds a person | the join waits as an ask in the Inbox of those with Manage on Projects; approved, they join; declined, the reason is kept; History records both |
| PJ-22.17 | A person, team or agent on the team | its row is read | it reads the access policy it holds in this project, chosen from the one list of Access Policies (AC-03); changing it is saved, History records who and when, and it holds from the next check |
| PJ-22.18 | An agent added to the team | no policy is chosen for it | its row reads *Chooses nothing yet — pick a policy*; it holds nothing here and no task or run starts for it until one is chosen; no default is applied |
| PJ-22.19 | A row | the person opens its effect | a person's reads what their policy lets them do in this project (AC-08); an agent's reads the effective matrix *In* this project ([AC-12.18](../../../../../../os/access/features/AC-F04-what-an-agent-may-touch/stories/AC-12-see-why-an-agent-can-or-cannot/story.md)); without Read on `access/policies` it reads *No access*, naming it and who can grant it |
| PJ-22.20 | A row | the person presses *Pause* | it keeps its place and its policy but holds nothing here — no task is assigned to it, no run starts for it, and its open claims run out; *Resume* restores it; History records both; pausing the last active person is refused as PJ-22.6 says; *Remove* takes it off as before |
| PJ-22.21 | *Invite an agent* | it opens | it lists the agents of the catalogue the project's policies let work here (AG-35), each with its version and what it is for; one the policies do not allow is disabled — *May not work here*; a picked agent is added with no policy until one is chosen |
| PJ-22.22 | The create-project Access step, *Adjust* open (PJ-02.5 · PJ-02.38) | it is read beside this tab | its *People and teams* and *Agents* rows are this tab's first form — the same rows, picker, policies, effect and refusals — and the tab edits afterwards what that step made |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Team | Admin | projects.settings · Team · Only the creator | — | projects.settings · Team · Loading | projects.settings · Team | projects.settings · Team · Last person refused | projects.settings · Team · Lead agent proposing | — |
| Team | Operator | projects.settings · Team · Only the creator | — | projects.settings · Team · Loading | projects.settings · Team | projects.settings · Team · Last person refused | projects.settings · Team · Lead agent proposing | projects.settings · Team · Not on the team |
| Add to the team | Admin | projects.settings · Team · Add | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Added | projects.settings · Team · Agent may not work here | — | — |
| Add to the team | Operator | projects.settings · Team · Add | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Added | projects.settings · Team · Agent may not work here | — | projects.settings · Team · Join asked |
| Access policy and effect | Admin | — | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Access policy | projects.settings · Team · Agent without a policy | — | — |
| Access policy and effect | Operator | — | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Access policy | projects.settings · Team · Agent without a policy | — | projects.settings · Team · Not on the team |
| Pause a row | Admin | — | — | — | projects.settings · Team · Paused | projects.settings · Team · Last person refused | — | — |
| Pause a row | Operator | — | — | — | projects.settings · Team · Paused | projects.settings · Team · Last person refused | — | projects.settings · Team · Not on the team |
| Invite an agent | Admin | projects.settings · Team · Invite an agent | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Invite an agent | projects.settings · Team · Agent may not work here | — | — |
| Invite an agent | Operator | projects.settings · Team · Invite an agent | — | projects.settings · Team · Loading people and agents | projects.settings · Team · Invite an agent | projects.settings · Team · Agent may not work here | — | projects.settings · Team · Not on the team |
| Lead agent | Admin | — | — | — | projects.settings · Team · Lead agent | projects.settings · Team · One person warning | — | — |
| Lead agent | Operator | — | — | — | projects.settings · Team · Lead agent | projects.settings · Team · One person warning | — | projects.settings · Team · Not on the team |
| Team · not on the team | Admin | — | — | — | — | — | — | — |
| Team · not on the team | Operator | — | — | — | — | — | — | projects.settings · Team · Not on the team |
