---
id: CP-37
title: Say which events reach whom, and where
feature: CP-F08
status: idea
personas: [admin, builder]
boards: [settings.notifications]
---

# CP-37 · Say which events reach whom, and where

**As** an Admin **I want** rules that say which events, ops alerts and acts in History reach whom — in the Inbox, by
email, Slack, Teams or webhook **so that** failures and slowdowns find the right person without anyone watching.

Tasks: [task.md](task.md) · Feature: [CP-F08](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read, write, switch off and delete every rule and History alert; name any user, team, role, *the person behind the run*, *the agent's owners* or channel | — |
| Operator | Operator · Modeller: read every rule, alert and channel; write, switch and delete their own rules that reach only themselves ([the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table)) | Other recipients, a team, a role, a channel, *New History alert*, *Add channel* and another person's switch and *Edit* disabled — *Needs the Admin role — ask {admins}*, naming the rule's creator |

## Flow

```mermaid
flowchart LR
  s([Settings › Notifications]) -->|none yet| e["No rules yet · New rule"]
  s --> r["What reaches whom — each rule: when · who hears · how · on"]
  s --> c["Where it can go — In app, then each channel, masked, ready or why not"]
  r -->|New rule| n["When: events, ops alerts, or acts in History · Tell: users, teams, roles, the person behind the run, the agent's owners · On: In app and channels"]
  n --> who{"An Admin?"}
  who -->|no · reaches only me| v
  who -->|no · anyone else, a team, a role, a channel or a History alert| nr(["Refused · Needs the Admin role, naming the Admins"])
  who -->|yes| v{"Valid?"}
  v -->|no recipient · unknown channel · it would feed itself| x["Refused, naming the field"] --> n
  v -->|yes| ok(["Saved · on"])
  c -->|Add channel| ch["CP-45 · Email · Slack · Teams · webhook — an Admin's"]
  c -->|Remove, still used| used["Refused, naming the rules and schedules that use it"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-37.1 | No rules | anyone opens Settings › Notifications | it reads *No rules yet*, with *New rule* |
| CP-37.2 | Rules | the list is read | one row each: *when* (the events and the status they match) · who hears · how (Inbox and each channel) · an on switch |
| CP-37.3 | *New rule* | a person picks events, an optional status for a finished run (any · failed · succeeded), recipients and where it goes | the rule saves, on, and matches events written from then on |
| CP-37.4 | Recipients | a rule names them | they can be users by name, teams, roles, *the person behind the run* or *the agent's owners*, resolved when it matches; a user who is not active then is skipped |
| CP-37.5 | A rule with no recipient, or naming a channel that does not exist | it is saved | it is refused, naming the field |
| CP-37.6 | The events offered | a rule is written | notifications, deliveries, reminders and rule and channel changes are not offered, so a rule cannot feed itself |
| CP-37.7 | A History alert | an Admin writes one: what was done, what it touched, allowed or refused and why, optionally a count in a window, and which users or teams to tell | it tells those users and the people on those teams in the Inbox when a new History row matches, and shows when it last fired |
| CP-37.8 | A new History alert | rows matching it were written before it existed | it does not fire for them; *Last fired* reads *never* until a new row matches |
| CP-37.9 | A matching event | a rule is on | each recipient gets an Inbox row within one tick, and each channel a delivery |
| CP-37.10 | A channel that is down | a delivery is sent | it is tried three times, then reads *failed* with the error; the Inbox row is there regardless |
| CP-37.11 | A rule | where it goes is chosen | *In app* and each channel an Admin set up (CP-45) are offered — email, Slack, Teams, webhook — a channel that is not ready named with why |
| CP-37.12 | A rule naming a channel | it matches | each channel gets one delivery carrying the event's line and a link, never record content (CP-45.8) |
| CP-37.13 | A channel a rule or schedule uses | it is removed | it is refused, naming the rules and schedules that use it (CP-45.9) |
| CP-37.15 | A rule or channel change | it is saved | it is a History row (AC-F06) |
| CP-37.16 | An Operator or a Modeller | they open Settings › Notifications | rules, alerts and channels read; they may write rules that reach only themselves; other recipients, teams, roles, channels, *New History alert*, *Add channel* and another person's switch and *Edit* are disabled, naming the Admins |
| CP-37.17 | An Admin at the command line | they apply a rules file — one rule or a list | each rule is created, or replaces the rule of its name, with the same checks as *New rule*; a refused rule names its field and nothing in the file is half-applied |
| CP-37.18 | Anyone but an Admin | they save a rule that reaches anyone but themselves, or names a team, a role or a channel, or a History alert, or change another person's rule | it is refused — *Needs the Admin role — ask {admins}* — and nothing is saved |
| CP-37.19 | An ops alert (CP-59) | an Admin writes a rule matching its kind and naming a channel | each alert of that kind is delivered to that place as a line and a link, beside the Inbox rows CP-59 writes |
| CP-37.20 | A rule an Operator or a Modeller wrote for themselves | it matches | it reaches them in the Inbox and on the channels they turned on (CP-46) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| What reaches whom — rules and alerts | Admin | settings.notifications · No rules yet | — | settings.notifications · Loading | settings.notifications | settings.notifications · Could not load | — | — |
| What reaches whom — rules and alerts | Operator | settings.notifications · No rules yet | — | settings.notifications · Loading | settings.notifications · Read only | settings.notifications · Could not load | — | settings.notifications · Read only |
| A rule — new or edit | Admin | settings.notifications · New rule | — | — | settings.notifications · Rule | settings.notifications · Rule refused | — | — |
| A rule — new or edit | Operator | settings.notifications · New rule · Just me | — | — | settings.notifications · Rule · Just me | settings.notifications · Rule refused | — | settings.notifications · Read only |
| Where it can go — channels | Admin | settings.notifications · In app only | — | settings.notifications · Loading | settings.notifications | settings.notifications · Channel failed | — | — |
| Where it can go — channels | Operator | settings.notifications · In app only | — | settings.notifications · Loading | settings.notifications · Read only | settings.notifications · Channel failed | — | settings.notifications · Read only |
