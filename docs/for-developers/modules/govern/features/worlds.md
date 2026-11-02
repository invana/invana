# Worlds

A named narrowing you pick per question — which models, which slice of them, which LLM decides, what
may leave. Run the same question in two and read the difference.

| | |
|---|---|
| Index | [14.1](../../../README.md#14--govern) · Slice **S16** |
| Module | [Govern](../spec.md) |
| API / CLI / Studio | ✅ / 🟡 / ✅ |
| Related | [guardrails](guardrails.md) (what a world may never widen) · [see-what-ran](../../operate/features/see-what-ran.md) (where the retune starts) |

Product spec: [MO-F05 · Views of the graph and what must always hold](../../../../../specs/products/model/features/MO-F05-views-of-the-graph-and-what-must-always-hold/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Components |
|---|---|---|
| Worlds page | `/modeller/worlds?world=<id>` — leftSection: the Govern panel (Model · Worlds · Guardrails tabs; a type filter; models with their types, worlds with *lens on* beside the open one, guardrails with their type count). Main: the **lens canvas** — `GlobalModelBoard` schema cards, hidden types dimmed, each guarded property a shield chip — under a floating Lens strip (`Lens <world> ▾ · <types> hidden · N guarded`). The page's right column is the **world inspector**: the world and a `world` chip, tabs **Sees** (Models *N of M*, each `all` · `sliced` · `hidden`; Window time and geography; Thinks with; Used by) · **Answers go** (each `llm` and `third_party` destination with what may leave) · **Used by** (agents, schedules and people with their runs), and *Open board* · *Next: guardrails* ([WO22](#decisions)) | `GlobalModelBoard` · `Tabs` · `PropertyList` · `Select` |
| World board | `/modeller/worlds/<id>` — head `Worlds › <world>` · `last used …` · `world` · `used in N runs` · *Edit*; tiles Rules · Closed layers · In force · Runs (30 days) · Last used; **Five layers** (layer · what it allows · `sliced` · `allowed` · `closed` · `denied`) beside **Cast — who runs inside it** (agent · runs · last) ([WO23](#decisions)) | `Board` |
| Worlds drawer | First drawer of the **Govern** stack ([GV17](../spec.md)). Header: label · count · `+` · search · filter ([G36](../../../building-studio/graph-detail-page.md)). Body: the locked guardrails strip, then the list | `PanelStack` · `PanelBox` · `SearchInput` · `EmptyState` |
| A world row | Name · the chips it narrows by · run count and last use | **`LensRow`** · `LayerChip` |
| A world's detail | The drill-in — header `‹ WORLDS / EU · H1 2026`; a summary band (*narrows · used · validated*), then five sections one per layer, then the cast, then `as_of`; `Compare` · `Promote` · `Duplicate` | `RecordHeader` · **`LayerSection`** · **`RuleRow`** · **`SliceSummary`** · **`CastTable`** |
| A world's board | A page in `Workbook`, id `world:<lens_id>`, **titled with the world's name**. The auditor's document: what it narrows, how it has been used, every rule as an addressable row, the cast resolved against the guardrails, and `spec.json`. Opens with the drill-in ([WO15](#decisions)) | `Board` — `properties` · `metrics` · `table` · `text` |
| Authoring | Picking, never free text — every control is a choice over what the Graph already declares ([WO7](#decisions)) | `Field` · `Checkbox` · `RichSelect` · **`CannotAnswerCard`** for each refusal |
| The chip | In the session's composer, between the ask kind and the agent. Opens the picker upward. Reads **`Everything`** when none is set | **`LensChip`** |
| Compare | A page in `Workbook`, id `compare:<runA>:<runB>` | `DiffList` · **`AddressChip`** · `MetricTile` |
| Retune | A control on the run board's *This run's lens* band | |

Components in **bold** do not exist yet and are built in `design-kit` first, with a story —
[building-studio/govern-and-agents-panels.md § 3](../../../building-studio/govern-and-agents-panels.md).

---

## Engine

Full schema: [building-engine/govern-and-agents-data-model.md](../../../building-engine/govern-and-agents-data-model.md).

| Thing | Shape |
|---|---|
| `lenses` | `kind = world` · `key` (slug) null while private · `name` (the typed text) · `rules` · `cast` · `as_of` · `created_in_run_id` · `version` |
| Naming | `PATCH …/lenses/{id}` setting `key` **and** `name` — the write that publishes. Emits `lens.named` |
| The lens view | `GET …/govern/view?world=<id>` — `LensView`: `world` · `models[{name, version, seen: all · sliced · hidden}]` · `types[{model, type, hidden, sliced, excluded[], guarded[{property, guardrail_id, guardrail, access, leaves}]}]` · `hidden_types[]` · `guarded` (count) · `window{time, geo}` · `thinks_with{role: address}` · `answers_go[{address, may_send[] · null}]` · `used_by[{kind, id, name, runs}]`. Without `world` it is the guardrails alone. Resolved by the engine against every published version, through the same compile the connector is handed |
| Usage | `GET …/lenses/{id}/usage` adds `runs_30d` and `by_agent[{agent_id, name, runs, last_at}]` — the board's cast |
| Validation at edit | A world is checked against the effective guardrails **when saved**, not when run — `POST …/lenses/validate` for the draft |
| The catalogue | `GET …/graphs/{id}/participants` — what the pickers offer, resolved live from published versions, `llm_models`, cache kinds and roles ([GV21](../spec.md)) |
| Declared axes | `graph_versions.axes` — `{time, geo, dims}`. Empty means nothing is selectable, and a slice on an undeclared axis is refused naming the model and the axis |
| Usage | one `GROUP BY lens_id` over `task_runs`: count, last use, distinct actors. No counter column |
| Resolution | `effective = agent ∩ plan ∩ todo`, computed at run open, frozen as `lens_snapshot` |
| Routes | `GET · POST · PATCH · DELETE …/lenses?kind=world` · `POST …/lenses/{id}/duplicate` · `POST …/lenses/validate` · `GET …/lenses/{id}/usage` |

---

## Decisions

| # | Decision |
|---|---|
| WO8 | **The drill-in is the record, in its order:** a summary band, then one section per layer, then the cast, then `as_of`. A world is read as one object because that is what an auditor is handed ([GV1](../spec.md)) — a tabbed world would make *what may this run see* a thing you assemble from four tabs. |
| WO10 | **One editor authors both kinds.** A guardrail and a world are one record separated by `kind` ([GV1](../spec.md)), so they are one form — `LensEditor` — and `kind` changes four things and nothing else: the word on the header, whether the name field publishes, whether the save asks for its impact first, and whether the cast section is drawn. Two forms would be two places for the grammar to drift, and the two screens would start disagreeing about what `**` means. |
| WO11 | **The world a session asks in is stored on the session, never in the URL.** `sessions.lens_id` is what a reload, a second tab and a reopened thread all read, so a link cannot quietly change the circumstances of the next question. `?world=` stays the Govern drill-in — what you are reading. |
| WO12 | **The drill-in renders from the row the list already holds; the resolved cast arrives after.** *Innermost wins, then the address is checked against the effective rules* ([GV6](../spec.md)) is a composition against the guardrails that only the server can do, so it is a second read — and the record never waits on it. A cast table without it still reads correctly: it says what this lens **casts**, rather than what a run would **get**. |
| WO15 | **A world opens as a board named for itself.** Drilling into a world opens `world:<lens_id>` in `mainSection` and the tab carries the world's own name — `EU · H1 2026`, never `World` — because a strip of four tabs all reading `World` is a strip you have to click through to read. The board is not the drawer widened: the drawer is the **picking** reading, 420px of rules in the kit's layer sections with the run that prompted the narrowing still open beside it, and the board is the **auditing** one — usage, the cast resolved against the effective guardrails, every rule as an addressable row, and `spec.json`. Only the second can be kept: a declared board's `Save report` freezes a resolved document ([B6](../../../building-engine/boards-migration.md)), and *what was this world when the run happened* is the question a drawer cannot answer an hour later. |
| WO16 | **The board reads; the acts stay in the drawer.** `Edit`, `Promote`, `Duplicate` and `Delete` are on the drill-in, where *what stops* and *what stays* can be read at the moment of the act — the board offers `Edit`, which puts the drawer back on this world, and nothing else that writes. One place writes a lens, which is the same rule the rule board follows ([RU11](../../skills/features/rules.md)). |
| WO17 | **The touch carries the slice the connector composed, per type.** A world that names authored models compiles its per-type selects into `QueryLens.bounds`, and the read's verdict carries none of them — so `applied.select` is built from the **lens**, not from the verdict, and is a map keyed by type: `{"Deal": {"time": …, "geo": …}}`. One type's slice and four types' slices are then the same shape, which is what a flat `select` could not be, and *decide without seeing last year* is legible on the step that did it rather than inferable from the world it ran under. A read the lens did not slice writes no `select` key at all — an empty map would claim a narrowing happened and then name none. **`properties_excluded` is keyed the same way and for the same reason**: it is dead on exactly the shape `select` was, because the exclusion is authored on the model's address rather than the grounding version's, and one record that is per-type on one key and flat on its neighbour is a record a reader has to learn twice. |
| WO20 | **The engine counts what a world and a compare show.** A lens reads back with `allow_rules` and `deny_rules`, and its detail `usage` with `people`; `GET …/compare` returns `counts` — `touched_a`, `touched_b`, `shared`, `only_one` (either way round) and `read_differently`. Studio's tiles format these and derive none. A frozen report's legacy lens panel carries no share, so it shows its two counts and the meter's fill. |
| WO21 | **A run's touches come back counted and classified.** `GET …/runs/{id}/touches` returns, beside the ledger, `participants` — one per address the frozen world allowed or the run engaged, with its `layer`, its `verdict` (`refused` over `touched` over `miss` over `never_touched`), `rows`, `tokens`, `calls` (engaged touches) and the first refusal's `why` — and `layers`, one per layer with `allowed` (participants drawn there), `touched`, `refused`, `touches` (every ledger row), `calls` (the engaged ones) and `rows`; and `tallies` — `allowed`, `touched`, `never_touched`, `refused`. The run lens, the layers gantt and the run summary format these and count nothing. |
| WO25 | **A `*.*` guardrail is named once.** On the lens canvas a guarded property chips its type; a guardrail on every property of every type is named on the strip and in the inspector, never chipped on each type. |
