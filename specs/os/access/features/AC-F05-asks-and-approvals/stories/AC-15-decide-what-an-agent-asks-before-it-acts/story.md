---
id: AC-15
title: Decide what an agent asks before it acts
feature: AC-F05
status: idea
milestone: MVP
personas: [admin, builder, analyst]
boards: [inbox]
---

# AC-15 · Decide what an agent asks before it acts

**As** a named approver of an agent **I want** every ask routed to me — a write, a send, a delegation, tokens, a
person's act set to Ask — showing exactly what it will do **so that** nothing set to Ask leaves, changes or spends
without my yes — the agent proposes the act, and I decide whether it goes.

Tasks: [task.md](task.md) · Feature: [AC-F05](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read every pending ask and its content; decide an ask routed to them, or escalated to them | An ask routed to others reads, its acts disabled, naming who it waits on — no permission widens it until it is escalated |
| Operator | Read every pending ask; read the content of asks routed to them and of runs they are behind; decide an ask routed to them | An ask routed to others reads, its acts disabled, naming who it waits on; on a run that is not theirs to read, its content is withheld |

## Flow

```mermaid
flowchart LR
  s([Inbox › Needs you · or a channel's link]) --> a["An ask: who asked, for whom, what it will do, why it is here, time left"]
  a -->|See all it will send| full["The whole message, as it will be sent"]
  a --> w{"Routed to the reader?"}
  w -->|no| ro["Acts disabled, naming who it waits on"]
  ro -->|the run is not theirs to read| wh["Content withheld · kind, agent, approvers, time left"]
  w -->|yes| d{"Decide, in a session"}
  a -->|the run read outside text| ot["The outside text and its origin, fenced as data"]
  ot --> w
  d -->|Send it · Allow| hs{"The act as it runs matches what was shown · within 15 minutes?"}
  hs -->|yes| go(["That step goes, once, in this run only · the run carries on"])
  hs -->|the act changed| chg(["Changed since you approved · nothing runs · a new ask"])
  hs -->|not run in 15 minutes · a retry| lap(["Expired · nothing runs · a new ask"])
  d -->|Not this time · Decline, with a note| no(["Not done · the step ends refused"])
  d -->|decided first by another| f["Already allowed by Sam at 10:02"]
  a -->|unanswered| ex(["AC-32 · reminds · escalates · expires refused"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-15.1 | An agent step that wants to send a message | the step reaches the send | it holds, and an ask appears in Needs you for the people it is routed to; the rest of the run carries on |
| AC-15.2 | An ask to send | it is read | it shows exactly what will be sent — To, Subject and the start of the body — with *See all it will send* opening the whole message as it will go |
| AC-15.3 | Any ask | it is read | it names who asked and on whose behalf (*Sam ▸ Reporting agent*), what it wants in one line, who it is routed to and why, how long it has waited, the deadline as time left, and its run |
| AC-15.4 | An ask | it is raised | it is routed to the named approvers of the agent whose rule said Ask — along a caller chain, the agent that asked — else, with none who can answer, the Admins with a *no approver* alert; never the asker nor whoever it benefits, and never an agent's owner for being one; and it says which |
| AC-15.5 | An ask to send, routed to the reader | they press *Send it* | exactly what was shown is sent, never a re-render, and the run carries on |
| AC-15.6 | An ask routed to the reader | they press *Not this time* or *Decline* with a note | nothing is done, the step ends refused, and the note is kept |
| AC-15.7 | An ask set by a rule's Ask, routed to the reader | they press *Allow* | that step runs for that agent, in this run only — never another step, its children or another run |
| AC-15.8 | Any ask — a delegation, a limit or access | it is decided | only *Allow* — for this step of this run — or *Decline* is offered; nothing an ask allows lasts, and a lasting change reads as *Draft a rule* for an Admin, or *Change the limit* in Limits |
| AC-15.9 | An ask another approver decided first | the reader acts on it | it is refused, reading *Already allowed by Sam at 10:02 UTC on Oct 25* in place of the acts |
| AC-15.10 | An ask nobody decides | its time runs | it reminds, escalates to the Admins, then expires refused (AC-32) |
| AC-15.11 | A pending ask | its run ends — served, failed or stopped | the ask leaves Needs you and closes expired; what it held is not done |
| AC-15.12 | A finished scheduled run whose outward delivery waits | its ask is allowed | the held deliveries are sent; declining leaves the run's own status unchanged |
| AC-15.13 | A breaking model publish | its ask is read | it shows the impact list; *Allow* opens the migration run; declining or expiry leaves the draft unpublished; it is routed to the built-in Modeller agent's approvers, never the requester |
| AC-15.14 | A named approver deactivated or taken off a named team | an ask still names them | the others may decide; with none left it goes to the Admins, with a *no approver* alert |
| AC-15.15 | An agent's ask with more than one way to answer | it is shown in *Needs you* | the agent's recommended answer is marked, with its reason; the person answers with one click |
| AC-15.16 | A person's act that a rule sets to Ask | they take it | it holds, telling them who it waits on; an ask appears in *Needs you* for the approvers of the built-in agent the act runs as, never the asker; the asker's own acts on it are disabled |
| AC-15.17 | An Admin who is not among the people an ask is routed to, before it is escalated | they open it | it reads; the acts are disabled, naming who it waits on |
| AC-15.18 | An Operator the ask is not routed to | they open it | it reads; the acts are disabled, naming who it waits on |
| AC-15.19 | An agent | it tries to allow an ask | it is refused; only a person decides |
| AC-15.20 | A decided ask | History is read | it shows who decided, when, the note, and where the ask was opened from (AC-F06) |
| AC-15.21 | An ask from an agent's run | the reader opens *How it got here* | it shows the run's steps and sources up to the step that asked, and the rule that made it ask, its policy and who saved it |
| AC-15.22 | Any ask | it is read | the engine's record of the act leads — what, to whom, every recipient, outside domains flagged; the asker's words follow, labelled as theirs and shown as plain text with control and direction characters visible; no answer is preselected; the sources the step read are linked |
| AC-15.23 | An ask routed to the reader | they allow it | the engine checks again, at that moment, that the reader may still decide it and every check the act needs; if one fails, the yes is refused, naming the check, and nothing runs |
| AC-15.24 | Any ask | it is raised, then allowed | it stores the exact act — function, arguments, targets and their versions — with a hash; the yes runs only that act; a write whose targets changed since the ask is refused, naming what changed |
| AC-15.25 | An ask delivered to an approver's email, Slack, Teams or webhook | they follow its link | the ask opens in Studio, where they decide it signed in; the channel never decides |
| AC-15.26 | An ask from a person | it is decided by someone who put the asker on a team or gave them the agent in the last 30 days | it goes, and a *recently added decider* alert opens ([CP-59.20](../../../../../control/features/CP-F11-ops-alerting/stories/CP-59-be-told-when-an-agent-or-the-deployment-needs-someone-to-act/story.md)) |
| AC-15.27 | An ask routed to the reader | they decide it with a key, or as an agent | it is refused; only a person's signed-in session decides an ask |
| AC-15.28 | A person at the command line | they run `invana approvals list`, then `approve` or `decline` with a note | the asks routed to them read nearest deadline first, and a decision is held to every rule a decision in Studio is — routed to them, not late, not decided twice |
| AC-15.29 | An ask | it fails to load | it says what could not load, with *Try again* |
| AC-15.30 | Needs you filtered by kind or agent | nothing matches | *Nothing matches*, with *Clear filters* |
| AC-15.31 | An ask on a run the reader is not behind, of an agent they do not own, not routed to them, and they are not an Admin | it is read | it shows that it waits, its kind, its agent, who it waits on and its time left; its act, arguments and what it will send are withheld (AC-31) |
| AC-15.32 | An ask to send | the reader presses *See all it will send* | the whole message reads, with *Back* to the ask, *Not this time* and *Send it all*; *Send it* reads *Sent*, *Not this time* reads *Declined*, a failed send reads *Send failed* with *Try again*, an ask that expired reads *Expired*, and one an approver decided first reads *Already decided* |
| AC-15.33 | An allowed ask | the act about to run — its function, arguments or targets — hashes differently from the one shown | nothing runs; the ask reads *Changed since you approved*, naming what differs; a new ask for the act as it now stands reaches the same approvers, linked from the old one; History records both hashes (NFR-SEC-18) |
| AC-15.34 | An allowed ask | its act has not started 15 minutes after the yes, or the step tries it a second time | nothing runs; the ask reads *Expired* — *The approval expired before it ran* — and a new ask is raised, linked from it; an undecided ask keeps its own deadline (AC-32) |
| AC-15.35 | A run whose context holds outside text — an outside tool's or outside agent's result, a record value stamped third-party, AI-written or unstamped, a loaded file, an imported skill or agent, a recalled memory or hand-off note written by such a run, an issue, a review or a web page | it would send, write outside, ask, propose, change access or Run an outside tool its rule allows | it holds and asks, whatever its policy says; the ask shows the exact outside text fenced as data, where it came from and the act it would steer; reads and answers carry on (NFR-SEC-15) |
| AC-15.36 | An ask raised because the run read outside text | it is read | it says *{agent} read outside text*, lists each excerpt with its origin and link, and no answer is preselected, even with a recommended one |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Needs you — an ask | Admin | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | — |
| Needs you — an ask | Operator | inbox · Nothing needs you | inbox · Nothing matches | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | inbox · Not yours to answer |
| An ask — what it will send | Admin | — | — | inbox · Loading | inbox · See all it will send | inbox · Already decided | inbox · An agent asks to send | — |
| An ask — what it will send | Operator | — | — | inbox · Loading | inbox · See all it will send | inbox · Already decided | inbox · An agent asks to send | inbox · Content withheld |
| A person's ask | Admin | — | — | inbox · Loading | inbox · A person asks | inbox · Already decided | — | — |
| A person's ask | Operator | — | — | inbox · Loading | inbox · A person asks | inbox · Already decided | — | inbox · Not yours to answer |
| An ask · Send it | Admin | — | — | inbox · Sending | inbox · Sent | inbox · Send failed | — | — |
| An ask · Send it | Operator | — | — | — | — | — | — | inbox · Not yours to answer |
| An ask · Not this time | Admin | — | — | — | inbox · Declined | — | — | — |
| An ask · Not this time | Operator | — | — | — | — | — | — | inbox · Not yours to answer |
| An ask · Expired | Admin | — | — | — | inbox · Expired | — | — | — |
| An ask · Expired | Operator | — | — | — | inbox · Expired | — | — | — |
| An ask · Allowed, the act changed | Admin | — | — | — | — | inbox · Allowed · Changed since you approved | — | — |
| An ask · Allowed, the act changed | Operator | — | — | — | — | inbox · Allowed · Changed since you approved | — | inbox · Not yours to answer |
| An ask · Allowed, not run in 15 minutes | Admin | — | — | — | — | inbox · Allowed · Expired | — | — |
| An ask · Allowed, not run in 15 minutes | Operator | — | — | — | — | inbox · Allowed · Expired | — | inbox · Not yours to answer |
| An ask · Read outside text | Admin | — | — | — | inbox · Read outside text | — | inbox · Read outside text | — |
| An ask · Read outside text | Operator | — | — | — | inbox · Read outside text | — | inbox · Read outside text | inbox · Content withheld |
