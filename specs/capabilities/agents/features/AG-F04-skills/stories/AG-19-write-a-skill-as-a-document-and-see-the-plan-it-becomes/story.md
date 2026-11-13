---
id: AG-19
title: Write a skill as a document and see the plan it becomes
feature: AG-F04
status: idea
personas: [builder]
boards: [agents.skill, agents.run]
---

# AG-19 · Write a skill as a document and see the plan it becomes

**As** an agent builder **I want** to write a skill as a document, with what it needs beside it, see its Flow
— what the instructions resolve to — and publish or roll back a version with evidence **so that** the instructions are
the work, the flow is their consequence, and I never draw a plan by hand.

Tasks: [task.md](task.md) · Feature: [AG-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | On any skill not built in: edit the draft, add functions, answer the planner's questions, choose for a flagged line, set the model version, discard the draft, publish, roll back — in Studio or on the command line | A built-in skill reads; *Copy* in place of *Edit instructions* |
| Modeller | As Admin, on the skills they own | On a skill they do not own, the editor is read-only and each act is disabled, naming its owners — *Only its owners or an Admin — ask Lee* |
| Operator | Read the instructions, Plan preview, What it needs, Flow and History | The editor is read-only; *Add functions*, *Discard draft*, *Publish*, *Edit instructions* and *Roll back* are disabled, naming the role — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart LR
  e([Instructions]) -->|Save · guided| gd["No plan — Flow says the model follows the instructions"]
  gd -->|Publish| g
  e -->|Save · planned| d{"The plan is drawn"}
  e -->|Discard draft| dd(["The draft goes; the published version stays"])
  e -->|Model version| mv["Kept on the draft; publishes through the evals"]
  mv --> g
  d -->|a sentence reads two ways| q["A question under it — pick a reading"]
  q --> d
  d -->|a line names a workflow| w["One composite step, pinned key@version"]
  w --> d
  d -->|a line maps to no function| u["Flagged — Leave it to a person · Rewrite the line"]
  u --> e
  d -->|does not hold together| h["Says why, naming the step; the last plan stays"]
  h --> e
  d -->|every line maps| p["Plan preview · What it needs"]
  p -->|Open its Flow| f["Flow — steps from lines, handlers aside"]
  p -->|Publish| g{"Drawn from this exact text? Evals hold?"}
  g -->|no| gx["Refused where the act was, naming why"]
  g -->|yes| v(["vN published — each agent reads it on its next run"])
  v --> hi["History — what changed · who picks it up"]
  hi -->|Roll back| rb(["A new version from an earlier one, through the evals"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-19.1 | A draft | its owner saves the instructions | the draft is written and the plan is drawn again; the Plan preview reads *Drawing…* over the last plan, and the editor stays editable |
| AG-19.2 | A plan drawn | Instructions reads | the Plan preview lists the plan's steps with their bounds and each handler under the step it guards; *What it needs* lists the functions and workflows the plan calls, each with its bound and the resources it needs |
| AG-19.3 | An owner | they press *Add functions* and pick some | the picker groups the deployment's functions by where they come from, a send marked *send*; *Add N* writes a step line naming each into Steps, and the next draw maps it |
| AG-19.4 | A sentence that matches two or more functions or workflows | the plan is drawn | nothing is drawn; a question sits under that sentence, quoting it, each reading a button naming the step it would write |
| AG-19.5 | A question | the owner picks a reading | the answer is kept on the version so a redraw never asks again, the instructions are offered the edit that would have avoided it, and the plan draws again at once |
| AG-19.6 | A draw that would need a fourth question | it is drawn | the sentence still read two ways becomes a step a person does |
| AG-19.7 | A line no function can do | the plan is drawn | it is flagged under the document naming its line, with *Leave it to a person* and *Rewrite the line*; the preview says why it cannot draw and keeps the last plan, marked *from an earlier text*; Publish is disabled |
| AG-19.8 | A flagged line | the owner presses *Leave it to a person* | the line is rewritten as *A person does this: …* and the draft saved; the next draw maps it as a person's step |
| AG-19.9 | A drawn plan that does not hold together — a step that needs another first, or reads an output nothing writes | it is drawn | nothing is written; it says why where the flow would be, naming the step and what it wanted, and the plan that was there is untouched |
| AG-19.10 | A sentence that names a workflow | the plan is drawn | it becomes one composite step pinned to the workflow's newest published `key@version`, reading its name and version and opening its own Flow (AG-F06); an argument the workflow does not declare refuses the draw, naming it |
| AG-19.11 | A plan with a composite step | the workflow publishes a newer version | the pin does not move; the step reads *vN exists*, and only a redraw someone asks for moves it |
| AG-19.12 | Flow | it opens | the plan is drawn top-down, each step tied to the line it came from, handlers and gaps to their right; *From the instructions* maps every line to its step or handler; the foot says it is drawn from the instructions, vN, and that a run may replan within what the skill may use |
| AG-19.13 | Flow | the person selects a step, or a line | a step shows its line, bound and side effect, and the line highlights; a line selects its step; a line that drew no step is marked unmapped |
| AG-19.14 | A plan drawn | the person opens it in Runs | the drawing is a run like any run; *How it got here* shows its steps, the sentences it read and the functions and workflows it weighed |
| AG-19.15 | Instructions changed since the last draw | the owner publishes | publishing is refused — *the plan was drawn from an earlier text — draw again* |
| AG-19.16 | A draft whose evals hold | the owner presses *Publish vN* | the text, its answers and its plan publish as one version; each agent it is added to reads it on its next run, and a run in flight finishes on the version it opened with |
| AG-19.17 | A publish | History opens | *Regenerated — vN* lists steps added, removed and changed against the version before, or says *The plan did not change with this version*; *Who picks it up* lists every agent it is added to as *next run* |
| AG-19.18 | History | the owner presses *Roll back* on an earlier version, with a reason | a new version copies that version's instructions, model version and plan, through the evals; the version it copied is named on it |
| AG-19.19 | An open draft, or the current version | the owner rolls back | it is refused, naming the draft or that there is nothing to restore; the draft is never overwritten |
| AG-19.20 | An Operator | they open a skill | the sheet opens with *You can read this skill. Editing needs the Modeller role — ask an Admin*; every tab reads; the editor is read-only and each act is disabled |
| AG-19.21 | A guided skill | Instructions or Flow opens | no plan is drawn; the Plan preview and Flow read *Guided — the model follows the instructions; each run shows the steps it took*, and *What it needs* lists the needs under `metadata:` |
| AG-19.22 | A guided draft | its owner switches it to *Planned* | the plan is drawn as AG-19.1, and Publish waits for it like any draft |
| AG-19.23 | A published planned version whose kept plan is gone | a run opens it | the plan is compiled again from the version's text, its answers and the function and workflow versions it named, and is the same plan |
| AG-19.24 | An open draft | its owner presses *Discard draft* | the draft, its answers and its plan go; the published version stays current and every agent it is added to is still offered it; a skill that never published reads *draft · empty* |
| AG-19.25 | A draft | its owner picks the model version the skill thinks with, or clears it | it is kept on the draft and publishes with the version, through the evals like any edit; a cleared one hands the choice to the agent; a step on this skill's plan calls it as AG-29.23 says, and one the deployment does not offer refuses the run, naming it |
| AG-19.26 | The command line | `invana skills list · history · push · publish · rollback` | they do what Studio does: *push* writes the draft from a file and draws it, and a draw that asks a question prints it and stops — the question is answered in Studio; *publish* and *rollback* pass the same evals gate; someone without the Modeller role, or a Modeller who does not own the skill, is refused, naming the role or its owners |
| AG-19.27 | A drawn plan with two steps under one key, a function the deployment lacks, or a named workflow that is retired, is given a value of the wrong type, or would nest past the depth limit or into a cycle (AG-F06) | it is drawn | nothing is written; it says why where the flow would be, naming the step, the function or the workflow and what is wrong, and the plan that was there is untouched |
| AG-19.28 | A Modeller who does not own a skill | they open its Instructions or History | everything reads; the editor is read-only and each act is disabled, naming its owners — *Only its owners or an Admin — ask Lee* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Instructions — editor, What it needs, Plan preview | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill · Draft | agents.skill · Does not hold together | agents.skill · Drawing | — |
| Instructions — editor, What it needs, Plan preview | Operator | agents.skill · Read only | — | agents.skill · Loading | agents.skill · Read only | agents.skill · Could not load | agents.skill · Drawing | agents.skill · Read only |
| A question under a sentence | Admin | — | — | — | agents.skill · A question | — | agents.skill · A question | — |
| A question under a sentence | Operator | — | — | — | agents.skill · Read only | — | agents.skill · Read only | agents.skill · Read only |
| A flagged line | Admin | — | — | — | agents.skill · Unmapped line | agents.skill · Unmapped line | — | — |
| A flagged line | Operator | — | — | — | agents.skill · Read only | agents.skill · Read only | — | agents.skill · Read only |
| Add functions | Admin | — | — | agents.skill · Loading | agents.skill · Add functions | agents.skill · Could not load | — | — |
| Add functions | Operator | — | — | — | — | — | — | agents.skill · Read only |
| Flow | Admin | agents.skill · Nothing drawn | — | agents.skill · Loading | agents.skill · Flow | agents.skill · Flow gap | agents.skill · Drawing | — |
| Flow — a guided skill | Admin | agents.skill · Guided | — | agents.skill · Loading | agents.skill · Guided | agents.skill · Could not load | — | — |
| Flow — a guided skill | Operator | agents.skill · Guided | — | agents.skill · Loading | agents.skill · Guided | agents.skill · Could not load | — | agents.skill · Guided |
| Flow | Operator | agents.skill · Nothing drawn | — | agents.skill · Loading | agents.skill · Flow | agents.skill · Flow gap | agents.skill · Drawing | agents.skill · Flow |
| A step selected | Admin | — | — | — | agents.skill · Flow step | — | — | — |
| A step selected | Operator | — | — | — | agents.skill · Flow step | — | — | agents.skill · Flow step |
| Publish | Admin | — | — | — | agents.skill · Publish | agents.skill · Publish refused | agents.skill · Eval running | — |
| Publish | Operator | — | — | — | — | — | — | agents.skill · Read only |
| Discard draft | Admin | — | — | — | agents.skill · Discard draft | agents.skill · Could not load | — | — |
| Discard draft | Operator | — | — | — | — | — | — | agents.skill · Read only |
| Model version | Admin | agents.skill · New draft | — | agents.skill · Loading | agents.skill · Model version | agents.skill · Publish refused | agents.skill · Eval running | — |
| Model version | Operator | agents.skill · Read only | — | agents.skill · Loading | agents.skill · Read only | agents.skill · Could not load | — | agents.skill · Read only |
| History | Admin | agents.skill · History one version | — | agents.skill · Loading | agents.skill · History | agents.skill · Roll back refused | — | — |
| History | Operator | agents.skill · History one version | — | agents.skill · Loading | agents.skill · History | agents.skill · Could not load | — | agents.skill · History |
| The drawing as a run | Admin | — | — | agents.run · Loading | agents.run | agents.run · Failed | agents.run · Running | — |
| The drawing as a run | Operator | — | — | agents.run · Loading | agents.run | agents.run · Failed | agents.run · Running | agents.run · Not found |
