# Draft a plan

A published version is immutable, so a change is a **draft**: a fork of the version, edited on the
flow canvas or as `manifest.yml`, refused by the envelope while it is still a draft, and published as
the next version. Nothing selects a draft and nothing runs it.

| | |
|---|---|
| Index | [7.7](../../../README.md#7--workflows) · Slice **S15** |
| Module | [Workflows](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [the-library](the-library.md) · [envelope-validation](envelope-validation.md) · [the-catalogue](the-catalogue.md) · [promote-a-plan](promote-a-plan.md) · [run-a-workflow](run-a-workflow.md) · [orchestration § 5](../../../orchestration.md#5-the-plan-is-data) |

> **As** someone whose agents keep doing the same job slightly wrong, **I want** to change the plan and
> publish it, **so that** the fix is the next version rather than a promotion I have to engineer by
> running something.

## Why this exists now

Promotion ([7.4](promote-a-plan.md)) made a plan that *served* into a template. It could not make a
plan that *nearly* served into a correct one — the only way to change a step was to run something
until the generated plan happened to come out right. That is authoring by coincidence.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | `Edit as a draft` forks a published version | The draft carries `forked_from`; the version it came from is untouched |
| C2 | `New plan` starts an empty draft | Key, name, intent, kind — then tasks |
| C3 | Edit on the **flow canvas** | Add a task from the catalogue, wire `depends_on`, set args, delete |
| C4 | Edit as **`manifest.yml`** | The same document as YAML — the canvas draws this file, and the file is rewritten by the canvas |
| C5 | Switching editors never loses an edit | One document, two views; the switch is a render, not a save |
| C6 | Validated against the envelope as you type | Per-task, with the bound named ([7.3](envelope-validation.md)) — a refusal is a state of the task, not a modal |
| C7 | `Publish` mints the next immutable version | Refused while any task is refused; the published version is what runs |
| C8 | `Discard` throws the draft away | One draft per plan per person; discarding never touches a version |
| C9 | The draft says what changed since its parent | Added, removed, and what moved — the same shape as the version diff ([7.1](the-library.md) C4) |
| C10 | `Retire` a version, or the whole plan | Stops selection and starting; stops nothing that runs ([LB9](the-library.md)) |
| C11 | A draft is never startable | `Run` is absent, not disabled-with-a-tooltip — a draft has no version for a trace to name |
| C11a | **A task's parameters are a generated form** | One field per declared arg — name, type, required, default, straight from the catalogue entry ([7.6](the-catalogue.md)) |
| C11b | **Every field picks its source** | `literal` · `${binding}` · a plan `argument`. The source is a control, not a syntax a person has to know |
| C11c | Plan-level settings sit under the args | `map_over` · `depends_on` · `retry` · `when` · `approval` — the plan grammar, on the same form, below a rule |
| C11d | A task's parameters are editable **only in a draft** | Opening one on a published version offers `Edit as a draft`; the foot says *v4 is untouched until you publish* |
| C12 | The catalogue is the palette | Drafting is the only place the Catalogue drawer is a drag source rather than a reference |

## Journey

```mermaid
flowchart TD
    A{Where from} -->|a version that is nearly right| B["Plans › a plan › Edit as a draft"]
    A -->|nothing like it exists| C["Plans › New plan"]
    A -->|a run that served| D["Runs › Promote · 7.4"]

    B --> E[Draft vN+1 · forked from vN]
    C --> E
    D -->|lands as a published version| K

    E --> F{Which editor?}
    F -->|canvas| G["Drag an entry in · wire depends_on · set args"]
    F -->|manifest.yml| H["Edit the YAML"]
    G <--> H

    G --> I{Legal?}
    H --> I
    I -->|no| J["Refused, with the bound named:<br/>bulk_write spends graph_write"]
    J -->|widen the envelope| I
    J -->|pick another task| G
    I -->|yes| K["Publish vN+1 · immutable"]

    K --> L{Then}
    L -->|start it| M["Run · 7.5"]
    L -->|stop selecting the old one| N["Retire vN"]
    E -->|changed my mind| O["Discard — no version was touched"]
```

## Seams

| Seam | What the user sees |
|---|---|
| A draft already exists | Opening the plan lands on the draft, with *forked from v4, 2 days ago* and the choice to discard it |
| Someone published while you drafted | The draft says its parent moved; publishing offers to rebase onto the new version or publish as a branch of the old one — never a silent overwrite |
| A task the envelope refuses | The task is marked on the canvas and the line is marked in YAML; `Publish` is off and says how many tasks are refused |
| YAML that does not parse | The canvas keeps the last parsable state and says so; nothing is silently reshaped, and the editor does not switch away from an unparsable file |
| A task the catalogue does not have | Marked unknown, linking to the catalogue's *no such entry* — the same state a plan from a newer engine shows ([7.6](the-catalogue.md)) |
| A cycle in `depends_on` | Refused, naming the loop — the same refusal the runtime would give |
| Retiring the last published version | Says what loses its plan: the schedules and agents that named it |
| A member without write access | The canvas is read-only, `Edit as a draft` is absent, and the version history still reads |

## Surfaces

| Surface | Shape |
|---|---|
| Draft, in the **Plans** drawer | Behind the drawer's breadcrumb: `draft vN` badge, *forked from*, *changes since*, the validation result, then `Publish · Validate · Discard` |
| Parameters | `mainSection`, under the flow: the form for the selected task, with the **contract card** beside it (the catalogue entry it was generated from) and a live validation panel. `Save to draft` · `Revert this task` |
| Canvas editor | `mainSection`. Palette (select · add · connect · delete), a selected task with handles, a floating properties card, a bottom bar carrying `Publish` and `Discard` |
| `manifest.yml` editor | `mainSection`, behind the strip's `Canvas ¦ manifest.yml` switch. CodeMirror, refused lines marked in the gutter, validation beside it |
| Catalogue drawer | The palette — drag an entry onto the canvas. A refused drop explains the bound |
| Retire | A confirm card over the canvas: what stops being selected, what keeps reading, and the schedules and agents affected |

## Engine

| Thing | Shape |
|---|---|
| `task_plans` | unchanged — a draft is a `plan_versions` row with `published_at IS NULL` |
| `plan_versions` | `steps` · `forked_from_version_id` · `created_by` · `published_at` (null while draft, immutable once set) |
| `GET/PUT …/plans/{id}/draft` | Read and write the working document. `PUT` takes the whole plan — canvas and YAML send the same body |
| `POST …/plans/{id}/draft/validate` | Per-task verdicts with the bound named; the same code path the dispatcher uses ([7.3](envelope-validation.md)) |
| `POST …/plans/{id}/draft/publish` | Refused unless every task validates; mints the next version |
| `DELETE …/plans/{id}/draft` · `POST …/plans/{id}/versions/{v}/retire` | Discard · retire |
| Events | `plan.drafted · plan.published · plan.retired` |

## Decisions

| # | Decision |
|---|---|
| DP1 | **A published version is immutable; editing forks a draft.** The runs that used a version have to stay readable, and a mutable version makes every trace a guess. |
| DP2 | **The canvas and `manifest.yml` are two editors over one document.** The plan is data; the canvas draws the data and writes it back. Neither converts to the other, because there is nothing to convert — there is one document and two renderings ([F18](../spec.md)). |
| DP3 | **The envelope is checked while drafting, not at dispatch.** The same validator, run on every edit — a refusal at 2am is the failure this feature exists to prevent. |
| DP4 | **A draft is not startable.** `plan_origin` has to name a version a trace can resolve; a run of something unpublished could not be read afterwards. |
| DP5 | **The catalogue is the only source of tasks.** A task is placed by dragging a catalogue entry; there is no free-text `run:` that the validator meets for the first time at publish. |
| DP6 | **Promotion stays.** A plan that served is still promotable ([7.4](promote-a-plan.md)) — drafting adds a door, it does not close that one. |
| DP8 | **The form is generated from the contract, never hand-written per task.** A field exists because the catalogue declares an arg; its type, requiredness and default come from the same declaration the validator reads ([CA2](the-catalogue.md)). A new catalogue entry gets an editor for free, and the two can never drift. |
| DP9 | **Binding is a choice of source, not a syntax to learn.** Each field is `literal` · `${binding}` · `argument`; picking *binding* offers what is in scope — earlier tasks' declared outputs, the lane, the plan's arguments. Typing `${…}` by hand still works, and resolves to the same thing. |
| DP7 | **Retire is not delete.** A retired version is not selected and not startable, and it still resolves for every run that used it. Nothing here deletes a plan. |

## Not building

| Not building | Because |
|---|---|
| Editing a published version | DP1 — the trace is why |
| Running a draft | DP4 |
| A free-form diagram — notes, swimlanes, arbitrary shapes | the canvas edits a plan, and the plan grammar is closed ([orchestration § 5](../../../orchestration.md#5-the-plan-is-data)) |
| Branching version lines | one line of versions per plan ([the-library](the-library.md) · Not building) |
| Importing a plan from a file | the YAML editor is the same document, not an import path; a file from elsewhere has no envelope to be checked against |
| Collaborative live editing of one draft | one draft per plan per person; two people on one document is a merge problem this feature does not need to have |
| Deleting a plan | retire is the exit ([DP7](#decisions)); a deleted plan is a trace that cannot be read |
