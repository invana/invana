# S4 · A skill uses a plan

**The third Skills pass.** [M8](skills-draw-as-plans.md) gave every skill version a plan of its own,
drawn from its prose. This is the other way a version's plan gets its steps: **it inlines one the
Library already holds**, and tunes the arguments that make it fit ([SK18](../modules/skills/features/authoring-a-skill.md#decisions)
· [LB18 · LB19](../modules/workflows/features/the-library.md#decisions)).

| | |
|---|---|
| Ships | [6.1 Authoring](../modules/skills/features/authoring-a-skill.md) — SK18's `uses` half · [7.6 The Library](../modules/workflows/features/the-library.md) — LB18 · LB19 |
| Drawn in | [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — page *Skills*, artboard `SkillUsesPlan` |
| Worked example | **Ask about routes and airports** inlining `nl-single@1` instead of redrawing its five steps |
| Needs | `task_plans` + `tasks` (M2 ✅) · a version owning a plan (M8 ✅) · the hand-edit route (M8 ✅) |

## 1. What the tree already has, and what it does not

| Piece | State | Where |
|---|---|---|
| `task_plans.args_schema` | ❌ the column exists, is always `{}`, and **nothing reads it** | `apps/task_plans/models.py:111` |
| `uses` | ❌ named in [13.8 § 4](../modules/platform/features/runtime.md) and **deferred there** (§ 21). No code | — |
| `TaskForm.composite` | ❌ the value exists; nothing writes one and the interpreter has never walked one | `apps/task_plans/models.py:72` |
| The binding grammar | 🟡 `${steps.X.y}` only | `apps/agents/envelope.py:36` |
| Reusable plans to inline | ✅ eight, seeded `builtin` | `bulk-load` · `bundle-import` · `model-import` · `modeller-propose` · `nl-compare` · `nl-single` · `ql-direct` · `stitch-apply` |

`task_plans.source_skill_version_ids` is **not** where a `uses` is recorded, despite being the obvious
candidate. It points the other way — *which playbooks the planner read when `origin = generated`*
([orchestration § 0.8](../orchestration.md)) — and overloading it would make one column mean both
*this plan was drafted from those skills* and *this plan inlines that plan*.

## 2. The fork this pass settles: expand when?

`uses` could expand at **run** time (the runtime resolves it before validation, as 13.8 § 4 describes)
or at **authoring** time (the rows are copied into the calling plan the moment someone composes it).

| | Run-time expansion | **Authoring-time expansion** ✅ |
|---|---|---|
| A library edit | silently changes every skill that points at it | changes nothing; the copy is the skill's |
| [SK5](../modules/skills/features/authoring-a-skill.md#decisions) — a version's plan is never stale against its prose | breaks: the prose is frozen, the steps are not | holds |
| What the runtime must learn | `uses` resolution, depth bounds, a composite node the interpreter walks | **nothing** |
| What the Flow tab draws | a node that hides five steps | the five steps, grouped |
| What the envelope validates | the expanded graph, at run time | the expanded graph, at save time — the same graph |

So **a `uses` is an act, not a link** ([SK32](../modules/skills/features/authoring-a-skill.md#decisions)),
and it is also what [LB18](../modules/workflows/features/the-library.md#decisions) already argues for:
*inlines it*, never *shares its row*.

It follows that the inlined steps are **flat siblings**, not children of a composite node
([SK33](../modules/skills/features/authoring-a-skill.md#decisions)). A composite parent would need an
interpreter that walks one, and it would buy only a drawing — which `source_plan_key` gives for free.

## 3. Data model

One migration — `000000000052_a_skill_uses_a_plan`.

| Table | Change | Notes |
|---|---|---|
| `tasks` | **+ `source_plan_key`** `String(80)` nullable | `nl-single@1` — the plan version this row was copied from, `NULL` for a row somebody wrote. What the Flow tab groups by, and what a re-inline replaces |
| `task_plans` | **+ `uses`** `JSON`, default `[]`, NOT NULL | what this plan composed, and with which arguments — § 5 |
| `task_plans` | `args_schema` — **given a shape**, no DDL | `{"<name>": {"type": "str｜int｜bool", "default": …, "label": …}}`. Declared on the plan being inlined, read by the caller ([LB19](../modules/workflows/features/the-library.md#decisions)) |

**`nl-single@2`** declares the one argument that tail genuinely has: `read_only`, default `true`, bound
by its `execute_graph_query` row as `${args.read_only}` — so the mechanism ships with a real user
rather than a demonstration one.

It is a **new version, not an edit to `@1`**. A library version is immutable, and a changed shape
mints `key@n+1` ([LB1](../modules/workflows/features/the-library.md#decisions)): editing `@1` would
have given a fresh install rows that bind `${args.read_only}` and an existing one rows holding a
literal `true`, under one name — which is the drift immutability exists to prevent. `@1` stays where
it is, and `find_by_key` takes the newest.

**Inlined keys are prefixed with the calling row's key** — `answer_translate_thought` — because two
inlined plans may both name `validate_query`. An underscore and not a dot: a step id is `[A-Za-z0-9_]`
in the binding grammar, so `${steps.answer.translate_thought.query}` would parse as *step `answer`,
output `translate_thought.query`*. The copied plan's own bindings are rewritten to the prefixed keys,
so a plan that bound its own steps still binds them and not whatever the skill happens to call them.

## 4. The grammar learns one more shape

`${args.<name>}` joins `${steps.X.y}`, and it is resolved **at expansion**, never at run time — the
calling plan's rows carry the tuned literal, so the interpreter sees what it has always seen.

| Rule | Why |
|---|---|
| `${args.N}` is legal only in a **reusable** plan that declares `N` | an argument nothing declares is a typo, and a one-off plan has no caller to tune it |
| An undeclared `N` is refused **by name**, at save | the same bargain every other refusal makes |
| A tuned value must match the declared `type` | a `grace_days: "soon"` is a plan that cannot run, discovered now rather than at 3am |
| A name the caller does not tune takes the **default** | which is what makes *inline it and leave it alone* the one-click case |

## 5. What a composition records

On the calling plan, because *what this plan will do for me* must be answerable without opening the
library ([LB19](../modules/workflows/features/the-library.md#decisions)):

```
task_plans.uses = [{"key": "nl-single", "version": 1, "args": {"read_only": false}}]
```

It is its own column, written by the same migration — not a corner of `args_schema`, which is what a
plan *offers*, where this is what a plan *spent*. Every inlined row also carries
`source_plan_key = "nl-single@1"`, so the plan-level record and the row-level one agree and either can
be read alone: the first answers *what did this compose*, the second *where did this row come from*.

## 6. Routes

| Route | Does |
|---|---|
| `GET …/skills/inlinable` | the reusable plans this Graph can inline, each with its `args_schema`, step count and layers — the picker's one read, and the library's seed-on-read like every other reader of it |
| `PATCH …/skills/{id}/draft/tasks` | **unchanged in shape.** A row may now carry `uses` instead of a `step_key`, and the manager expands it before validating |

Expansion is not its own route: inlining is an edit to the draft's rows, and it publishes with them.

## 7. Slices

| # | Slice | Done when |
|---|---|---|
| **S4a** ✅ | The migration, `args_schema`'s shape, `${args.N}` in the grammar, and `nl-single@1` declaring `read_only` | **Done.** A reusable plan declares an argument, its row binds it, a plan selected directly resolves it to the declared default before anything validates, and an undeclared name is refused by name |
| **S4b** ✅ | Expansion — a `uses` row becomes the inlined steps, flat, each carrying `source_plan_key`, validated as one graph | **Done.** Hand-editing a draft to `uses: nl-single@1` writes five rows keyed `answer_*`, the tuned `read_only` lands on `execute_graph_query`, the copied plan's own bindings follow the copies, and `task_plans.uses` records the act |
| **S4c** ✅ | `GET …/skills/inlinable`, and Studio's picker + argument tuning in `SkillPlanEditor` | **Done.** The picker lists the eight reusable plans with their bands, step counts and what each offers; inlining `nl-single@2` and tuning `read_only` writes five rows and records the composition; re-opening the editor collapses those five back into the one row that wrote them |

## 8. Not in this pass

| Not building | Because |
|---|---|
| A composite node the interpreter walks | § 2 — it buys a drawing, and costs an interpreter |
| Run-time `uses` resolution | § 2 — it breaks [SK5](../modules/skills/features/authoring-a-skill.md#decisions) |
| Re-inlining when the library plan publishes `@2` | the copy is the point. *A newer version exists* is a thing to **say** on the row, and acting on it is a re-inline somebody asks for |
| `uses` inside a library plan | the Library authors its own plans ([7.7](../modules/workflows/features/draft-a-plan.md)); this pass is the skill's side of it |
| Arguments on a one-off plan | nothing calls it, so nothing tunes it |
