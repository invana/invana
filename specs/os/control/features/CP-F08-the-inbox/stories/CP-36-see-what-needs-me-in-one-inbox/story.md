---
id: CP-36
title: See what needs me in one inbox
feature: CP-F08
status: idea
personas: [analyst, decision-maker, builder, admin]
boards: [inbox]
---

# CP-36 · See what needs me in one inbox

**As** anyone who uses Invana **I want** one Inbox for the deployment of what needs me and what happened that I should
know, across every product **so that** I act on what matters first and nothing waits unseen.

Tasks: [task.md](task.md) · Feature: [CP-F08](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read their own Needs you and Updates; mark updates read; open what each is about | — |
| Operator | Operator · Modeller: read their own Needs you and Updates; mark updates read; open what each is about ([the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table)) | An item they cannot act on reads, its act disabled with its reason |

## Flow

```mermaid
flowchart LR
  c([A count on the Inbox icon]) --> i["Inbox — Needs you · Updates"]
  t([A toast: a new ask or question]) -->|Review| i
  i -->|nothing| e["Nothing needs you"]
  i --> n["Needs you: asks, then runs waiting on my answer, then project work · open ops alerts sent to me"]
  n -->|an ask| a(["AC-15 · decide it in place"])
  n -->|a run waiting on my answer| q(["Answer it · the run goes on"])
  n -->|an ops alert| oa(["CP-59 · what it is about"])
  oa -->|it closes| cl["Reads closed, naming what closed it · moves to Updates"]
  i --> u["Updates: newest first, unread marked"]
  st([Someone else stops my run · CP-58]) --> u
  u -->|open one| g(["What it is about · marked read"])
  u -->|Mark all read| r["Every update read"]
  i -->|filter: product · Unread| f{"Matches?"}
  f -->|no| z["Nothing matches · Clear filters"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-36.1 | Asks, runs waiting on the reader's answer, open ops alerts sent to the reader and unread updates | any screen in Studio is open | the Inbox icon carries one count: unread updates + asks waiting on the reader + runs waiting on their answer + open ops alerts sent to them |
| CP-36.2 | Nothing waits and nothing is unread | the reader opens the Inbox | Needs you reads *Nothing needs you*, as good news |
| CP-36.3 | No rule has been written | the reader opens Updates | it reads *Nothing needs you*, with *New rule* — failures reach a person only through a rule |
| CP-36.4 | Items waiting | Needs you opens | asks are listed first, nearest deadline first, then runs waiting on the reader's answer, then project work — a task in review (PJ-12), *Start this task?* (PJ-15), an agent's proposal (PJ-05), a new lead (PJ-19) |
| CP-36.5 | A run held on an ask | Needs you is read | it is listed once, as the ask, never also as a run waiting on an answer |
| CP-36.6 | A run waiting on the reader's answer | they answer it | it leaves Needs you and the run goes on where it stopped |
| CP-36.7 | Updates | they are read | newest first, each with its product, its age and a dot while unread |
| CP-36.8 | An update | the reader opens it | it goes to what it is about — a run, a schedule, a change — and is marked read; one with nothing to open is marked read in place |
| CP-36.9 | Unread updates | the reader presses *Mark all read* | every update is read and the count drops by them |
| CP-36.10 | A filter by product or *Unread* | nothing matches | it reads *Nothing matches*, with *Clear filters* |
| CP-36.11 | Studio open on any screen | a new ask or question for the reader arrives | a toast names it with *Review*, which opens it in the Inbox; an update never toasts |
| CP-36.12 | The Inbox opening | its lists are still loading | it opens at once, rows loading in place, the count the last one read |
| CP-36.13 | The engine cannot read the Inbox | it opens | it says what it could not read, with *Try again* |
| CP-36.14 | A row | its product is shown | it is where the thing lives — a load Records', a task's run Projects', a link between models Model's, a typed query Explore's, any other agent run Agents' |
| CP-36.15 | An event on a private project | a rule matches it | only that project's people are told |
| CP-36.16 | An Operator or a Modeller | they open the Inbox | they read their own items; acts they may not take are disabled with their reason |
| CP-36.17 | An open ops alert sent to the reader (CP-59) | Needs you is read | it is listed until it closes; when it closes it reads closed, naming what closed it, and moves to Updates |
| CP-36.18 | A run the reader is behind | someone else stops it (CP-58) | the reader gets an update naming who stopped it, which opens the run |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The Inbox icon and its count | Admin | inbox · Nothing needs you | — | inbox · Loading | inbox | — | — | — |
| The Inbox icon and its count | Operator | inbox · Nothing needs you | — | inbox · Loading | inbox | — | — | inbox |
| Inbox › Needs you | Admin | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · A question from an agent | — |
| Inbox › Needs you | Operator | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · A question from an agent | inbox · Not yours to answer |
| An ops alert in Needs you | Admin | — | — | — | inbox · Ops alert | — | — | — |
| An ops alert in Needs you | Operator | — | — | — | inbox · Ops alert | — | — | — |
| Inbox › Updates | Admin | inbox · Updates · No rules yet | inbox · Updates · Nothing matches | inbox · Loading | inbox · Updates | inbox · Could not load | — | — |
| Inbox › Updates | Operator | inbox · Updates · No rules yet | inbox · Updates · Nothing matches | inbox · Loading | inbox · Updates | inbox · Could not load | — | inbox · Updates |
| A toast | Admin | — | — | — | inbox · Toast | — | inbox · Toast | — |
| A toast | Operator | — | — | — | inbox · Toast | — | inbox · Toast | inbox · Toast |
