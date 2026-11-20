---
id: CP-60
title: Tune when ops alerts fire
feature: CP-F11
status: idea
personas: [admin]
boards: [settings.alerts]
---

# CP-60 · Tune when ops alerts fire

**As** an Admin **I want** to set how many refusals, how long a stall, and which share of a limit raise an ops alert,
and which acts in History tell whom **so that** alerts reach people when something needs them, and not so often that
they stop reading them.

Tasks: [task.md](task.md) · Feature: [CP-F11](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | With Edit on `setting/deployment`: read and set each kind's threshold; read, write, switch off and remove History alerts | — |
| Operator | read each kind, its threshold and whom it reaches; read every History alert ([the permission catalogue](../../../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)) | *Edit*, *New History alert* and a History alert's switch disabled — *Needs Edit on Deployment settings — ask {who can grant}* |

## Flow

```mermaid
flowchart TD
  s([Settings › Workers › Alerts › Thresholds]) --> l["Each kind: its threshold · its window · whom it reaches"]
  l -->|without Edit on setting/deployment| ro["Reads · Edit disabled, naming the permission"]
  l -->|Edit · Admin| e["Threshold · window"]
  e -->|outside its range| r["Names the field and its range"]
  e -->|Save| ok(["Saved · applies from the next check · History row"])
  l -->|could not load| f["What could not be read · Retry"]
  s --> h["History alerts — each: what it matches · whom it tells · last fired · on"]
  h -->|none yet| he["No History alerts yet · New History alert"]
  h -->|without Edit on setting/deployment| hro["Reads · New History alert, switch and Edit disabled, naming the permission"]
  h -->|New History alert · Admin| hn["What was done · what it touched · allowed or refused and why · a count in a window · users and teams to tell"]
  hn -->|nothing to match or no one to tell| hx["Refused, naming the field"] --> hn
  hn -->|Save| hok(["Saved · on · matches History rows written from now · History row"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-60.1 | Thresholds | they are read | each kind reads its threshold, its window where it has one, and whom it reaches; *data from a schema-only workflow* reads *every call*, fixed; *recently added decider* reads *30 days*, fixed; *History match* reads *set on each History alert* |
| CP-60.2 | An Admin | they set *repeated refusals* to 10 in 30 minutes and save | it applies from the next check; an alert already open stays open |
| CP-60.3 | A threshold or window outside its range | it is saved | *{field}: {min} to {max}*; nothing changes |
| CP-60.4 | An Operator | they read Thresholds | *Edit* is disabled — *Needs Edit on Deployment settings — ask {who can grant}*; the route answers 403 with the same sentence |
| CP-60.5 | A threshold change | it is saved | History holds a row naming the kind, the old and new values and who |
| CP-60.6 | A fresh deployment | Thresholds is read | each kind reads its default: refusals 5 in 10 minutes · over a limit at 100% · stuck after 15 minutes · unreachable and skipped at once |
| CP-60.7 | The read fails | Thresholds is opened | what could not be read, in the engine's words, and *Retry* |
| CP-37.21 | An Admin | they press *Edit* on a threshold and save | *Saving* reads, then *Saved* shows the new value; a value outside its range reads *Out of range* naming the field, with the typed value kept |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Thresholds | Admin | settings.alerts · Settings · Defaults | — | settings.alerts · Settings · Loading | settings.alerts · Settings | settings.alerts · Settings · Out of range | — | — |
| Thresholds | Operator | settings.alerts · Settings · Defaults | — | settings.alerts · Settings · Loading | settings.alerts · Settings | settings.alerts · Settings · Could not load | — | settings.alerts · Settings · Read only |
| Thresholds · Edit | Admin | — | — | settings.alerts · Settings · Saving | settings.alerts · Settings · Edit | settings.alerts · Settings · Out of range | — | — |
| Thresholds · Edit | Operator | — | — | — | — | — | — | settings.alerts · Settings · Read only |
| Thresholds · Saved | Admin | — | — | — | settings.alerts · Settings · Saved | — | — | — |
| Thresholds · Saved | Operator | — | — | — | — | — | — | settings.alerts · Settings · Read only |
