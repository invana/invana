# Skills — module spec

| | |
|---|---|
| Index | [§6 · Skills](../../README.md#6--skills) |
| Features | [authoring-a-skill](features/authoring-a-skill.md) · [bindings](features/bindings.md) · [usage](features/usage.md) · [rules](features/rules.md) · [instructions-publish-rollback](features/instructions-publish-rollback.md) · [evals](features/evals.md) |
| Depends on | — (authored against a Graph, before any agent exists) |
| Depended on by | [Agents](../agents/spec.md) (binds them) · [Ask](../ask/spec.md) (assembles them) · [Work](../work/spec.md) (project rules) |

System design: [skills.md](../../../../specs/system-design/modules/skills.md) — offered not obeyed, the skill tables and versions, how they reach a step, editing what an agent knows. This file keeps the vocabulary, the retired rule records and drawn states, the decisions and what it does not build.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Skill** | a named playbook with a "when to use" — offered to a step | an instruction the agent must obey |
| **Rule** | a statement that is always true in its scope | a skill |
| **Offered** | present in the step's context, with an id | applied |
| **Applied** | the step reported using it | proof it was used well |
| **Binding** | which agent may be offered which skill | a permission |

## 3. What this module owns

The rule records below are superseded by [MO-F06](../../../../specs/capabilities/model/features/MO-F06-rules-agents-work-by/feature.md) (three scopes, checked rules); the skill records moved.

| Owns | Shape |
|---|---|
| `rules` | `graph_id` · `project_id?` · `active` · `order` · `current_version_id` — **one axis**: `scope` and `kind` are derived from `project_id`, never stored ([RU6](features/rules.md#decisions)) |
| `rule_versions` | `rule_id` · `version` · `statement` · `published_by_id` · `published_at` — immutable once published |

## 5a. The drawn states

The module's artboards, on [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) —
**four pages, one per stacked panel**: *Skills · Bindings · Usage · Rules*. Each page carries the whole
feature — the primary journey, each drill-in, the authoring act, every refusal with the bound it names,
and the empty, too-few and permission-denied states. Each artboard is written into the feature file it
draws before any of it is built ([README › How a module gets built](../../README.md#how-a-module-gets-built)).

### Skills — [6.1](features/authoring-a-skill.md)

| Artboard | What it shows | Settles |
|---|---|---|
| `SkillsViewPanel` | the two drawers, and the skill/rule line as a table | § 2 — a playbook has steps, a statement never does |
| `SkillAuthor` | the **Playbook** tab: each sentence showing the step it produced, and `draft_plan` asking which of two readings sentence 2 means | C10 · SK6 — it never guesses; nothing is written until it is answered |
| `SkillFlow` | the **Flow** tab: the plan in the **six layers** it will touch | SK16 — one flow view, and it is the layer one |
| `SkillUsesPlan` | a skill inlining the library's `nl-single@2` with `uses`, tuning the one argument it declares, and the two tunings its declaration refuses. The plan is named in the prose and inlined at the draw; any picker the artboard draws is not built | SK18 · SK32 · SK33 · LB18 · LB19 · LB20 · IS11 |
| `SkillVersions` | seven versions, the v4→v5 prose-and-plan diff. The hand-edit it also draws is not built ([IS3](features/instructions-publish-rollback.md#decisions)) | SK2 · SK5 · SK7 · SK19 |

### Bindings — [6.2](features/bindings.md)

| Artboard | What it shows | Settles |
|---|---|---|
| `SkillBindings` | bound · refused · unbound, each row naming the agent's **world** | BN2 · BN5 |
| `BindRefusals` | both checks side by side — the envelope naming its bound, the lens naming its rule — the refusal payload, and **which half is not built yet** | BN5 · BN7 |
| `BindFromAgent` | binding from the agent's panel: the picker binds **as you click**, a spawned child's bindings, the routes and the two events | BN4 · BN6 · BN8 · C3 |
| `SkillOffer` | the fixed assembly order, the context as discrete items with ids, and what the record holds afterwards | § 4 — nothing is concatenated |
| `BindSeams` | a **draft** bound to an agent · bound to nobody · binding everything · unbinding mid-run · refused · read-only | C4 · BN3 · BN14 · seams |

### Usage — [6.3](features/usage.md)

| Artboard | What it shows | Settles |
|---|---|---|
| `SkillUsage` | offered 1,204 / applied 1,190 / the gap, per version, by agent, by run outcome | US1–US4 |
| `UsageVersions` | every published version with `enough_to_read`, when each count started, and the v1 migration | US3 · US5 · SK19 |
| `UsageReadings` | by agent, the bounded step list, and the four readings with the move each one names | C4 · C6 · C7 |
| `UsageSeams` | too few to read · no data yet · just published · purged · self-reported · nothing has run | US4 · US6 |

### Rules — [6.4](features/rules.md)

| Artboard | What it shows | Settles |
|---|---|---|
| `RulesPanel` | the drawer of statements with one inactive, the rule's fields, where it was cited, and the four statements that are **not** rules | RU1–RU3 · RU6 |
| `RuleAuthor` | writing one: the statement, the scope, the order — and the nudge that a long statement is two rules | RU1 · RU2 · C1 |
| `RuleCited` | `rules_offered` against `rules_cited`, the version list, and what deactivating keeps | RU4 · RU7 |
| `RulesProject` | a Project's working rules with its Graph's invariants read-only above, the assembled order, and the response's two lists | C3 · RU2 · RU6 |

**Two things the drawings settled that the documents did not have:** the skill's detail lives in the
drilled-in drawer with four tabs ([SK17](features/authoring-a-skill.md)), and the Flow tab is the layer
view rather than a node graph ([SK16](features/authoring-a-skill.md)).

**One canon, four pages.** Every page draws the same Graph: five skills — *Answer in natural
language · v7* with seven versions, one that `uses` the library's `nl-single@2`, one a **draft**
and one bound to nobody ([SK35](features/authoring-a-skill.md#decisions)) — the agents of
[5.2](../agents/features/author-an-agent.md), four statements with one inactive, and one project. A number that appears on two artboards is the same number — `.design/canvas-govern-agents/_sk.py`
is where it is written once.

---

## 6. Cross-feature decisions

Engine rows, and rows that stay until they are settled; the product decisions are [Agents](../../../../specs/capabilities/agents/product.md) › Decisions and [AG-F04 · Skills](../../../../specs/capabilities/agents/features/AG-F04-skills/feature.md).

| # | Decision |
|---|---|
| S2 | Rules are discrete statements with ids, never a concatenated block. |
| S4 | Rule scope is fixed: invariants on a Graph, working rules on a Project. Nothing else has rules. |
| S5 | Deactivate rather than delete — usage and traces must stay resolvable. |
| S6 | Neither skills nor rules are enforcement. Enforcement is an envelope bound or a criterion. |
| S7 | **Every reading this module owns opens as a declared board, and the stack stays.** Three kinds — `skill` · `skill_usage` · `rule` — each bound to one record through `subject_id`, each composed as one `BoardSpec` from the reads the drawer already makes ([CV12](../explore/features/boards.md)). The split is by tense and by record, not by screen size: a drawer answers *which one*, a board answers *what happened*. **The board reads and the drawer writes** — publishing a version, binding an agent and deactivating a rule all stay where the thing being changed is written, so a page anybody may open carries no act with a consequence to read. Panel sets, seams and the JSON: skills-boards.md. |

## 7. Deliberately absent

| Not built | Because |
|---|---|
| Rules that execute | a rule is offered to a run; it does not fire |
| Cross-Graph skill sharing | portability is a later question, and belongs with domain models |
