# Notifications

Which events reach whom, on which channel — and one inbox per person of what needs them. A
**rule** matches events and names its people and channels; a **channel** is a place outside the
inbox to send to; a **notification** is one inbox row; a **delivery** is one send to one channel.

| | |
|---|---|
| Index | [10.7](../../../README.md#10--operate) · Slice **B08** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / 🟡 |
| Related | [approvals](approvals.md) · [schedules](schedules.md) · [audit-and-activity](audit-and-activity.md) · [roles](../../identity-and-access/features/roles.md) |

Product spec: [IN-F01 · Needs you](../../../../../specs/products/inbox/features/IN-F01-needs-you/feature.md) — IN-04 · IN-05; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

The Studio surfaces as built today; the Inbox modal and Settings › Notifications in IN-F01 replace them.

| Surface | Shape |
|---|---|
| Header bell | The count: unread notifications + approvals waiting on me + runs waiting on my answer. A click opens the tray; it never navigates |
| The tray | A popover under the bell. **Needs you** (approvals, then questions — *Review* · *Answer* open inside the tray) above **Updates** (notifications — a click goes to the target). *Mark all read* · *Rules* · *Open inbox* |
| A toast | One per new approval or question for me; *Review* opens it in the tray |
| Activity › Inbox | My notifications and the approvals waiting on me, each with its next step |
| Activity › Rules · rule | The rules list; a rule's events, match, recipients and channels |
| Activity › Channels | The channels with kind, masked target and *ready* |

## Engine

| Thing | Shape |
|---|---|
| `notification_channels` | `graph_id` · `name` (unique per Graph) · `kind` · `target` (masked, shown) · `secret_encrypted` · `created_by_id` |
| `notification_rules` | `graph_id` · `name` · `events[]` · `match{}` · `member_ids[]` · `roles[]` · `requester` · `in_app` · `channel_ids[]` · `enabled` · `created_by_id` |
| `notifications` | `graph_id` · `user_id` · `kind (event · approval · reminder · expired · delivery)` · `title` · `body` · `event_id` · `rule_id` · `approval_id` · `run_id` · `target_kind` · `target_id` · `read_at` — unique `(user_id, event_id, rule_id)` |
| `notification_deliveries` | `graph_id` · `channel_id` · `rule_id` · `event_id` · `firing_id` · `approval_id` · `status` · `payload` (exactly what is sent) · `attempts` · `error` · `sent_at` |
| `notification_cursors` | `name` · `created_at` · `event_id` — how far the clock has matched |
| Routes | `GET …/notifications` · `POST …/notifications/read` · `GET·POST …/notifications/rules` · `GET·PATCH·DELETE …/notifications/rules/{id}` · `GET·POST …/notifications/channels` · `DELETE …/notifications/channels/{id}` (tag `notifications`) |
| Events | `notification_rule.create · update · delete` · `channel.create · delete` · `delivery.fail` |
| CLI | `invana notifications list · read` · `invana notifications rules list · apply --file` · `invana notifications channels list · add · remove` |
| Settings | `INVANA_SMTP_HOST` · `INVANA_SMTP_PORT` · `INVANA_SMTP_USERNAME` · `INVANA_SMTP_PASSWORD` · `INVANA_SMTP_FROM` · `INVANA_SMTP_STARTTLS` · `INVANA_CLOCK_INTERVAL_S` |

## Decisions

Engine rows, and the tray rows the Inbox modal supersedes; the product decisions are IN-F01's.

| # | Decision |
|---|---|
| NT1 | **One clock.** A single loop in the engine process matches new events, fires schedules, reminds and expires approvals, and sends pending deliveries — one `tick(now)` each interval (default 30 s). Every step is idempotent on unique keys, and the cursor row is taken `FOR UPDATE SKIP LOCKED`, so two engine processes never double-send. |
| NT2 | **Rules read the event record; they never hook a write.** Matching runs after commit, from `events`, through a persisted cursor. A write is never slowed or failed by a notification. |
| NT5 | A channel's credential is write-only: stored Fernet-encrypted under `INVANA_ENCRYPTION_KEY`, never read back; the read shows a masked `target`. |
| NT6 | A webhook delivery is a JSON `POST` signed with `X-Invana-Signature: sha256=<hmac of the body>` when the channel has a secret. A Slack delivery posts `{"text": …}` to the incoming-webhook URL. Email goes through the install's SMTP. |
| NT10 | Read state is per notification (`read_at`); the bell counts unread notifications plus the approvals and runs waiting on the reader, which stay rows of their own until decided or answered. |
| NT11 | **The bell opens the tray; the Inbox is the history.** The tray reads the same three lists as the Inbox and carries the same count. What needs a person is decided in place — reviewed and approved, or answered — without leaving the page. |
| NT12 | **Nothing is approved from a list row.** *Approve* · *Decline* appear only after *Review* has shown the payload exactly as it will be sent and what each choice does. |
