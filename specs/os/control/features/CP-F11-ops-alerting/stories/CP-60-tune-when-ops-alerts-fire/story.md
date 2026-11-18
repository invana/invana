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
| Admin | With Edit on `worker/<group>`: read and set each kind's threshold; read, write, switch off and remove History alerts | — |
| Operator | read each kind, its threshold and whom it reaches; read every History alert ([the permission catalogue](../../../../../access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)) | *Edit*, *New History alert* and a History alert's switch disabled — *Needs Edit on worker/{group} — ask {who can grant}* |

## Flow

```mermaid
flowchart TD
  s([Settings › Workers › Alerts › Thresholds]) --> l["Each kind: its threshold · its window · whom it reaches"]
  l -->|without Edit on worker/<group>| ro["Reads · Edit disabled, naming the permission"]
  l -->|Edit · Admin| e["Threshold · window"]
  e -->|outside its range| r["Names the field and its range"]
  e -->|Save| ok(["Saved · applies from the next check · History row"])
  l -->|could not load| f["What could not be read · Retry"]
  s --> h["History alerts — each: what it matches · whom it tells · last fired · on"]
  h -->|none yet| he["No History alerts yet · New History alert"]
  h -->|without Edit on worker/<group>| hro["Reads · New History alert, switch and Edit disabled, naming the permission"]
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
| CP-60.4 | An Operator | they read Thresholds | *Edit* is disabled — *Needs Edit on worker/{group} — ask {who can grant}*; the route answers 403 with the same sentence |
| CP-60.5 | A threshold change | it is saved | History holds a row naming the kind, the old and new values and who |
| CP-60.6 | A fresh deployment | Thresholds is read | each kind reads its default: refusals 5 in 10 minutes · over a limit at 100% · stuck after 15 minutes · unreachable and skipped at once |
| CP-60.7 | The read fails | Thresholds is opened | what could not be read, in the engine's words, and *Retry* |
| CP-60.8 | An Admin | they write a History alert: what was done, what it touched, allowed or refused and why, optionally a count in a window, and which users or teams to tell | it saves, on; when a new History row matches, a *History match* alert opens (CP-59.21), and the list shows when it last fired |
| CP-60.9 | A new History alert | rows matching it were written before it existed | it does not fire for them; *Last fired* reads *never* until a new row matches |
| CP-60.10 | A History alert with nothing to match or no user or team to tell | it is saved | *{field}: {why}*; nothing is saved |
| CP-60.11 | An Operator | they read History alerts | each reads; *New History alert*, its switch and *Edit* are disabled — *Needs Edit on worker/{group} — ask {who can grant}*; the route answers 403 with the same sentence |
| CP-60.12 | A History alert written, changed, switched or removed | it is saved | History holds a row naming it and who |
| CP-60.13 | No History alert yet | History alerts are read | *No History alerts yet*, with *New History alert* for an Admin |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Thresholds | Admin | settings.alerts · Settings · Defaults | — | settings.alerts · Settings · Loading | settings.alerts · Settings | settings.alerts · Settings · Out of range | — | — |
| Thresholds | Operator | settings.alerts · Settings · Defaults | — | settings.alerts · Settings · Loading | settings.alerts · Settings | settings.alerts · Settings · Could not load | — | settings.alerts · Settings · Edit disabled |
| History alerts | Admin | settings.alerts · Settings · No History alerts | — | settings.alerts · Settings · Loading | settings.alerts · Settings · History alerts | settings.alerts · Settings · Could not load | — | — |
| History alerts | Operator | settings.alerts · Settings · No History alerts | — | settings.alerts · Settings · Loading | settings.alerts · Settings · History alerts · Read only | settings.alerts · Settings · Could not load | — | settings.alerts · Settings · History alerts · Read only |
| New History alert | Admin | settings.alerts · Settings · New | — | — | settings.alerts · Settings · New · Filled | settings.alerts · Settings · New · Refused | — | — |
| New History alert | Operator | — | — | — | — | — | — | settings.alerts · Settings · History alerts · Read only |
| A History alert — edit | Admin | — | — | — | settings.alerts · Settings · History alert | settings.alerts · Settings · History alert refused | — | — |
| A History alert — edit | Operator | — | — | — | — | — | — | settings.alerts · Settings · History alerts · Read only |
