---
id: AG-40
title: Turn a library into functions an Admin approves
feature: AG-F08
status: idea
personas: [builder, admin]
boards: [agents.skills]
---

# AG-40 · Turn a library into functions an Admin approves

**As** an agent builder **I want** to add a library by its package and docs and see the functions Invana proposes from
it, and **as** an Admin to approve each one **so that** skills can use the library without anyone writing a script, and
no code reaches a plan that an Admin did not approve. *Invana proposes → the Admin decides.*

Tasks: [task.md](task.md) · Feature: [AG-F08](../../feature.md)

## Who can

*Portable — bring in* in [the permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue); approving code needs Publish · Approve on `skill/<name>`, as approving a skill's script is (CP-F06).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Add a library, read the functions Invana proposes, edit, approve or leave out each | — |
| Operator | Read approved functions, where each comes from and which skills call it. With Create on `plugin/*` (usually *Build agents*), add a library, read and edit the functions Invana proposes | *Approve* is disabled — proposals read *Waiting for an Admin*; without Create, *Add a library* is disabled, naming the permission |

## Flow

```mermaid
flowchart LR
  a([Agents › Skills · Tools they call]) --> l["Create on plugin/* · Add a library — its package and docs"]
  a -->|an Operator| na(["Add a library disabled · names the permission"])
  l --> r["Invana reads them"]
  r -->|the package cannot be found or read| rx["Says why, naming the package"]
  r --> p["Proposed functions — name, inputs, outputs, what each reaches"]
  p -->|Edit| p
  p -->|Admin · Approve| f(["A read-only function, listed under the library"])
  p -->|without Publish · Approve| w(["Waiting for an Admin"])
  p -->|leave it out| o(["Not a function"])
  s([A skill's script]) -->|not a function| sc(["Approved and run as it is — CP-F06"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-40.1 | Agents › Skills | a person with Create on `plugin/*` presses *Add a library* | it asks for the package and its docs |
| AG-40.2 | A package and docs | Invana reads them | it proposes typed functions, each with its name, inputs and outputs as JSON Schema, and what it reaches, with *Edit* per row and, for an Admin, *Approve* |
| AG-40.3 | A proposed function | the Admin approves it | it is listed under *Tools they call* by where it comes from, read-only from then, and skills may call it |
| AG-40.4 | A proposed function the Admin leaves out | a skill's plan names it | the plan is refused before it runs, naming the function |
| AG-40.5 | A script in a skill's `scripts/` | Invana reads the skill | it is not proposed as a function; it is approved and run unchanged as a skill script (CP-F06) |
| AG-40.6 | A library being read | the Admin waits | it reads that Invana is reading the package; the rest of Skills stays usable |
| AG-40.7 | A package that cannot be found or read | Invana reads it | it says why, naming the package; nothing is proposed |
| AG-40.8 | Approved functions | anyone opens *Tools they call* | each lists where it comes from and how many skills call it; one nothing calls reads *not used yet*; proposals still open read *n to review* |
| AG-40.9 | A function from a plugin an Admin disabled | it is listed | it says its plugin is disabled |
| AG-40.10 | An Operator | they open *Tools they call* | approved functions read; *Add a library* is disabled, naming the permission; open proposals read *Waiting for an Admin*; the engine refuses adding a library the same |
| AG-40.11 | Proposed functions | a person with Create on `plugin/*` opens *How it got here* | the steps show which parts of the docs each function was read from |
| AG-40.12 | A person without Publish · Approve on the skill, on a proposed function | they look for *Approve* | it is disabled — *Needs Publish · Approve on skill/{skill} — ask {who can grant}*; the proposal reads *Waiting for an Admin* and every Admin finds it in *Needs you*; the engine refuses an approval from anyone without Publish · Approve |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Tools they call | Admin | agents.skills · No libraries | — | agents.skills · Loading | agents.skills | agents.skills · Could not load | — | — |
| Tools they call | Operator | agents.skills · No libraries | — | agents.skills · Loading | agents.skills | agents.skills · Could not load | — | agents.skills |
| Add a library | Admin | agents.skills · Add a library | — | agents.skills · Add a library · Reading the package | agents.skills · Add a library · Proposed functions | agents.skills · Add a library · Package not found | agents.skills · Add a library · Proposing functions | — |
| Add a library | Operator | — | — | — | agents.skills · Add a library · Waiting for an Admin | — | — | agents.skills · Add a library disabled |
