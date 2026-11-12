---
id: AC-15
title: Decide what an agent asks before it acts
feature: AC-F05
status: idea
personas: [owner, builder, analyst]
boards: [inbox]
---

# AC-15 · Decide what an agent asks before it acts

**As** the owner of an agent, a view of the graph or a run **I want** every ask routed to me — access, budget, a
delegation, a send, a question, a person's act set to Ask — showing exactly what it will do **so that** nothing set to Ask leaves, changes or
spends without my yes — the agent proposes the act, and I decide whether it goes.

Tasks: [task.md](task.md) · Feature: [AC-F05](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every pending ask in the Graph; decide an ask routed to them | An ask routed to others reads, its acts disabled, naming who it waits on — being Admin does not widen it |
| Operator | Read every pending ask in the Graph; decide an ask routed to them | An ask routed to others reads, its acts disabled, naming who it waits on |

## Flow

```mermaid
flowchart LR
  s([Inbox › Needs you]) --> a["An ask: who asked, for whom, what it will do, why it is here, time left"]
  a -->|See all it will send| full["The whole message, as it will be sent"]
  a --> w{"Routed to the reader?"}
  w -->|no| ro["Acts disabled, naming who it waits on"]
  w -->|yes| d{"Decide"}
  d -->|Send it · Allow| go(["It goes · the run carries on"])
  d -->|Allow always · a delegation| al(["Added to May delegate to"])
  d -->|Not this time · Decline, with a note| no(["Not sent"])
  d -->|decided first by another| f["Already allowed by ravi at 10:02"]
  a -->|deadline passes · or its run ends| ex(["Expired, not sent"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-15.1 | An agent step that wants to send a message | the step reaches the send | it holds, and an ask appears in Needs you for the people it is routed to; the rest of the run carries on |
| AC-15.2 | An ask to send | it is read | it shows exactly what will be sent — To, Subject and the start of the body — with *See all it will send* opening the whole message as it will go |
| AC-15.3 | Any ask | it is read | it names who asked and on whose behalf (*ravi ▸ Route analyst*), what it wants in one line, who it is routed to and why, how long it has waited, the deadline as time left, and its run |
| AC-15.4 | An ask | it is raised | it is routed by its kind — access to the owner of the view of the graph; a delegation or a send to the target agent's owner; budget to the person who started the run; a question to the task's author; workers to an install admin; more than a line allows to whoever may change that line; a person's act set to Ask to people who hold Allow on it — never to the asker nor whoever it benefits — and says which |
| AC-15.5 | An ask to send, routed to the reader | they press *Send it* | exactly what was shown is sent, never a re-render, and the run carries on |
| AC-15.6 | An ask routed to the reader | they press *Not this time* or *Decline* with a note | nothing is sent, the step ends *not sent*, and the note is kept |
| AC-15.7 | An ask for access, routed to the reader | they press *Allow* | it is allowed for this run, for that agent only, never its children |
| AC-15.8 | An ask to delegate | the reader picks *Allow always* | the target is added to the caller's *May delegate to*; *Allow always* is offered on no other kind |
| AC-15.9 | An ask another approver decided first | the reader acts on it | it is refused, reading *Already allowed by ravi at 10:02 UTC on Oct 25* in place of the acts |
| AC-15.10 | An ask nobody has decided | half the time to its deadline passes | one reminder reaches each approver who has not decided |
| AC-15.11 | An ask nobody decides | its deadline passes | it reads *expired, not sent*; nothing is sent; the approvers and the requester are told in the Inbox |
| AC-15.12 | The engine was down at the deadline | it comes back | the ask expires with the deadline as its time — never approved late |
| AC-15.13 | A pending ask | its run ends — served, failed or stopped | the ask leaves Needs you and closes expired; what it held is not sent |
| AC-15.14 | A finished scheduled run whose outward delivery waits | its ask is allowed | the held deliveries are sent; declining leaves the run's own status unchanged |
| AC-15.15 | A breaking model publish | its ask is read | it shows the impact list; *Allow* opens the migration run; declining or expiry leaves the draft unpublished; it is routed to the Graph's owners other than the requester |
| AC-15.16 | An approver who left the Graph | an ask still names them | the others may decide; with none left it expires at its deadline |
| AC-15.17 | An Owner who is not among the people an ask is routed to | they open it | it reads; the acts are disabled, naming who it waits on |
| AC-15.18 | An Operator the ask is not routed to | they open it | it reads with what it will do; the acts are disabled, naming who it waits on |
| AC-15.19 | An agent | it tries to allow an ask | it is refused; only a person decides |
| AC-15.20 | A decided ask | History is read | it shows who decided, when, and the note (AC-F06) |
| AC-15.21 | An ask from an agent's run | the reader opens *How it got here* | it shows the run's steps and sources up to the step that asked, and the mode that made it ask, its level and who set it |
| AC-15.22 | An agent's ask with more than one way to answer | it is shown in *Needs you* | the agent's recommended answer is marked, with its reason; the person answers with one click |
| AC-15.23 | An ask routed to the reader | they allow it | the engine checks again, at that moment, that the reader may still decide it and every check the act needs; if one fails, the yes is refused, naming the check, and nothing runs |
| AC-15.24 | Any ask | it is raised, then allowed | it stores the exact act — function, arguments, targets and their versions — with a hash; the yes runs only that act; a write whose targets changed since the ask is refused, naming what changed |
| AC-15.25 | Any ask | it is read | the engine's record of the act leads — what, to whom, every recipient, outside domains flagged; the asker's words follow, labelled as theirs and shown as plain text with control and direction characters visible; no answer is preselected; *always* is never the first choice; the sources the step read are linked |
| AC-15.26 | A person's act that a line sets to Ask | they take it | it holds, telling them who it waits on; an ask appears in *Needs you* for people who hold Allow on that act, never the asker nor whoever it benefits; the asker's own acts on it are disabled |
| AC-15.27 | An ask routed to the reader | they decide it with a key, as a service account, or as an agent | it is refused; only a person's signed-in session decides an ask ([Only a person's session decides](../../../../product.md#decisions)) |
| AC-15.28 | An ask from a person | it is decided by someone the asker added to the Graph or to a rule in the last 30 days | it goes, and History records an alert that every Owner is told of |
| AC-15.29 | A person at the command line | they run `invana approvals list`, then `approve` or `decline` with a note | the asks routed to them read nearest deadline first, and a decision is held to every rule a decision in Studio is — routed to them, not late, not decided twice |
| AC-15.30 | An ask past its deadline | someone it is routed to allows or declines it | it is refused, reading *The deadline has passed; it expires, not sent*; nothing runs |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Needs you — an ask | Admin | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | — |
| Needs you — an ask | Operator | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | inbox · Not yours to answer |
| An ask — what it will send | Admin | — | — | inbox · Loading | inbox · See all it will send | inbox · Already decided | inbox · An agent asks to send | — |
| An ask — what it will send | Operator | — | — | inbox · Loading | inbox · See all it will send | inbox · Already decided | inbox · An agent asks to send | inbox · Not yours to answer |
| A person's ask | Admin | — | — | inbox · Loading | inbox · A person asks | inbox · Already decided | — | — |
| A person's ask | Operator | — | — | inbox · Loading | inbox · A person asks | inbox · Already decided | — | inbox · Not yours to answer |
| An ask — expired | Admin | — | — | — | inbox · Expired, not sent | — | — | — |
| An ask — expired | Operator | — | — | — | inbox · Expired, not sent | — | — | inbox · Expired, not sent |
