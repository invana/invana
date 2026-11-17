---
id: AC-03
title: Read every Access Policy and what it is attached to
feature: AC-F02
status: idea
personas: [admin, builder, analyst]
boards: [settings.policies]
---

# AC-03 · Read every Access Policy and what it is attached to

**As** an Admin **I want** one list of every Access Policy — built in and custom — with the agents each is attached to
**so that** I read what every agent may do in one place instead of piecing it together.

Tasks: [task.md](task.md) · Feature: [AC-F02](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read every policy; *New policy* and *Draft with the assistant* | — |
| Operator | Nothing here: without Read on `access/policies` they never see what a policy holds or hides. A person who holds Read without Edit reads every policy, its rules and the agents it is attached to | *No access* — *Needs Read on access/policies — ask Priya or Lee*; with Read, *New policy* and *Draft with the assistant* disabled — *Needs Edit on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart LR
  s([Access › What they may do › Access Policies]) --> l["Access Policies · N — All · Built in · Custom"]
  l -->|Find a policy| f{"Matches?"}
  f -->|no| e["Nothing matches · Clear filters"]
  f -->|yes| r["A policy: its rules as sentences, the agents it is attached to"]
  l --> r
  r --> d(["AC-04 · its rules · AC-11 · its agents"])
  l -->|could not load| x["Says why · Try again"]
  l -->|not an Admin| ro["Reads · writes name the Admins"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-03.1 | A signed-in person | they open *Access* | the large modal opens over the work at *Access*; *What they may do* holds *Access Policies* beside *Roles*, and *Who* the Directory |
| AC-03.2 | The deployment's policies | the list is read | one row per policy — its title, *Built in* or *Custom*, its rules in a line, the agents it is attached to, its owner and who made it, when it changed; a built-in policy has no *changed* |
| AC-03.3 | The list | it is filtered | tabs *All · Built in · Custom* each carry the engine's count; *Attached to* filters by an agent and *Reaches* by a resource |
| AC-03.4 | The list | the reader types in *Find a policy* | only matching policies show; with none, *Nothing matches* and *Clear filters* |
| AC-03.5 | A deployment with no custom policy | the list is read | the built-in policies show, each attached to its built-in agent; *New policy* leads |
| AC-03.6 | A policy with a Deny rule | its row is read | the line says what it keeps back first — *Denies writing any data* |
| AC-03.7 | A policy's row | *Attached to* is read | it names the agents' avatars and names, built-in agents first; a draft attached to agents reads *Draft — decides nothing* |
| AC-03.8 | A person who holds Read on `access/policies` but not Edit on Access | they open the list | every policy reads; *New policy* and *Draft with the assistant* are disabled, naming Edit on Access and who can grant it |
| AC-03.9 | The list cannot load | the section opens | it says why, with *Try again* |
| AC-03.10 | Access open on a policy | the page reloads | the same tab and policy open again, from the URL |
| AC-03.12 | A person without Read on `access/policies`, an Operator included | they open Access Policies, or ask for the list from the API or the command line | it reads *No access*, naming Read on `access/policies` and who can grant it; no policy, rule or holder is listed |
| AC-03.11 | A person at the command line | they list the policies, or show one by name | every policy reads with its origin, whether it is saved, its rules and its agents; one shown adds its versions — the same reading Studio shows |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Access Policies — the list | Admin | settings.policies · Built in only | settings.policies · Nothing matches | settings.policies · Loading | settings.policies | settings.policies · Could not load | — | — |
| Access Policies — the list | Operator | — | — | — | — | — | — | settings.policies · No access |
