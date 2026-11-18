---
id: AC-22
title: See every user and attach policies to a person
feature: AC-F03
status: idea
personas: [admin, analyst]
boards: [settings.people]
---

# AC-22 · See every user and attach policies to a person

**As** an Admin **I want** every user of the deployment in one list — people, agents and the system
user — with the Access Policies attached to each person and the agents they may use **so that** I can read who acts here
and change what a person may do by attaching or taking off a policy, on purpose.

Tasks: [task.md](task.md) · Feature: [AC-F03](../../feature.md)

## Who can

A person's access is the Access Policies attached to them and to every team they are on ([AC-F02](../../../AC-F02-access-policies/feature.md#the-permission-catalogue)); there is no role to set.

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read every user; attach a policy to a person or take it off, after its preview (Manage on Access); set a person's default agent (AC-38). Each change asks them to sign in again | Taking *Super user* off its last active holder is refused |
| Operator | Read every user, their teams, the policies attached to them, the agents they may use and their default agent | *Attach a policy*, *Take off* and *Change default agent* disabled — *Needs Manage on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  s([Access › Who]) --> l["Every user · tabs All · People · Agents · System"]
  l --> f["Filter by name, kind, policy or team"]
  f -->|no one matches| fe["Nothing matches · Clear filters"]
  l -->|a person| p["Their policies and how each comes · teams · agents they may use · default agent"]
  p -->|Attach a policy · Take off| g["Pick a policy"] --> gp["Preview: what the person gains or loses (AC-39)"] --> pw{"Sign in again"}
  gp -->|takes Super user off its last holder| rr["Refused · Super user always has a holder"]
  pw --> ok(["From their next step · History"])
  l -->|an agent| a(["The agent's page · its Access Policies (AC-11)"])
  l -->|the system user| sys(["What Invana ships · AC-F07"])
  l -->|without Manage on Access| ro(["Reads · writes disabled, naming the permission and who can grant it"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-22.1 | A signed-in person | they open *Users* | every user reads one row each — name · username · kind (*Person* · *Agent* · *System*) · policies · teams · default agent · *Deactivated* where it applies — with tabs *All · People · Agents · System* and the engine's counts |
| AC-22.2 | A fresh deployment | *Users* is read | the first person, holding *Super user*, the system user and each built-in agent read; the system user reads *Owns what Invana ships · never signs in* and holds no policy |
| AC-22.3 | An agent's or the system user's row | it is read | it offers no *Attach a policy* from here; an agent's row opens its page, with the Access Policies attached to it (AC-11) |
| AC-22.4 | A person with Manage on Access | they attach a policy to a person or take one off, after its preview, and sign in again | the person holds the change from their next step, including a run already going, and Studio clears what it held for them; *History* records who changed whom, which policy, and when (AC-F06) |
| AC-22.5 | *Super user* held by one active person | it is taken off them, or they are deactivated | it is refused — *Super user always has a holder — give it to someone else first* |
| AC-22.13 | A deployment where one active person holds *Super user* | *Users* is read by a holder of Manage on Access | it reads *Name a second holder of Super user*, with the people who could hold it |
| AC-22.6 | A person's row | *Policies* is read | each policy reads with how it reaches them — *Attached to you* or the team's name — and the newcomers' policies read *Newcomer* |
| AC-22.7 | A person with Manage on Access | they attach a policy that allows Run on an agent, or take a direct attachment away, after its preview and signing in again | from their next step the person may use that agent, or may not; a take-away clears what Studio held from that agent for them; History records it |
| AC-22.8 | A person who lost Run on an agent | they start a run with it | it is refused, naming the permission and who can grant it (AC-07) |
| AC-22.9 | A filter that matches no one | it is applied | *Nothing matches* reads, naming the filter, with *Clear filters* |
| AC-22.10 | A person without Manage on Access | they open *Users* | everything reads; *Attach a policy* and *Take off* are disabled, naming Manage on Access and who can grant it; the API refuses the write |
| AC-22.11 | An attachment made with a key | it is sent | it is refused — it needs a person's session |
| AC-22.12 | The users could not load | the list is opened | *Could not load users* reads, with *Try again* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Users | Admin | settings.people · First person | settings.people · Nothing matches | settings.people · Loading | settings.people | settings.people · Could not load | — | — |
| Users | Operator | settings.people · Locked · Users · First person | settings.people · Locked · Users · Nothing matches | settings.people · Locked · Users · Loading | settings.people · Locked · Users | settings.people · Locked · Users · Could not load | — | settings.people · Locked · Users |
| A person — policies and agents | Admin | settings.people · One Super user | — | — | settings.people · A person | settings.people · Super user needs a holder | — | — |
| A person — policies and agents | Operator | — | — | — | settings.people · Locked · A person | — | — | settings.people · Locked · A person |
