---
id: AC-08
title: Test whether someone can do something
feature: AC-F02
status: idea
personas: [owner, builder, analyst]
boards: [settings.access, shell.locked]
---

# AC-08 · Test whether someone can do something

**As** any member **I want** to ask whether a person, an agent or a key may do something to something — and which check
decides — without running anything **so that** access is proven, not guessed.

Tasks: [task.md](task.md) · Feature: [AC-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Test any person, agent or key | — |
| Operator | Test any person, agent or key | — |

## Flow

```mermaid
flowchart LR
  s([Can someone do this?]) --> f["Who · started by · does · to · in a view of the graph"]
  f --> c{"Every check allows?"}
  c -->|yes| y(["Yes · each check that allowed it"])
  c -->|no| n(["No · the first check that refuses, naming its rule or person"])
  f -->|missing who, does or to| w["Waits for them · nothing runs"]
  l([A link carrying the check]) --> f
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-08.1 | Any member | they open *Can someone do this?* from the rules list, a rule or a person | it takes who (a person, an agent or a key) · started by · does · to · in a view of the graph |
| AC-08.2 | A check every check allows | it is run | it reads *Yes*, with each check's verdict — skill needs · its rules · started by · the view · for everyone · a key's own rule |
| AC-08.3 | A check one check refuses | it is run | it reads *No*, naming the first check that refuses and its rule or person — *Analysts can ask lets it ask, not change data* |
| AC-08.4 | A check | it runs | it is the engine's own check, the one a run's steps pass, and it writes nothing |
| AC-08.5 | A link that carries who, does and to | it is opened | the check opens filled and runs once; closing it drops the check from the URL |
| AC-08.6 | Who, does or to missing | the check is read | it waits for them and runs nothing |
| AC-08.7 | An Operator | they test anyone | it works as for someone who can manage people |
| AC-08.8 | A check that could not run | it is read | it says why, with *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Can someone do this? | Admin | settings.access · Ask a check | — | settings.access · Checking | settings.access · No, names the rule | settings.access · Could not check | — | — |
| Can someone do this? | Operator | shell.locked · Ask a check | — | shell.locked · Checking | shell.locked · No, names the rule | shell.locked · Could not check | — | — |
