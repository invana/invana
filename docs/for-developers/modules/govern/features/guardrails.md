# Guardrails

What no run in this Graph may see or send, whatever world it runs in. A Graph's guardrail is **one
property rule** — *when a run touches `Deal.price`, it may read it in counts only, and the result
stays in the Graph* — set by a modeller, always in force, and the reason behind every request a
refusal files.

| | |
|---|---|
| Index | [14.2](../../../README.md#14--govern) · Slice **S16** · built in **M05** |
| Module | [Govern](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [worlds](worlds.md) (what narrows within these) · [requests](requests.md) (what a refusal files) · [audit-and-activity](../../operate/features/audit-and-activity.md) (every edit is an event) |

Product spec: [MO-F05 · Views of the graph and what must always hold](../../../../../specs/capabilities/model/features/MO-F05-views-of-the-graph-and-what-must-always-hold/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Route | Shape | Components |
|---|---|---|---|
| Guardrails page | `/modeller/guardrails` | leftSection: the Govern panel (Model · Worlds · Guardrails tabs over models, worlds and guardrails); main: the lens canvas under the guardrails alone — every guarded property shielded | `GlobalModelBoard` · `@invana/ui` `Tabs` · `SearchInput` |
| One guardrail | `/modeller/guardrails/:guardrail` | The same page with the guardrail inspector in the page's right column; `?request=<id>` adds the request bar over the canvas | `RecordHeader` · `Tabs` · `PropertyList` |
| Guardrail inspector | — | **Rule**: Applies to (each type carrying the property) · the rule as a sentence · Refused this week (who · where · when) · *Edit rule* · *Delete*. **Refusals**: every request it filed. **History**: its events | `PropertyList` · `Button` |
| Request bar | — | *`<who>` asked from `<where>`: "`<ask>`" · blocked by `<guardrail>`* · *Decline* · *Allow in a world* | `Alert` · `Button` |
| Rule dialog | — | *New guardrail rule*: *When a run touches* (a picker over `Type.property`) · *It may* · *And the result* (`ToggleGroup`s) · *Impact before saving* (warning `Alert`) · *Cancel* · *Save rule* | `Dialog` · `@invana/forms` · `ToggleGroup` · `Alert` |

---

## Engine

| Thing | Shape |
|---|---|
| Record | `lenses` row · `kind = guardrail` · `scope = graph` · `target` (`Type.property`, `*` either side) · `access` (`read` · `counts` · `never`) · `leaves` (bool) · `allowed_in` (world ids) · `name` generated from the rule · `rules` compiled from the rule at save, never authored |
| Compiled rules | `never` → `graph_data/model/**` allow, `properties.exclude: [<target>]` · `counts` → `graph_data/model/**` allow, `properties.counts_only: [<target>]` · `leaves = false` → `llm/**` and `third_party/**` allow with `may_send` without `property_values` |
| Enforcement | The connector **rejects** any reference to an excluded property and rewrites whole-element returns without it; a `counts_only` property may be filtered, counted and aggregated, is left out of whole-element returns, and a bare return of it is refused (`lens_property_counts_only`) |
| Agent's own bound | `scope = agent:<id>` stays a layered lens, authored on the agent's page ([AG6](../../agents/features/author-an-agent.md)) |

| Route | Returns |
|---|---|
| `GET …/guardrails` | `GuardrailPage` — `items: GuardrailRead[]` (`id · name · target · access · leaves · allowed_in[{id,name}] · types · refused_7d · created_at · updated_at`), `total`, `may_edit` |
| `GET …/guardrails/{id}` | `GuardrailDetail` — the row, `applies_to[{model,type,property}]`, `refusals[{request_id, who, where, at}]` + `refusals_total`, `history[{action, actor, at, details}]` |
| `GET …/guardrails/targets` | `[{target, model, type, property}]` — what the picker offers, from published versions |
| `POST …/guardrails/impact` | `{worlds[], schedules[], sentence}` for `{target, access, leaves}` |
| `POST · PATCH · DELETE …/guardrails[/{id}]` | the rule; `PATCH` takes `access` · `leaves` · `allowed_in` |
| CLI | `invana govern apply` reads `guardrails: [{target, access, leaves}]` |

---

## Decisions

| # | Decision |
|---|---|
| GR2 | **A guardrail compiles into the lens grammar at save.** `rules` is derived from the property rule and stored beside it, so enforcement, `lens_snapshot` and the touch record keep one path ([GV1](../spec.md)). |
| GR8 | **The layered grammar is one rule shape.** A rule of a world or an agent's own guardrail matches an address `<layer>/<sublayer>/<name>` and allows or denies it; `properties` and `select` are legal on `graph_data` alone, and a rule that sets them elsewhere is refused at save naming the layer. `properties` carries `exclude` and `counts_only`, each a property name or a qualified `Type.property`. |
| GR9 | **A pattern is resolved against the live catalogue as it is typed**, listing what it would match — a pattern that matches nothing is almost always a typo. |
| GR10 | **Layer-specific limits live under `options`** (`max_age_s` on a cache rule, `max_rounds` on a human one), so the top-level keys are the same on every layer. |
| GR11 | **`may_edit` rides on the guardrail list**, so the rules and the right to edit them arrive in one read. |
| GR15 | **A closed layer refuses by name, and the name is the world and the layer.** No rule fires when a layer was never opened, so the refusal names which world closed which layer and `rule_matched` stays empty. |
| GR22 | **The layered Graph guardrail is retired.** The migration re-expresses each one as property rules: an `llm` egress without `property_values` becomes `*.* · Read · Stays in the Graph`; a property exclusion becomes `<Type>.<property> · Never read`. A `third_party` deny has no property form and is dropped — the layer has no participant configured in any Graph. |
