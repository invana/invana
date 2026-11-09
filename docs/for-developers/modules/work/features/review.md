# Review

One queue for everything waiting on a person — questions, verdicts on a pass and results — derived from the runs and
tasks that wait.

| | |
|---|---|
| Index | [9.3](../../../README.md#9--work) · Slice **S12b** |
| Module | [Work](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [projects-and-tasks](projects-and-tasks.md) · [objectives-and-criteria](objectives-and-criteria.md) · consolidation · [the runtime](../../platform/features/runtime.md) (§10 — the three pauses this queue decides) |

Product spec: [PJ-F02 · Objectives and review](../../../../../specs/capabilities/projects/features/PJ-F02-objectives-and-review/feature.md) — PJ-17; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Approvals in the queue

Stays, not moved: [AC-F05](../../../../../specs/os/access/features/AC-F05-asks-and-approvals/feature.md) decides an ask as shown — changing what it will do before allowing it is in its *Not building*. Amending the gated call's arguments is open for Ravi there.

| # | Capability | Notes |
|---|---|---|
| C4c | An **approval** shows the call it gates | Step, resolved arguments, what it reads, what it writes and its projected cost. A person may amend the arguments; the amended call is re-validated against the envelope |

## Engine

| Thing | Shape |
|---|---|
| Queue | derived: parked clarifications, **steps `awaiting_approval`**, **steps `awaiting_verdict`**, open proposals, Todos in `review` |
| Actions | answer · accept · reject, each writing to its own subject |
| Routes | `GET …/review?kind=…` · the subject's own action routes — a verdict posts to `POST …/task_runs/{id}/steps/{step_id}/verdict` |
| Events | the subject's events; Review adds none of its own |

## Decisions

Engine rows; the product decisions are PJ-F02's.

| # | Decision |
|---|---|
| RV2 | Review is derived — it owns no rows of its own. |
| RV6 | **Review is the surface for all three pauses.** The runtime suspends and records; it builds no UI of its own ([13.8 §10](../../platform/features/runtime.md)). |
| RV7 | **A verdict is not a result.** A result closes work somebody owns; a verdict decides whether a loop goes round again. They sit in one queue and are different rows against different subjects. |
| RV8 | A verdict's note is bound into the loop's next pass as `${self.feedback}` ([RP2e](../../platform/features/runtime.md)). |
