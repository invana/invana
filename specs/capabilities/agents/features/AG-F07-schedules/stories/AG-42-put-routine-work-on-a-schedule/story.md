---
id: AG-42
title: Put routine work on a schedule
feature: AG-F07
status: idea
personas: [analyst, decision-maker, admin]
boards: [agents.schedules, inbox]
---

# AG-42 · Put routine work on a schedule

**As** an analyst **I want** to schedule routine work — a morning digest, a weekly
route report — with no project **so that** it runs itself and lands where I read it.

Tasks: [task.md](task.md) · Feature: [AG-F07](../../feature.md)

## Who can

Schedules are *Acts* for every role in [the role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table); a person acts on a schedule through its agent, granted to them.

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Create, edit, pause, resume, run now and delete a schedule whose agent is granted to them; read every schedule and firing, and open a run as [AC-F09](../../../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#rules) allows | On a schedule whose agent is not granted to them, every act disabled — *Uses {agent}, which is not granted to you* |
| Operator | The same; a Modeller the same | The same |

## Flow

```mermaid
flowchart LR
  s([Agents › Schedules]) -->|none yet| e["Nothing is scheduled · New schedule"]
  s --> n["New schedule"]
  e --> n
  n --> f["What to do · Runs as · Repeat and time · Time zone · Deliver to · If a firing is missed · If the last run is still going · Outward approval"]
  f -->|refused| r["Names the field and why · nothing saved"] --> f
  f --> ok["Saved · next run shown"]
  ok --> p["A schedule: its instructions, firings newest first, where it delivers"]
  p -->|Run now| run["A firing like any other · a run opens"]
  p -->|Pause · Resume| ok
  ret([Its agent is retired]) --> pz["Paused · History names the agent"] -->|another agent · Resume| ok
  p -->|Delete, confirmed| s
  run --> res(["Delivered to the Inbox — a failure says so and opens the run"])
  res -->|outward, approval on| ask["Inbox › Needs you · Send it · Not this time"]
  f -->|outward approval off| conf["What goes where · Confirm sets Allow, naming who set it"] --> ok
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-42.1 | No schedules | a person opens Agents › Schedules | it reads *Nothing is scheduled* with *New schedule* |
| AG-42.2 | A person of any role | they save a schedule naming what to do, an agent granted to them, a repeat, a time zone and where to deliver | it is saved with no project, and its next run reads in their zone |
| AG-42.3 | A new schedule | its repeat is invalid, its time zone unknown, or its agent or a channel is missing | it is refused before saving, the dialog naming the field and why |
| AG-42.4 | A saved schedule | its time comes | a run of the named agent opens with its instructions, acting as the agent, who set the schedule recorded on it, and the firing is kept as *opened* with its run |
| AG-42.5 | A schedule whose last run is still going, *If the last run is still going* = *Skip* | its next firing comes | the firing is kept as *skipped*, saying why; with *Run anyway* a second run opens |
| AG-42.6 | A schedule whose agent is paused | its time comes | the firing is kept as *failed*, naming the agent, and the schedule stays on |
| AG-42.7 | The engine down across several firings, *Run once on recovery* | it comes back | one run opens, marked catch-up, and each other missed firing is kept as *skipped*, saying why |
| AG-42.8 | The same outage, *Run every missed one* · *Skip* | it comes back | one run per missed firing opens, at most 24 · none opens and each is kept as *skipped* |
| AG-42.9 | A firing's run settles | it is delivered | who set it and each recipient have an Inbox row; a failed run is delivered as a failure that opens the run |
| AG-42.10 | A schedule delivering to a channel, outward approval on | its run settles | the delivery waits in the *Needs you* of the agent's named approvers, then the Admins (AC-F05), showing what will be sent and where; *Not this time* or the deadline passing sends nothing, saying why |
| AG-42.11 | A person the schedule's agent is granted to | they switch outward approval off | it shows what goes where — each channel and recipient — and saves only on *Confirm* as Allow, recording who set it and when; once on Allow, a settled run's delivery is sent with no ask, and the schedule names who set it |
| AG-42.12 | A schedule | a person presses *Run now* | a firing marked *run now* is kept and a run opens at once |
| AG-42.13 | A schedule paused, then resumed a day later | it resumes | no firing from the paused day runs; the next firing is the next one from now, and every earlier firing is still listed |
| AG-42.14 | A schedule's page | it is opened | it shows its instructions, where it delivers, and every firing newest first — due time, outcome, reason, *catch-up* or *run now* when so, and *Open run* |
| AG-42.15 | A delivered result or a firing | the person opens its run | *How it got here* shows the run's steps and sources |
| AG-42.16 | A schedule edited by someone other than who set it | it next fires | it runs as its agent, as before; *Set by* still names who set it and *Last edited by* the editor |
| AG-42.17 | A channel a schedule delivers to | an Admin removes the channel | it is refused, naming the schedule |
| AG-42.18 | A person the schedule's agent is not granted to | they open a schedule | it reads; *Run now*, *Pause*, *Resume*, *Edit* and *Delete* are disabled — *Uses {agent}, which is not granted to you* — and the route refuses them |
| AG-42.19 | A schedule whose deliveries are on Allow | anyone edits it, or the person who set Allow loses the right to set it | outward approval returns to Ask, naming why, and History records it |
| AG-42.20 | A schedule's outward approval | a delivery is due | it is a line like any other: the strictest of it and the agent's rules binds, so a Deny on sends in the agent's Access Policies holds whatever the schedule says |
| AG-42.21 | A schedule whose setter is deactivated | it fires | its run acts as its agent as before, and the schedule still names who set it; its text is read as data |
| AG-42.22 | A schedule whose agent is retired | the agent is retired (AG-29.16) | the schedule is paused, History naming the retired agent; it fires again only once a person points it at another agent and resumes it |
| AG-42.23 | Active schedules | a person opens Agents › Schedules | *Coming up* draws the next seven days, one row per active schedule, its repeat as words, a mark on each day it fires — marked failed when its last firing failed; a paused schedule is left out |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Schedules | Admin | agents.schedules · Nothing is scheduled | — | agents.schedules · Loading | agents.schedules | agents.schedules · Could not load | agents.schedules · Running | — |
| Schedules | Operator | agents.schedules · Nothing is scheduled · Read only | — | agents.schedules · Loading | agents.schedules · Read only | agents.schedules · Could not load | agents.schedules · Running | agents.schedules · Read only |
| New schedule | Admin | agents.schedules · New schedule | — | — | agents.schedules · New schedule | agents.schedules · New schedule refused | — | — |
| New schedule | Operator | — | — | — | — | — | — | agents.schedules · Read only |
| Outward approval off | Admin | — | — | — | agents.schedules · Confirm Allow | agents.schedules · New schedule refused | — | — |
| Outward approval off | Operator | — | — | — | agents.schedules · A schedule · Read only | — | — | agents.schedules · Read only |
| A schedule | Admin | agents.schedules · A schedule · No firings yet | — | agents.schedules · A schedule · Loading | agents.schedules · A schedule | agents.schedules · A schedule · Last run failed | agents.schedules · A schedule · Running | — |
| A schedule | Operator | agents.schedules · A schedule · No firings yet | — | agents.schedules · A schedule · Loading | agents.schedules · A schedule · Read only | agents.schedules · A schedule · Last run failed | agents.schedules · A schedule · Running | agents.schedules · A schedule · Read only |
| A delivered result and an outward ask | Admin | — | — | — | inbox · A schedule's result | inbox · A schedule's failed run | inbox · Send this schedule's result? | — |
| A delivered result and an outward ask | Operator | — | — | — | inbox · A schedule's result | inbox · A schedule's failed run | inbox · Send this schedule's result? · Waiting on the approver | — |
