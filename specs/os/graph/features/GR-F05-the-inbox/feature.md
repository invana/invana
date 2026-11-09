---
id: GR-F05
title: The Inbox — what needs me, and notifications
product: GR
status: idea
personas: [owner, builder, analyst, decision-maker]
stories: [GR-16, GR-17]
journeys: [J03, J04, J06]
boards: [inbox, settings.notifications]
depends_on: [AC-F05, PJ-F02]
---

# The Inbox — what needs me, and notifications

> Every ask that waits on a person (AC-F05) and everything else that should reach them arrives in one Inbox, by rules
> an owner writes. The decision it helps make: *what needs me first?*

## User journey

Journeys this feature is a step of: [J03 · Give an agent work and decide on the result](../../../../journeys/J03-give-an-agent-work-and-decide-on-the-result.md) · [J04 · Build an agent and improve it from what runs teach](../../../../journeys/J04-build-an-agent-and-improve-it-from-what-runs-teach.md) · [J06 · Set what an agent may touch](../../../../journeys/J06-set-what-an-agent-may-touch.md)

```mermaid
flowchart TD
  ev([A person or an agent wants to send, change or spend · an event happens]) --> kind{"What is it?"}
  kind -->|an ask| route(["AC-15 · Routed to whoever owns what is asked for"])
  route --> cnt["GR-16 · A count on the Inbox icon · a toast while Studio is open"]
  kind -->|an event a rule matches| rule["GR-17 · The rule names who hears it, in the Inbox and on which channels"]
  rule --> cnt
  rule -->|a channel fails| retry["Tried three times, then failed with the error · the Inbox row is never lost"]
  cnt --> inbox["GR-16 · Inbox › Needs you · Updates"]
  inbox -->|nothing waits| calm(["Nothing needs you"])
  inbox --> ask(["AC-15 · Decide the ask"])
  inbox --> upd["GR-16 · An update opens what it is about · marked read"]
  inbox -->|project work| pj(["PJ-17 · results, questions and passes to judge"])
  set([Settings › Notifications]) --> r5["GR-17 · Rules and channels"]
  r5 -->|not an owner| r5ro["Reads · New rule and Add channel disabled, naming the owners"]
```

## Stories

| ID | Story | Status |
|---|---|---|
| GR-16 | [See what needs me in one inbox](stories/GR-16-see-what-needs-me-in-one-inbox/story.md) | idea |
| GR-17 | [Say which events reach whom, and where](stories/GR-17-say-which-events-reach-whom-and-where/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read one's own Inbox — Needs you and Updates | Operator — every member | — |
| Decide an ask | As AC-F05 | As AC-F05 |
| Read rules and channels | Operator — every member | — |
| Write a rule — notification or History alert — or a channel | `owner` · shown as *Owner* · Admin | Read only; *New rule*, *Add channel* and each switch disabled, naming the owners |
| Project work in Needs you | PJ-F02 — *Can work on projects* | As PJ-F02 says |

## States

| State | What the person sees |
|---|---|
| First use | Needs you: *Nothing needs you*, as good news. Updates with no rule written: *Nothing needs you*, with *New rule* — failures reach a person only through a rule. Rules: *No rules yet*, with *New rule* |
| Empty after a filter | Needs you or Updates filtered by product, kind or *Unread* with no match: *Nothing matches*, with *Clear filters* |
| Loading | The Inbox opens at once with rows loading in place; its count is the last one read |
| Has data | Needs you — asks first, nearest deadline first (AC-F05); Updates newest first, unread marked. Rules one row each; channels with their masked target and *ready* |
| Failed | The list could not load, saying why, with *Try again*. A channel that failed a send names the error on its delivery |
| Agent working or proposing | An agent's ask in Needs you, as AC-F05 shows it |
| No access | An ask routed to someone else reads, as AC-F05 says. Rules and channels read; every write disabled, naming the owners |

## Rules

| Rule | Detail |
|---|---|
| One list of what waits | Needs you holds every ask a person, an agent or a run makes of a person — access · budget · delegation · send · question · more than a line allows (AC-14) · a person's act set to Ask — a held delivery of a finished run, a breaking model publish, and project work (PJ-F02). The Inbox icon and the header carry one count: unread updates + asks waiting on the reader + runs waiting on the reader's answer |
| Only asks toast | A new ask or question for the reader shows a toast with *Review*; updates never toast |
| Rules read what happened | A rule matches events after they are written, never slowing or failing a write. A rule never matches its own notifications, deliveries or reminders, so it cannot feed itself |
| In the Inbox, and out | *In app* is not a channel: every rule and schedule may write to the Inbox. Channels — email · Slack · webhook — are what leaves Invana |
| Channel secrets are write-only | Stored encrypted, never read back; the read shows a masked target |
| A failed send retries | Three tries, then *failed* with the error; the Inbox row is written first and never depends on a channel |
| Recipients resolve when a rule matches | Named members still on the Graph, holders of named Graph roles, and *whoever the run was for*. An event on a private project reaches only its people |
| Alerts over History | A History alert matches acts — what was done, what it touched, allowed or refused and why, optionally a count in a window — and tells named members in the Inbox only. It sees only what happens after it exists |
| Leans on | Agents and their runs (AG-F03) · project work in Needs you (PJ-F02) · suggested changes (EX-F07) · schedules and their deliveries (AG-F07) · asks and approvals (AC-F05) · History (AC-F06) · access rules (AC-F02) |

## Data touched

| Record | Read or write |
|---|---|
| Notifications — one Inbox row per person, read or not, its target | Write · read |
| Deliveries — one send to one channel, exactly what was sent, status, tries, the error | Write · read |
| Notification rules · History alerts · channels | Write · read |
| Runs waiting on the reader's answer (AG-F03) | Read |
| History rows of every decision and every rule change (AC-F06) | Write |

## Decisions

| Decision | Detail |
|---|---|
| Needs you is the one queue | Every ask, every held send and project work wait in one list; there is no queue per product |
| Rules live in Settings › Notifications | Notification rules, History alerts and channels sit in one place, *What reaches whom* over *Where it can go* |
| Rules and channels are the owner's | A channel holds a credential and a rule decides who is told; reading them is every member's |
| Updates are notifications | The Inbox's Updates are the reader's notifications; Needs you never holds an update |

## Open questions

| Question | Who answers |
|---|---|
| Does the Inbox read across every Graph the person is on? The board reads *airways and your other graphs*; asks and notifications are per Graph today. Recommend: yes, grouped by Graph, the open Graph first | Ravi |

## Not building

| Item | Why not |
|---|---|
| A History alert sent to a channel | An alert reaches people in the Inbox; channels are a notification rule's |
| Microsoft Teams | Listed *not connected*; no work planned |
| An inbox per product | One Inbox, filtered by product |
| Digests and quiet hours | A schedule is how routine reading recurs |
| Rules on an answer's value | That is a monitoring product |
| Escalation chains and on-call rotations | A rule names its people; paging policy is another product's job |
| Per-person channel preferences | A rule owns its channels; a person reads the Inbox |
