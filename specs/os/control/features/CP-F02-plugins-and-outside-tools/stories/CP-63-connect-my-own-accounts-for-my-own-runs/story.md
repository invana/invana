---
id: CP-63
title: Connect my own accounts for my own runs
feature: CP-F02
status: idea
personas: [analyst, builder, admin]
boards: [settings.me, settings.plugins, agents.run]
---

# CP-63 · Connect my own accounts for my own runs

**As** an analyst **I want** my own accounts and my own switches to apply only to the runs I start and the helpers
those runs call **so that** I can work with what only I may reach, while shared work never acts as me, never sees what
my account returned, and never stops because of a choice I made.

Tasks: [task.md](task.md) · Feature: [CP-F02](../../feature.md)

## Who can

Roles are [the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | The same as every person for their own connections and switches; read which runs used any person's personal connection | — |
| Operator | Read, for each of their personal connections, the runs that used it; turn a plugin off for the runs they start (CP-04); a Modeller the same | Another person's connections and the runs that used them are absent; what another person's personal connection returned reads withheld |

## Flow

```mermaid
flowchart TD
  r([A step calls an outside server]) --> w{"The agent has a work connection there?"}
  w -->|yes| wk(["Called with the work connection (CP-62)"])
  w -->|no| who{"Did a person start this run, or the run it helps?"}
  who -->|no — a schedule, a pick-up, a service user| rf(["Refused before the call · a Modeller or an Admin attaches a work connection"])
  who -->|yes| pc{"That person has a personal connection there?"}
  pc -->|no or expired| cn(["Refused · Connect your account (CP-43)"])
  pc -->|yes| call(["Called as that person · recorded"])
  call --> cp["What it returned is a copy from their connection"]
  cp -->|that person| sees(["Reads it"])
  cp -->|anyone else| wh(["Withheld — from {person}'s own connection"])
  me([Settings › You › Personal connections]) --> used["Each connection · the runs that used it"]
  sw([My own switch off · CP-04]) --> mine(["Narrows only the runs I start and their helpers"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-63.1 | A run a person started, whose agent has no work connection on a server, and that person's personal connection there | a step calls the server | the call is made with their personal connection, and *What left the platform* names it |
| CP-63.2 | A helper run the person's run delegated to | it calls that server and its agent has no work connection there | it uses the same person's personal connection |
| CP-63.3 | An agent with a work connection on the server | a person who also has a personal connection there starts a run | the work connection is used, never the personal one |
| CP-63.4 | A schedule, a picked-up task or a service user's run | a step needs the server and its agent has no work connection there | it is refused before the call; no person's personal connection is used |
| CP-63.5 | What a personal connection returned — in an answer, a finding, a report or a memory node | another person, an Admin included, opens it | it reads *Withheld — from {person}'s own connection*, with when and who made it (GP-F02) |
| CP-63.6 | A person on *Personal connections* | they open one | it lists the runs that used it, newest first, each opening the run |
| CP-63.7 | A person who turned a plugin or a graph database off for themselves | a run they started, or its helper, needs it | it is refused before it starts, saying they switched it off, with *Turn it on* |
| CP-63.8 | A person's own switch off | a schedule they set, a picked-up task or another person's run needs it | it is unaffected; only the deployment's switch narrows those |
| CP-63.9 | An Operator | they read another person's connections or the runs that used them by any path | they are absent (`404`) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Runs that used my connection | Admin | settings.me · Not used yet | — | settings.me · Loading | settings.me · Runs that used it | settings.me · Could not load | — | — |
| Runs that used my connection | Operator | settings.me · Not used yet | — | settings.me · Loading | settings.me · Runs that used it | settings.me · Could not load | — | — |
| A call refused for a missing connection | Admin | — | — | — | agents.run · No connection | — | agents.run · No connection | — |
| A call refused for a missing connection | Operator | — | — | — | agents.run · No connection | — | agents.run · No connection | — |
| A copy from another person's connection | Admin | — | — | — | agents.run · Withheld · Personal connection | — | — | agents.run · Withheld · Personal connection |
| A copy from another person's connection | Operator | — | — | — | agents.run · Withheld · Personal connection | — | — | agents.run · Withheld · Personal connection |
| My own switch | Admin | settings.plugins · My switch | — | settings.plugins · Loading | settings.plugins · My switch | settings.plugins · Off for the deployment | — | — |
| My own switch | Operator | settings.plugins · My switch | — | settings.plugins · Loading | settings.plugins · My switch | settings.plugins · Off for the deployment | — | — |
