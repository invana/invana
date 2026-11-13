---
id: AG-58
title: Catch an agent or a skill getting worse
feature: AG-F10
status: idea
personas: [builder, admin]
boards: [agents.skill, agents.agent, inbox]
---

# AG-58 · Catch an agent or a skill getting worse

**As** an agent builder **I want** the live version of each agent and skill replayed against its cases whenever
what it depends on moves — its model, the model, a rule or an Access Policy — and every night, with an alert when it
does worse **so that** a change somebody else made is caught the day it lands, not when someone notices.

Tasks: [task.md](task.md) · Feature: [AG-F10](../../feature.md)

## Who can

Running drift now is the Modeller's and the Admin's ([the role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)); an alert reaches the people [its kind names](../../../../../../os/control/features/CP-F11-ops-alerting/feature.md#the-alert-kinds).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every drift run; get the alert as its kind names the Admins; run drift now on any agent or skill not built in | — |
| Operator | Read every drift run and its result. A Modeller runs drift now as an Admin does | *Run drift now* disabled, naming the role — *Needs the Modeller role — ask an Admin* | *Run drift now* disabled, naming the role — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart LR
  m([A model version moves · the model publishes · a rule or an Access Policy it reads changes · nightly]) --> d["The live version's evals again"]
  o([A Modeller or an Admin presses Run drift now]) --> d
  d -->|budget spent| p(["Paused: budget reached"])
  d --> c{"Worse than the last run?"}
  c -->|fewer hard checks pass, or time or tokens past 1.5×| a(["An alert in the Inbox of the agent's named approvers, then the Admins, naming what changed and the numbers"])
  c -->|no| ok(["Recorded on Evals — nothing raised"])
  a -->|open| ev["Evals — the run beside the one before"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-58.1 | A live agent or skill with active cases | its model version moves, the model publishes, a rule or an Access Policy it reads changes, or the night comes | its evals run again on live, in the practice graph database, labelled with what triggered them |
| AG-58.2 | A drift run with fewer hard checks passing, or time or tokens past 1.5× the last | it settles | an alert names the agent or skill, what changed and the numbers, in *Needs you* for the people the alert kind names — the agent's named approvers, then the Admins — and in History |
| AG-58.3 | A drift run no worse than the last | it settles | it is recorded on Evals and nothing is raised |
| AG-58.4 | An alert | a person it reached opens it | Evals opens on the drift run beside the run before it, each case's change marked |
| AG-58.5 | A Modeller or an Admin | they press *Run drift now* | the live version's evals run at once, naming *Run by hand* as what moved |
| AG-58.6 | No active case | a trigger fires | nothing runs, and Evals reads *No eval set — nothing checked* |
| AG-58.7 | An Operator | they open Evals | every drift run reads; *Run drift now* is disabled, naming the role |
| AG-58.8 | A built-in agent or skill | a trigger fires | its drift runs like any other, and the alert reaches the Admins |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Drift on a skill's Evals | Admin | agents.skill · No eval set | — | agents.skill · Loading | agents.skill · Drift | agents.skill · Could not load | agents.skill · Eval running | — |
| Drift on a skill's Evals | Operator | agents.skill · No eval set | — | agents.skill · Loading | agents.skill · Drift | agents.skill · Could not load | agents.skill · Eval running | agents.skill · Drift |
| Drift on an agent's Evals | Admin | agents.agent · No eval set | — | agents.agent · Loading | agents.agent · Drift | agents.agent · Could not load | agents.agent · Eval running | — |
| Drift on an agent's Evals | Operator | agents.agent · No eval set | — | agents.agent · Loading | agents.agent · Drift | agents.agent · Could not load | agents.agent · Eval running | agents.agent · Drift |
| The alert that it got worse | Admin | — | — | inbox · Loading | inbox · Got worse | — | — | — |
| The alert that it got worse | Operator | — | — | inbox · Loading | inbox · Got worse | — | — | inbox · Got worse |
