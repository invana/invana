---
"invana": minor
---

Schedules, notifications and approvals: agents run on a clock, events reach people, and outward sends wait for a named approver.

- `…/schedules` holds a schedule: an agent, its instructions, a 5-field cron and an IANA zone. Each firing opens a run and is recorded (`queued · opened · skipped · failed`) at `…/schedules/{id}/firings`; `pause · resume · run` act on it.
- A missed firing (more than five minutes late) follows the schedule's policy: `catch_up` runs the latest once, `run_all` runs each (at most 24), `skip` runs none. A firing while the last run is still going is skipped unless overlap is `allow`.
- A schedule delivers its result to the inbox and to channels. With `approve_outward`, channel sends are held until a named approver approves; past the deadline they expire, with a reminder at half-time. Nothing is approved automatically.
- `…/approvals` lists what waits on you (`?mine=true`); `…/approvals/{id}/approve · decline` decides it.
- `…/notifications` is your inbox on a Graph (`unread` · `approvals_waiting`); `POST …/notifications/read` marks it read.
- `…/notifications/rules` say which events reach whom — named members, holders of Graph roles, the requester — and where: the inbox and `…/notifications/channels` (`email` · `slack` · `webhook`, signed with `X-Invana-Signature`). A channel's URL and secret are stored encrypted and shown masked.
- One clock per engine process fires schedules, delivers results, matches events against rules, reminds and expires approvals, and sends deliveries with three tries. `INVANA_SMTP_*` configures email.
- `invana schedules · approvals · notifications` do the same from a terminal.
