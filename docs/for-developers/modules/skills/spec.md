# Skills — module spec

What a run is **given** before it runs. Two kinds, one mechanism: a **skill** is a playbook that
may be offered, a **rule** is a statement that is always true. Both are authored once, reused
everywhere, and reach a step as discrete items with ids — so a step can report which it applied and a
trace can name them.

> ⚠ **Rewritten for [orchestration § 0](../../orchestration.md#0-the-records)** — `Todo` · `TaskPlan` ·
> `Task` · `TaskRun` · `Lens`. The words *Thought*, *Thinking* and *Step-as-a-record* are retired, and
> **`Task` now names a node inside a plan**, never a thing a user authored. Migration:
> [task-model-migration.md](../../building-engine/task-model-migration.md).

| | |
|---|---|
| Index | [§6 · Skills](../../README.md#6--skills) |
| Features | [authoring-a-skill](features/authoring-a-skill.md) · [bindings](features/bindings.md) · [usage](features/usage.md) · [rules](features/rules.md) |
| Depends on | — (authored against a Graph, before any agent exists) |
| Depended on by | [Agents](../agents/spec.md) (binds them) · [Ask](../ask/spec.md) (assembles them) · [Work](../work/spec.md) (project rules) |

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Skill** | a named playbook with a "when to use" — offered to a step | an instruction the agent must obey |
| **Rule** | a statement that is always true in its scope | a skill |
| **Offered** | present in the step's context, with an id | applied |
| **Applied** | the step reported using it | proof it was used well |
| **Binding** | which agent may be offered which skill | a permission |

## 2. Offered, not obeyed

The distinction the whole module rests on:

| | Skill | Rule |
|---|---|---|
| Shape | a playbook — how to approach something | one statement — what is true |
| Scope | bound to agents | `invariant` on a Graph · `working` on a Project |
| At run time | offered to a step, which may use it | offered to every step in scope |
| Recorded | offered / reported applied, per step | cited by the steps that used it |
| Authored by | a person | a person |

**Neither is enforced.** A skill the model ignores leaves a gap between *offered* and *applied*, and
that gap is the signal a person acts on — by rewriting the skill, or by unbinding it. A rule that must
be enforced is not a rule; it is an envelope bound ([Agents](../agents/spec.md)) or a criterion
([Work](../work/spec.md)).

## 3. What this module owns

| Owns | Shape |
|---|---|
| `skills` | `graph_id` · `name` (unique per Graph) · `current_version_id` |
| `skill_versions` | `skill_id` · `version` · `description` · `content` · `when_to_use` · `published_by_id` · `published_at` — immutable once published. `plan_id` arrives with [M8](../../building-engine/task-model-migration.md) ([SK13](features/authoring-a-skill.md#decisions)) |
| `skill_bindings` | `skill_id` · `agent_id` · `bound_by_id` · `bound_at` — unique on the pair; the binding follows the current version ([BN6](features/bindings.md#decisions)) |
| `rules` | `graph_id` · `project_id?` · `active` · `order` · `current_version_id` — **one axis**: `scope` and `kind` are derived from `project_id`, never stored ([RU6](features/rules.md#decisions)) |
| `rule_versions` | `rule_id` · `version` · `statement` · `published_by_id` · `published_at` — immutable once published |
| Usage | derived: every step that was offered a skill *version*, and whether it reported applying it |

### Versions

**Version what is offered.** A skill and a rule both reach a step as context, and a trace has to say
what the step was given — not what the text says today.

| Rule | Detail |
|---|---|
| A published version is immutable | Editing publishes the next version; the previous one keeps resolving |
| A step records the version it was offered | `skill_version_id` · `rule_version_id`, never the bare id |
| A binding points at the skill, not a version | An agent gets the current version at run time — bindings do not pin |
| Evidence is per version | "Offered 40, applied 2" is a claim about v3, and v4 starts its own count |
| Deactivating is not a version | `active = false` stops a rule being offered; the versions stay |

## 4. How they reach a step

```mermaid
flowchart LR
    GR[Graph rules · invariants] --> CTX[Context for this run]
    PR[Project rules · working] --> CTX
    SK[Skills bound to the agent] --> CTX
    CTX -->|discrete items, each with an id| ST[Step]
    ST -->|reports| AP[applied: skill ids]
    ST -->|cites| CI[rule ids]
    AP --> U[Usage]
    CI --> TR[Trace]
```

| Assembly rule | Detail |
|---|---|
| Order is fixed | graph rules → project rules → criteria in scope → the agent's skills |
| Nothing is concatenated | each arrives as its own item, so it can be cited, counted and diffed |
| A skill is offered only if bound | an unbound skill exists but never reaches a step |
| An inactive rule is not offered | deactivating is how a rule stops applying, without deleting the record |

## 5. Editing what an agent knows

The loop this module exists to serve:

```mermaid
flowchart TD
    A[A run reads badly] --> B[Open the step]
    B --> C{Offered but not applied?}
    C -->|yes| D[The skill did not fit the moment —<br/>rewrite `when_to_use`]
    C -->|no, never offered| E[Bind it to the agent]
    C -->|applied and still wrong| F[Rewrite the content, or unbind]
    D --> G[Next run is offered the new version]
    E --> G
    F --> G
```

Every edit is an event, so the change and its effect sit in the same history.

## 5a. The drawn states

The module's artboards, on [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) —
**four pages, one per stacked panel**: *Skills · Bindings · Usage · Rules*. Each page carries the whole
feature — the primary journey, each drill-in, the authoring act, every refusal with the bound it names,
and the empty, too-few and permission-denied states. Each artboard is written into the feature file it
draws before any of it is built ([README › How a module gets built](../../README.md#how-a-module-gets-built)).

### Skills — [6.1](features/authoring-a-skill.md)

| Artboard | What it shows | Settles |
|---|---|---|
| `SkillsPanel` | the two drawers, and the skill/rule line as a table | § 2 — a playbook has steps, a statement never does |
| `SkillAuthor` | the **Playbook** tab: each sentence showing the step it produced, and `draft_plan` asking which of two readings sentence 2 means | C10 · SK6 — it never guesses; nothing is written until it is answered |
| `SkillFlow` | the **Flow** tab: the plan in the **six layers** it will touch | SK16 — one flow view, and it is the layer one |
| `SkillUsesPlan` | a skill inlining the library's `nl-single@2` with `uses`, tuning the one argument it declares, and the two tunings its declaration refuses | SK18 · SK32 · SK33 · LB18 · LB19 · LB20 |
| `SkillVersions` | seven versions, the v4→v5 prose-and-plan diff, a hand-edit flipping `origin` | SK2 · SK5 · SK7 · SK19 |

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

| # | Decision |
|---|---|
| S1 | Skills are offered, never forced. Application is self-reported and recorded per step. |
| S2 | Rules are discrete statements with ids, never a concatenated block. |
| S3 | A skill reaches a step only through a binding on the agent. |
| S4 | Rule scope is fixed: invariants on a Graph, working rules on a Project. Nothing else has rules. |
| S5 | Deactivate rather than delete — usage and traces must stay resolvable. |
| S6 | Neither skills nor rules are enforcement. Enforcement is an envelope bound or a criterion. |
| S7 | **Every reading this module owns opens as a declared board, and the stack stays.** Three kinds — `skill` · `skill_usage` · `rule` — each bound to one record through `subject_id`, each composed as one `DashboardSpec` from the reads the drawer already makes ([CV12](../explore/features/boards.md)). The split is by tense and by record, not by screen size: a drawer answers *which one*, a board answers *what happened*. **The board reads and the drawer writes** — publishing a version, binding an agent and deactivating a rule all stay where the thing being changed is written, so a page anybody may open carries no act with a consequence to read. Panel sets, seams and the JSON: [skills-dashboards.md](../../building-studio/skills-dashboards.md). |

## 7. Deliberately absent

| Not built | Because |
|---|---|
| Skill priority or ordering | a skill is offered or it is not; ranking implies enforcement |
| Automatic skill selection by embedding | `when_to_use` is written by a person and is auditable |
| Rules that execute | a rule is offered to a run; it does not fire |
| Agent memory that writes its own skills | edits stay human-reviewed, on evidence |
| Cross-Graph skill sharing | portability is a later question, and belongs with domain models |
