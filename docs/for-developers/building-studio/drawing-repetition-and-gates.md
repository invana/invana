# Drawing repetition and gates — a design brief

**The plan canvas draws one loop well and does not yet draw four.** This is the brief for the pass
that fixes that: how a plan's layer strip shows bounded repetition and human gates, so a person can
read *what repeats, how many times, who stops it, and what it costs to say no* from the drawing
alone.

| | |
|---|---|
| Status | **Done.** Four artboards draw it; the rules are [LB20 · LB21 · LB28 · LB29 · LB30](../modules/workflows/features/the-library.md#decisions) |
| Canvas | [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — `Library › Plans`, as variants of the flow canvas |
| Generators | `.design/canvas-govern-agents/rg.py`, over `_gov.gantt(… brackets, seams)` |
| Governs | [LB20 · LB21](../modules/workflows/features/the-library.md) — what exists today |
| Sibling to | [the-shell.md](the-shell.md) · [design-kit-coverage.md](design-kit-coverage.md) |

Read before drawing, in this order:

```
orchestration.md § 6                      three kinds of repetition · "the plan is acyclic"
orchestration.md § 7                      three kinds of pause
modules/platform/features/runtime.md      § 7 signals · § 10 the pauses · § 11 what requires
                                          approval · § 12 the approval journey
modules/workflows/features/the-library.md LB17 · LB19 · LB20 · LB21
modules/skills/features/authoring-a-skill.md  SK16 · SK18
```

Rebuild a canvas by re-running its scripts — never hand-edit a `.dc.html`. `.design/` is gitignored:
the canvas is the source, the generator is the build.

---

## 1. Settled — do not re-open

| | |
|---|---|
| The plan is **acyclic** | A cycle is a property of a **node** or a **signal**, never an edge. No arrow goes backwards; the strip draws the **bound** and names it |
| Four repetitions, four bounds | `iteration` (`loop` · `max_iterations`) · `attempt` (`retry.max_attempts`) · `lane` (`map_over` · `max_parallel`, the pool, the fan-out ceiling) · `ask` — which is a **pause**, not a repetition |
| Three pauses, and they differ | **clarification** — inside a step, asks an *answer*, the step is mid-flight · **approval** — **before** dispatch, asks a *decision*, **nothing is spent** · **verdict** — **after** a pass, asks a *judgement*, **the pass is already paid for** |
| Their bounds differ too | clarifications counter · a deadline · **both** a deadline and `max_iterations` |
| A budget exhaustion is an approval | Raised by the runtime, not declared by the plan, and the only pause with **no deadline** |
| None auto-resolves | A passed deadline is `stop(failed)` naming who was asked |
| An agent never approves | The approver is always `principal_kind = user`; membership is the permission, and there are no roles |
| A fanned-out step asks **once** | One approval covers every lane, and the request states the lane count |
| Declared versus touched | A plan's axis is `seq` rather than a clock, so repetition is a **bracket**; a run's strip **unrolls** — iteration 2 is further right ([LB20](../modules/workflows/features/the-library.md)) |

## 2. The six questions

`SkillFlow` draws one bracket over two columns and three marks in an *its bound* row. That holds for
one loop. It does not answer:

| # | Question |
|---|---|
| 1 | **Nested repetition.** *For each of 200 suppliers (lane), research until confident (iteration), retrying on 429 (attempt)* is one real flow — three bounds on one column. How do brackets nest without becoming a gantt of brackets? |
| 2 | **A loop over non-adjacent columns.** `back(id)` re-opens `id` **and everything downstream of it**. The columns between are inside the repetition; the ones before are not |
| 3 | **Approval gates.** An approval sits **before** a step and belongs to **no layer** — it is a person, so arguably the `human` band, but nothing has been dispatched yet. Is a gate a **column**, a **mark on a column**, or a **rail** beside the bracket? |
| 4 | **A verdict.** It comes *after* a pass and sends the loop round again. Drawn as a loop, or as a gate on the way back in? |
| 5 | **The bound that is not on the plan.** `requires_approval` lives on the **envelope**, and a threshold is computed at dispatch — so the same plan is gated for a junior agent and not for a senior one. Does the declared strip show it, and **whose**? |
| 6 | **Reading the ceilings.** Five columns with four bounds each is twenty numbers. What is on the strip, and what is one click away? |

## 2a. Answered

| # | Answer | Where it is stated |
|---|---|---|
| 1 | Brackets pack into **lines**, widest on top. An attempt repeats one step and a clarification suspends one, so neither can span — which leaves lane and iteration, and at most two lines over any stretch | [LB20 · LB21](../modules/workflows/features/the-library.md#decisions) |
| 2 | `back(id)` re-opens `id` **and everything downstream**, so the stretch is contiguous by construction and one bracket draws it | [LB20](../modules/workflows/features/the-library.md#decisions) |
| 3 | **A seam** — a rule at a position on the axis, crossing every band. Not a column (there are none), not a bar (nothing is dispatched), not a row on `human` (no slot, no form, no participant) | [LB28](../modules/workflows/features/the-library.md#decisions) |
| 4 | A verdict is a seam on the **trailing** edge with the `back()` bracket hanging off it; an approval is a seam on the **leading** edge. Position is the price | [LB28](../modules/workflows/features/the-library.md#decisions) |
| 5 | The record is unchanged: an envelope gate draws **dashed**, and the header names whose reading it is. A budget exhaustion has no position and runs the axis | [LB29](../modules/workflows/features/the-library.md#decisions) |
| 6 | A spanning bound is its bracket's label, a single-step bound rides that task's bar, and the other seventeen are in the panel | [LB30](../modules/workflows/features/the-library.md#decisions) |

**Question 3 is the one the rest hangs off** — answer it before drawing anything else.
**Question 5 may change the record, not just the drawing:** a strip that says *3 gates* would be lying
for one of two agents. If so, that is a decision in [runtime § 11](../modules/platform/features/runtime.md),
taken deliberately.

## 3. Constraints

| | |
|---|---|
| The shell | 1440×900, rail + 420px `leftSection` + `mainSection`; a detail is the drilled-in drawer with tabs ([SK17](../modules/skills/features/authoring-a-skill.md)) |
| The kit | `@invana/*` tokens only. No hex, no raw `hsl(`, no one-off components |
| One drawing | The same six bands serve plan, skill and run. A mechanism that works on only one of the three is not the answer |
| One artboard, one claim | `mainSection` argues it; the panel shows the rows it applies to |
| Honesty | Draw only what the record says exists. `🖼` beats a fabricated count |

## 4. Deliverables

| | |
|---|---|
| 2–4 artboards | On a new page of the canvas, one page per feature as [CLAUDE.md § Design rules](../../../CLAUDE.md) requires. Suggested: the nested case · the approval gate · the verdict loop · the ceilings readout |
| Decisions, same turn | Drawing rules for repetition and gates go in [the-library.md](../modules/workflows/features/the-library.md) beside LB20 · LB21; what a **skill** may declare goes in [authoring-a-skill.md](../modules/skills/features/authoring-a-skill.md); anything about the pauses themselves belongs in [runtime § 10–12](../modules/platform/features/runtime.md) and must agree with it or change it deliberately |
| A row in the index | [the-screens.md](../the-screens.md) § *The design canvases* |

## 5. Done when

A person who has never seen the plan can answer, **from the drawing alone**: *what repeats, how many
times, who stops it, and what it costs to say no* — and can tell an **approval** from a **verdict**
without reading the legend.

**Where the drawing and the record disagree, say so and stop.** A product question is not settled by
picking whichever is easier to draw.
