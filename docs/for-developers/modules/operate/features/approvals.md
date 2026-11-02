# Approvals

Anything that leaves Invana waits for a person. An **approval** names what will be sent, exactly,
who may approve it and by when. A reminder goes at half-time; at the deadline it ends **expired, not
sent** — never auto-approved.

| | |
|---|---|
| Index | [10.8](../../../README.md#10--operate) · Slice **B08** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / 🟡 |
| Related | [notifications](notifications.md) · [schedules](schedules.md) · [publish review](../../connect-and-model/features/publish-review.md) · [review](../../work/features/review.md) · [the runtime](../../platform/features/runtime.md) §10 |

Product spec: [IN-F01 · Needs you](../../../../../specs/products/inbox/features/IN-F01-needs-you/feature.md) — IN-01; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

The Studio surfaces as built today; the Inbox modal in IN-F01 replaces them.

| Surface | Shape |
|---|---|
| `agents.approvals` | `/agents/approvals` — `SectionPage` *Approvals*, tabs Waiting · Alert rules. Waiting: `SegmentedControl` `For you · N` · `All · N` · `Answered` (`?f.view=`), a kit `Table` Kind · Asked by · Wants · Routed to · Waiting · Run, with Decline · Approve in the row for the reader's own asks |
| `agents.approvals.alerts` | `/agents/approvals/alerts` — a `Table` On (`Switch`) · When · Matches · Notifies · Last fired, and *New alert* opening a `Dialog` |
| The approval | The payload as it will be sent, the channels, approvers, deadline, Approve · Decline with a note |
| The tray | The bell's popover lists what waits on me; *Review* opens the approval inside it — payload, what each choice does, who asked, the run and step, approvers, time left — and only then Approve · Decline ([notifications](notifications.md) NT11 · NT12) |

## Engine

| Thing | Shape |
|---|---|
| `approvals` | `graph_id` · `subject_kind (delivery · step · model_publish · access · budget · delegation · question)` · `subject_id` · `run_id` · `schedule_id` · `title` · `payload` · `approver_ids[]` · `requested_by_id` · `deadline_at` · `reminded_at` · `status (pending · approved · declined · expired)` · `decided_by_id` · `decided_at` · `note` |
| `approvals` (added) | `kind` · `asked_by` (the actor chain, `[{kind, id, name}]`) · `wants` (one line) · `routed_reason` (`world owner` · `agent owner` · `started the run` · `wrote the Todo` · `install admin`) · `step_run_id` |
| `alert_rules` | `graph_id` · `name` · `enabled` · `match {act, touched, verdict[], refused_by[], threshold {count, window_s}}` · `notify_user_ids[]` · `notify_line` · `last_fired_at` · `created_by_id` |
| Routes | `GET …/approvals` (`?f.view=for_you·all·answered` · `?f.kind=` · `?status=`) · `GET …/approvals/{id}` · `POST …/approvals/{id}/approve` (`{note, scope: run·always}`) · `POST …/approvals/{id}/decline` (tag `approvals`) · `GET …/alert-rules` (`Page[AlertRuleRead]` on the list contract, by name; `?q=` · `?enabled=`) · `POST …/alert-rules` · `PATCH · DELETE …/alert-rules/{id}` |
| Decided twice | `409` with `detail {error: already_decided, message, status, decided_by, decided_at}` — `decided_by` a username, `message` the sentence shown |
| Events | `approval.request · approve · decline · expire · remind` |
| CLI | `invana approvals list · approve · decline` |

## Decisions

Engine rows, and rows the Inbox has not settled; the product decisions are IN-F01's.

| # | Decision |
|---|---|
| AP6 | Writing an approval decision is the `ask` area (viewer): the approver list, not a Graph role, is the bound. |
| AP12 | **Alert rules match ledger rows** — an act pattern (`graph.write.*`), a touched pattern (`graph/Fare`), verdicts and refusal reasons, optionally a threshold (`count` in `window_s`). The clock evaluates them over new ledger rows; a match notifies each named member in the inbox and records `last_fired_at`. A rule change is itself a ledger row. |
| AP13 | **`For you` is what the reader may decide**; `All` is every pending ask in the Graph the reader can see; `Answered` is the decided and expired ones, newest first. The counts on the tabs are the engine's. |

## Not building

| Not building | Because |
|---|---|
| A plan node's `approval:` gate | the runtime's ([13.8 §10](../../platform/features/runtime.md)); when it lands it raises this same row with its own `kind` |
