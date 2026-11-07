---
id: ST-31
title: A denied agent asks for more
feature: ST-F02
status: idea
personas: [owner, builder, analyst]
boards: [inbox, agents.run]
---

# ST-31 · A denied agent asks for more

**As** someone whose agent was denied by a mode **I want** the agent to ask for more in Needs you, naming the mode,
its level and who set it **so that** work is not lost to a Deny nobody meant — the agent proposes the wider mode, and
a person who may change it decides.

Tasks: [task.md](task.md) · Feature: [ST-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every ask for more; decide one routed to them — *Allow* for this run, N days or always, or *Decline* | An ask routed to others reads, its acts disabled, naming who it waits on |
| Operator | Read every ask for more; decide one routed to them | An ask routed to others reads, its acts disabled, naming who it waits on. *Always* is offered only to someone who may change that mode's line |

## Flow

```mermaid
flowchart LR
  s([An agent's step]) --> b{"Its mode"}
  b -->|Deny| r["Refused before it runs · names the mode, level and who set it"]
  r --> a["The agent asks for more · the step holds, the run carries on"]
  a --> n["IN-01 · Needs you: what it wants to do, the mode that denies it, who set it, why routed here"]
  n --> w{"Routed to the reader?"}
  w -->|no| ro["Acts disabled, naming who it waits on"]
  w -->|yes| d{"Decide"}
  d -->|Allow · for this run| go(["The step runs · the mode is unchanged"])
  d -->|Allow · N days · always| line(["The line's mode is set · who it changes shown first"])
  d -->|Decline, with a note| no(["The step ends refused"])
  n -->|deadline · its run ends| ex(["Expired · the step ends refused"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| ST-31.1 | An agent's step whose mode is Deny | it is about to run | it is refused before it runs, naming the mode, its level and who set it; nothing is spent |
| ST-31.2 | A refused step | the agent asks for more | one ask appears in Needs you; the step holds and the rest of the run carries on |
| ST-31.3 | An ask for more | it is read | it shows what the step would do, exactly; the mode that denies it, its level and who set it; who asked and on whose behalf; and the mode it asks for |
| ST-31.4 | An ask for more | it is raised | it is routed to whoever may change the mode at the level that denied it — someone who can manage people for a rule, someone who can build agents for the agent's own — and says which |
| ST-31.5 | An ask for more, routed to the reader | they press *Allow* for this run | that step runs for that agent, in this run only; no mode changes |
| ST-31.6 | An ask for more, routed to someone who may change that line | they pick N days or always | *Who it changes* shows first; on confirm the line's mode is set, naming them, until the time picked |
| ST-31.7 | An ask for more about an access change | it is read | *Allow* lets this one change go; N days and always are not offered — an access change is never Allow for an agent |
| ST-31.8 | An ask for more | the reader declines with a note, or it expires, or its run ends | the step ends refused; the note is kept |
| ST-31.9 | An agent already asked for an item in this run | it is denied the same item again | it does not ask again; the step is refused, naming the open or decided ask |
| ST-31.10 | An agent | it tries to decide its own ask or to change a mode | it is refused; only a person decides |
| ST-31.11 | An Operator the ask is not routed to | they open it | it reads; the acts are disabled, naming who it waits on |
| ST-31.12 | A denied step | the reader opens *How it got here* on its run | it shows the step, the mode that denied it, its level, who set it, and the ask with its answer |
| ST-31.13 | Any Deny, on any item | an agent's step is denied | the agent may ask for more, once per run per item; no setting stops it asking |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| An ask for more | Admin | — | — | inbox · Loading | inbox · Asks for more | inbox · Already decided | inbox · An agent asks for more | — |
| An ask for more | Operator | — | — | inbox · Loading | inbox · Asks for more | inbox · Already decided | inbox · An agent asks for more | inbox · Not yours to answer |
| The denied step on its run | Admin | — | — | agents.run · Loading | agents.run · Denied by a mode | agents.run · Refused | agents.run · Waiting on an ask for more | — |
| The denied step on its run | Operator | — | — | agents.run · Loading | agents.run · Denied by a mode | agents.run · Refused | agents.run · Waiting on an ask for more | agents.run · Denied by a mode |
