---
id: AC-47
title: Export everything held about a person
feature: AC-F12
status: idea
personas: [admin]
boards: [access.subject_export, settings.people, access.locked]
---

# AC-47 · Export everything held about a person

**As** an Admin answering a person's request for their data **I want** one JSON file of everything the deployment
holds about them — their profile, what they did and their personal-connection data **so that** I can hand them a
complete answer without searching store by store.

Tasks: [task.md](task.md) · Feature: [AC-F12](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Export everything held about any person, active or deactivated, signing in again; read the exports made | — |
| Operator | — ; a Modeller the same | *Export their data* is not offered on a person's row |

## Flow

```mermaid
flowchart TD
  s([Directory › a person]) --> e["Export their data"]
  s -->|not an Admin| no(["Not offered"])
  e --> m["What it holds: profile · what they did · personal-connection data"]
  m --> pw{"Sign in again"}
  pw --> st["The engine streams the JSON"]
  st -->|fails| f["Says why · Try again"]
  st --> ok(["Downloaded · an exports row · History and What left the platform name the subject"])
  d([AC-23 · Deactivate]) -->|before personal data is erased| e
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-47.1 | An Admin on a person's row | they choose *Export their data* | a modal lists what the file holds — profile, what they did, personal-connection data — with the engine's counts, and says it is the one place a person's personal-connection data reaches anyone but them |
| AC-47.2 | The modal | the Admin signs in again | a JSON file downloads with `profile` (username, name, email, role, teams, agents granted, default agent, created, last signed in, deactivated), `work` (History rows they acted in or were behind, their conversations with their turns, tasks they set or were assigned, asks they raised or answered) and `personal_connections` (each server, account, connected and last used, and the copies they returned) |
| AC-47.3 | A personal connection | the file is read | it never holds a token or a secret |
| AC-47.4 | A subject export | History and *What left the platform* are read | one History row and one call in *What left the platform* name who made it, for whom and its size |
| AC-47.5 | A person deactivated | an Admin exports their data | their profile and what they did export; personal-connection data erased at their departure is absent, and the file says so |
| AC-47.6 | An Admin deactivating a person (AC-23) | the modal opens | it offers *Export their data first*, before the erasure it lists |
| AC-47.7 | An agent, a service user or the system user | an export is asked for them | it is refused — *{user} is not a person* |
| AC-47.8 | An Operator or a Modeller | they open a person's row, or call the route | *Export their data* is not offered; the API refuses it |
| AC-47.9 | An export asked with a key | it is sent | it is refused — it needs a person's session |
| AC-47.10 | The export fails while streaming | it is made | no exports row is written; the modal says why, with *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Export their data | Admin | access.subject_export · Nothing done yet | — | access.subject_export · Exporting | access.subject_export | access.subject_export · Could not export | — | — |
| Export their data | Operator | — | — | — | — | — | — | access.locked · A person |
| Export first — in the deactivate modal | Admin | — | — | — | settings.people · Deactivate · Export first | — | — | — |
| Export first — in the deactivate modal | Operator | — | — | — | — | — | — | access.locked · A person |
