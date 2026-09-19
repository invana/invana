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
| `skill_versions` | `skill_id` · `version` · `description` · `content` · `when_to_use` · `published_at` — immutable once published |
| `skill_bindings` | `skill_id` · `agent_id` · `bound_by` · `bound_at` — the binding follows the current version ([BN6](features/bindings.md#decisions)) |
| `rules` | `scope (graph\|project)` · `owner_id` · `kind (invariant\|working)` · `active` · `order` · `current_version_id` |
| `rule_versions` | `rule_id` · `version` · `statement` · `published_at` — immutable once published |
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

The module's artboards, on [Govern, Agents and Skills](%s) — pages *Skills · Bindings · Usage · Rules*.
Each one is written into the feature file it draws before any of it is built
([README › How a module gets built](../../README.md#how-a-module-gets-built)).

| Artboard | Feature | What it shows | Settles |
|---|---|---|---|
| `SkillsPanel` | [6.1](features/authoring-a-skill.md) · [6.4](features/rules.md) | the two drawers, and the skill/rule line as a table | § 2 — a playbook has steps, a statement never does |
| `SkillAuthor` | [6.1](features/authoring-a-skill.md) | the **Playbook** tab: prose with each sentence showing the step it produced, and `draft_plan` asking which of two readings sentence 4 means | C10 · SK6 — it never guesses; nothing is written until it is answered |
| `SkillFlow` | [6.1](features/authoring-a-skill.md) | the **Flow** tab: the plan drawn in the **six layers** it will touch, `cache` dark, `third party` named | SK16 — one flow view, and it is the layer one |
| `SkillUsesPlan` | [6.1](features/authoring-a-skill.md) · [7.1](../workflows/features/the-library.md) | a skill inlining `escalate-core@2` with `uses`, and tuning one argument for its use case | SK18 · LB18 · LB19 — create and tune here; author in the Library |
| `SkillVersions` | [6.1](features/authoring-a-skill.md) | four versions, the v2→v3 prose-and-plan diff, a hand-edit flipping `origin` | SK2 · SK5 · SK7 |
| `SkillBindings` | [6.2](features/bindings.md) | bound · refused · unbound, and **two refusals** — the envelope, and the lens naming the rule | BN5 — both checks are at bind time |
| `SkillOffer` | [6.2](features/bindings.md) · § 4 | the fixed assembly order, the context as discrete items with ids, what the step reported back | § 4 — nothing is concatenated |
| `SkillUsage` | [6.3](features/usage.md) | offered 40 / applied 31 / the gap, per version, by agent, by outcome | US1–US4 — counted, per version, self-reported |
| `RulesPanel` | [6.4](features/rules.md) | one statement, two scopes, where it was cited, and the four statements that are **not** rules | RU1–RU5 |

**Two things the drawings settled that the documents did not have:** the skill's detail lives in the
drilled-in drawer with four tabs ([SK17](features/authoring-a-skill.md)), and the Flow tab is the layer
view rather than a node graph ([SK16](features/authoring-a-skill.md)).

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

## 7. Deliberately absent

| Not built | Because |
|---|---|
| Skill priority or ordering | a skill is offered or it is not; ranking implies enforcement |
| Automatic skill selection by embedding | `when_to_use` is written by a person and is auditable |
| Rules that execute | a rule is offered to a run; it does not fire |
| Agent memory that writes its own skills | edits stay human-reviewed, on evidence |
| Cross-Graph skill sharing | portability is a later question, and belongs with domain models |
