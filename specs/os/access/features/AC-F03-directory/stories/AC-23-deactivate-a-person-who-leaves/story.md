---
id: AC-23
title: Deactivate a person who leaves
feature: AC-F03
status: idea
personas: [admin]
boards: [settings.people]
---

# AC-23 · Deactivate a person who leaves

**As** an Admin **I want** to deactivate a person who leaves and name their successor, who takes every place they
held on the work **so that** they cannot act from then on, no work waits on them, and their work keeps its name.

Tasks: [task.md](task.md) · Feature: [AC-F03](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Deactivate a person, naming a successor; choose whether the leaver's tasks go to the successor or back to *Open*; reactivate them. Each asks them to sign in again | Their own row has no *Deactivate*; an Admin's row has none while only two Admins are active |
| Operator | Read who is deactivated, by whom, when and who succeeded them | *Deactivate* and *Reactivate* disabled — *Needs Edit on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  s([Users › a person]) --> d["Deactivate"]
  d --> chk{"Themselves · one of only two active Admins?"}
  chk -->|yes| no["Refused · names why"]
  chk -->|no| o["What they hold: slots · personal agents · chats · personal keys"]
  o --> su["Successor — pick an active person"]
  su --> tk{"Their tasks"}
  tk -->|to the successor| pw
  tk -->|back to Open| pw
  o -->|Export their data first| ex(["AC-47"])
  pw{"Sign in again"} --> done(["Deactivated · sessions end · personal keys revoked · History"])
  done --> sl["Each slot falls back: approver → other approvers → Admins · project team place → successor · chats → successor"]
  done --> ag["Personal agents retire · kept, granted to no one"]
  done --> nm["Their name stays on their work · marked Deactivated"]
  done --> sch(["Schedules and pick-ups keep running with the successor as their setter · the first setter stays recorded"])
  done -->|Reactivate| re(["Active again · nothing handed on returns"])
  s -->|not an Admin| ro(["Reads · Deactivate disabled, naming the Admins"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-23.1 | An Admin on an active person's row | they choose *Deactivate* | a modal lists, with the engine's counts, each slot the person holds — approver, project team place, task assignee, schedule or pick-up setter — and their personal agents, their chats outside projects and their personal keys, and where each goes |
| AC-23.2 | The modal | the Admin picks an active person as successor, chooses where the tasks go and signs in again | the person is deactivated; the successor takes every chat they started outside a project; tasks assigned to them go to the successor or back to *Open*, as chosen; their slots fall back as [AC-F07 › Slots and fallbacks](../../../AC-F07-ownership/feature.md#slots-and-fallbacks) says |
| AC-23.3 | Deactivating | it is sent with no successor, or a successor who is not an active person | it is refused — *Name an active person to take over from {person}* |
| AC-23.4 | A deactivated person | they sign in, or a key of theirs is used | it is refused — *This account is deactivated*; every session they had ended at deactivation and every personal key of theirs is revoked; project keys they minted keep working |
| AC-23.5 | Schedules and pick-up the person set | their next firing comes | it runs with the successor recorded behind it — inside a project within the project's policies, outside one within the successor's permissions; the person who left stays recorded as who set it first (AG-F07 · PJ-15) |
| AC-23.6 | A run going behind a deactivated person | its next step is checked | it is refused, naming that the person was deactivated; asks they raised close expired |
| AC-23.7 | Two active Admins | someone tries to deactivate either | it is refused — *There are always two Admins — make another first* |
| AC-23.8 | An Admin | they try to deactivate themselves | there is no *Deactivate* on their own row, and the API refuses it — *Ask another Admin to deactivate you* |
| AC-23.9 | The system user or an agent | it is offered for deactivation | there is no *Deactivate*; an agent is retired or taken away from people instead (AC-22.7) |
| AC-23.10 | A deactivated person | their work, boards, findings, authorship and History are read | everything stays, under their name, marked *Deactivated* |
| AC-23.11 | The successor | the deactivation saves | an Update in their Inbox names the person they succeed and counts the chats, tasks and project team places now theirs |
| AC-23.16 | The deactivated person's personal agents | the deactivation saves | each retires: granted to no one, no run starts with it, kept as it was; it reads *Retired — {person} was deactivated* |
| AC-23.12 | A deactivated person | an Admin chooses *Reactivate* and signs in again | they may sign in again with their teams and policies; nothing handed on comes back; their retired personal agents stay retired |
| AC-23.13 | A deactivation or a reactivation | History is read | it shows who did it, to whom, when, the successor and what went where (AC-F06) |
| AC-23.14 | A person without Edit on Access | they open a deactivated person's row | it reads *Deactivated by Lee on 3 March · succeeded by Sam*; *Reactivate* is disabled, naming Edit on Access and who can grant it |
| AC-23.15 | Deactivating could not save | it is sent | nothing changes — no hand-over, no fallback, no retirement — and the modal says why, with *Try again* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Deactivate — what they hold · successor | Admin | settings.people · Deactivate · Holds nothing | — | settings.people · Deactivate · Loading | settings.people · Deactivate | settings.people · Deactivate · Could not save | — | settings.people · Two Admins |
| Deactivate — what they hold · successor | Operator | — | — | — | — | — | — | settings.people · Locked · A person |
| A deactivated person | Admin | — | — | — | settings.people · Deactivated | — | — | — |
| A deactivated person | Operator | — | — | — | settings.people · Locked · Deactivated | — | — | settings.people · Locked · Deactivated |
