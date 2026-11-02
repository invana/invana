# The skill page

A skill is a document. Its page is `instructions.md` in an editor with the functions it needs and a
short preview of its plan beside it, and nine tabs that read what those instructions became and how
they are used: **Instructions · Flow · Functions · Agents · Usage · Exceptions · Evals · Tests · History**.

| | |
|---|---|
| Index | [6.7](../../../README.md#6--skills) · Slice **F04** |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | 🟡 / — / ✅ |
| Related | [authoring-a-skill](authoring-a-skill.md) · [instructions-publish-rollback](instructions-publish-rollback.md) · [bindings](bindings.md) · [usage](usage.md) · [evals](evals.md) · [the-agent-page](../../agents/features/the-agent-page.md) · [the-agents-shell](../../agents/features/the-agents-shell.md) · products: [agent-fabric.md](../../../../products/agent-fabric.md) AF-03 · AF-04 · AF-22 |

Product spec: [AG-F04 · Skills](../../../../../specs/products/agents/features/AG-F04-skills/feature.md) — AG-19 · AG-20; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

| Tab | `?tab=` | Body | Reads / writes |
|---|---|---|---|
| Instructions | `instructions` (default) | `SkillInstructionsTab` — `MarkdownEditor` · `FunctionsNeededCard` · `PlanPreviewCard` | `GET/PATCH …/skills/{id}/draft` · `POST …/draft/draw` · `GET …/catalogue` |
| Flow | `flow` | `SkillFlowTab` — `TaskFlowCanvas` on Cards (`skills/flow/skillFlowConfig.ts`): a card per step (`step N` · function · `from line N` · bound), a handler card off its step, a gap card per unmapped line; + *From the instructions* + *This flow* / the step panel | `GET …/skills/{id}/draft` or `…/versions/{v}/tasks` |
| Functions | `functions` | `SkillFunctionsTab` — kit `Table` | the plan's rows + `GET …/catalogue` |
| Agents | `agents` | `SkillAgentsTab` | `GET …/skills/{id}/agents` · `POST/DELETE …/agents/{a}/skills/{id}` |
| Usage | `usage` | `SkillUsageTab` | `GET …/skills/{id}/usage` |
| Exceptions | `exceptions` | `SkillExceptionsTab` | `GET …/skills/{id}/exceptions` |
| Evals | `evals` | `SkillEvalsTab` (`EvalSetPanel` · `EvalGateCard`) | `GET …/evals/skill/{id}` · runs · `POST …/skills/{id}/versions` |
| Tests | `tests` | `SkillTestsTab` + `SkillConsole` under Instructions (Tests · Evals · Problems · Log, on the kit's `TabbedPanel`, foldable); *Run a test* in the head opens Instructions, where the console is | `GET …/skills/{id}/tests` · `POST …/skills/{id}/tests` |
| History | `history` | `SkillHistoryTab` — *Regenerated — vN* · *Who picks it up* over the version list | `GET …/history/skill/{id}/compare?b=vN` · `GET …/skills/{id}/agents` · `GET …/skills/{id}/versions` · diff · rollback |

## Engine

| Shape | Fields |
|---|---|
| `SkillDraftRead.unmapped` | the sentences the last draw could not map to a function, verbatim — each is flagged under its line |
| `SkillPlanRead.handlers` | one row per line under `## When things go wrong`, in order: `span` (the line, verbatim) · `step_id` (the step it guards, or null when the line names none) |
| `GET …/skills/{id}/exceptions?window=30d` | `days` · `since` · `runs` · `replanned` · `replans_p95` · `max_replans` · `hit_limit` over the runs offered this skill, from `task_runs.replans`; `items[]` (exception, function, handled_by, source, seen, served_rate) — empty until runs record their handlers (F05) |
| `POST …/skills/{id}/tests` | body `question` → `202` `{run_id, stream_url}`: a real run of the draft (or the head with no draft) on that question, marked `test`, paid from the eval budget |
| `GET …/skills/{id}/tests` | `Page` of test runs: id · question · tokens · duration_ms · outcome · status · finished_at |

A step's line number is where its `source_span` reads in the text on screen; a span that no longer
appears in the text is drawn without a line.

## Decisions

Engine rows, and rows that stay until they are settled; the product decisions are AG-F04's.

| # | Decision |
|---|---|
| SP8 | **Exceptions, Tests and the per-step test counts are engine reads.** A column the engine does not return is left out, never derived from a list of runs (CLAUDE.md rule 13) |
| SP11 | **A handler guards the step it names**: `handlers[].step_id` is the step whose function the line names, else null and the handler is drawn under the plan's last step. Runs that record which handler fired arrive with replans (F05) |
| SP12 | **Exceptions shows the stored replan numbers now**; its table fills when runs record their handlers (F05), and its empty state says *No exceptions recorded yet* |
| SP13 | **`unmapped` is read off the last settled draw**, the `plan.draft` step's `output.unmapped`, beside its refusal; while a draw is in flight it is empty, as `refusal` is |
| SP14 | **Handlers are parsed from the version's text, never drawn**: every non-empty line under a `When things go wrong` heading until the next level-one or level-two heading, its list marker dropped. `step_id` is the first plan node whose dotted function the line names as a whole word, else the first whose function's last segment it names, else null |
| SP15 | **Exceptions counts root runs queued in the last `days` UTC calendar days whose root or a step was offered any published version of the skill**, eval and test runs left out. `hit_limit` is a run whose `replans` reached its own agent's `effort.max_replans`; a skill carries no limit, so `max_replans` is null |
| SP16 | **A test is a one-question eval replay**: a root run with `role = evaluate` and the label `test:skill:<id>`, opened under no agent, replaying the draft (or the head) exactly as an eval case does. The label keeps it out of the skill's eval runs and every agent's numbers; the role puts its spend on the eval budget |
| SP18 | **Instructions is the document over a docked console**: a vertical resizable split, the editor filling the space above, the console (Tests · Evals · Problems · Log) full width below; folding the console leaves its tab strip. The Flow draws every step chained in plan order, one gap card per unmapped line after the step written before it, and *From the instructions* has one row per line |
| SP20 | **The Flow is one column of steps with the side cards in a column to their right.** The canvas lays the cards out with ELK's model order (steps come first in the data, so first in every layer) and network-simplex node placement, which keeps the chain straight. An edge between two steps that a longer path already joins — `translate → query` beside `translate → validate → query` — is not drawn, since it would pull the middle step off the column; the step panel still reads the plan's own edges. A side card sits one row below the step it hangs off, and a card off the last step sits under it. The fit is the board's own (padding 70, capped at 100%) |

## Not building

| Item | Why |
|---|---|
| Records of which handler fired on a run, and *Adopt* from them | Runs record replans, not the handler that guided each one; Exceptions shows the stored replan numbers and says *No exceptions recorded yet* |
| *Ask an owner* on a locked skill | Asking for access is an access request, and access requests arrive with IAM (I01); the notice names who to ask |
| *Publishing a skill that writes needs a Graph owner* | The engine gates every skill write by the `build` area alone; an owner-only gate on skills that write arrives with IAM's policies (I01) |
| A side card on its step's own row | ELK lays an edge's target a layer below its source, and the canvas passes no per-node layout options (a layer-choice constraint) to pin it beside its step (canvas) |
