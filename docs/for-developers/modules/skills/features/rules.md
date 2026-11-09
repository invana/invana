# Rules

One statement that is always true, offered to every step in its scope. **Install rules** hold across
every Graph; **invariants** belong to a Graph; **working rules** belong to a Project. A rule may also
carry a **check** — a machine half, read at the acts it names, and enforced `block · warn · report`.

| | |
|---|---|
| Index | [6.4](../../../README.md#6--skills) · Slice **S12b** · **B04** (P-12: install scope, checks) |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [authoring-a-skill](authoring-a-skill.md) · [objectives-and-criteria](../../work/features/objectives-and-criteria.md) · [standards](../../bring-data-in/features/standards.md) · products: modeller.md MO-12 · MO-F11 |

Product spec: [MO-F06 · Rules agents work by](../../../../../specs/capabilities/model/features/MO-F06-rules-agents-work-by/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Modeller › Rules (`modeller.rules`) | `/modeller/rules` — a page in the main area, no leftSection ([RU18](#decisions)). Head: *Rules*, the one-line purpose, the engine's `total` and *New rule*. The *Scope* and *Checked on* filters (`?f.scope=` · `?f.act=`, sent to the server). One list in assembly order: each row the statement, then scope (`install` · `Graph <name>` · `project <name>`) · checked on · mode · `N broken in 30 days`, the mode as a badge; an inactive rule dimmed in place. Under it, one line on what is not a rule: ranges on a property are constraints, shared vocabularies are standards |
| The rule dialog (`modeller.rules.edit`) | `/modeller/rules/<rule>` or *New rule* (`?new=1`) — a modal, its crumb the statement. Statement · Scope (*Install · Graph · Project*, fixed once saved; *Install* only for an install Admin; *Project* picks the project) · Check (the closed vocabulary and its params) · *Checked on* (the acts the check reads, drawn from it, never picked) · *When broken* (*Block · Warn · Report*) · *Because* (*Shown to whoever the rule stops.*) · the impact line, read as the check changes ([RU21](#decisions)). Footer: *Stop offering it* / *Offer it again* on an existing rule, *Open board* on an existing Graph or project rule (an install rule has no Graph board); *Cancel* · *Save rule* |
| `invana rules list [--graph u/slug] · show <id> · apply --file [--graph u/slug]` | CLI |
| Project panel → Working rules | A section of the project's **Details** tab, with the inherited invariants above it, greyed and read-only ([RU8](#decisions)) |
| Step row | The rules **offered**, each drawn as its statement, with the ones the step **cited** marked — the same two certainties as a skill ([RU12](#decisions)). A statement is the row, never an id, and clicking one opens that rule's board — beside the tree on the activity surface, in place of the dialog on the answer surface ([RU13](#decisions)). Drawn on the activity tree and in a step's trace detail |
| **The rule board** | `More`, drilled in, opens a `kind = rule` declared board: the statement, offered · cited · never cited, the row with its derived words, the versions with their own counts, and where each was cited ([RU11](#decisions)) |

## Engine

| Thing | Shape |
|---|---|
| `rules` | `graph_id?` · `project_id?` · `active` · `order` · `current_version_id` — the scope read off the two ([RU6](#decisions)) |
| `rule_versions` | `rule_id` · `version` · `statement` · `check?` · `mode?` · `because?` · `published_at`, immutable |
| Derived | `scope` and `kind` are read off `graph_id` and `project_id`, not stored |
| Assembly | install rules → graph invariants → project working rules, each with its id |
| Citations | `task_runs.rules_offered` · `rules_cited`, both `rule_version_id`s |
| A step's rules, read | `ActivityNode` and `TraceStep` each carry `rules_offered` · `rules_cited` as `{rule_id, statement}` — the version's wording, and the rule to open ([RU12](#decisions)) |
| Counts | `offered` · `total` over every version, and a `cited` count **per version**, all derived on read ([RU9](#decisions) · [RU10](#decisions)) |
| Routes | `…/rules*` · `…/projects/{key}/rules*` · `…/rules/{id}/citations` → `offered` · `total` · `versions` · `items` |
| `GET …/rules` | Every rule in force in this Graph — the install's, the Graph's and each project's the reader can see — as one list-contract `Page[RuleRead]` in assembly order. Filters `scope` (`install · graph · project`) and `act` (`dataset.share · dataset.bind · project.decide`); `q` on the statement ([RU18](#decisions)) |
| `POST …/rules/impact` · `POST /api/v1/rules/impact` | `{scope, project_key?, check}` → `RuleImpact` `{days: 30, read, broken, items[{act, subject, at, reason}]}` — the acts of the last 30 days read back through the check, newest first, at most five items. The Graph route reads this Graph's acts (and every share, for an install check); the install route, an install Admin's, every Graph's ([RU21](#decisions)) |
| `RuleRead` (on the Graph list) | gains `acts` (read off the check), `because`, `project_key` · `project_name` on a project rule, `graph_name`, and `broken_30d` — the same read-back over the current version's check, `null` on a rule with no check ([RU22](#decisions)) |
| Install routes (`/api/v1/rules`) | `GET ""` (any user) · `POST ""` · `GET · PATCH /{id}` · `POST /{id}/activate · deactivate` (install Admin) · `GET /{id}/versions` |
| `RuleRead` · `RuleVersionRead` | gain `check?` · `mode?`; `graph_id` is null on an install rule |
| Events | `rule.create` · `rule.publish` · `rule.activate` · `rule.deactivate` · `rule.check` (a failed warn or report: `act` · `subject` · `mode` · `version` · `reason`; `graph_id` the act's) |

| Check kind | Params | Checked at | Scopes | Fails when |
|---|---|---|---|---|
| `dataset.conforms` | `standard` (`p/n`) · `min_score` (0–1, default 1) | `dataset.share` · `dataset.bind` | install · graph | the dataset does not claim the standard, or the version's score is below `min_score` |
| `dataset.licence` | `allowed` (licences, compared case-blind) | `dataset.share` · `dataset.bind` | install · graph | the version's licence is not one of `allowed` |
| `evidence.reviewed` | — | `project.decide` | install · graph · project | a finding the decision cites was not reviewed by a person |
| `evidence.not_retracted` | — | `project.decide` | install · graph · project | a finding the decision cites cites a retracted dataset version |

| Act | When | Rules read |
|---|---|---|
| `dataset.share` | a dataset's visibility moves to `install` | install rules; the subject is the current version |
| `dataset.bind` | a version is bound into a Graph | install rules · that Graph's invariants |

## Decisions

| # | Decision |
|---|---|
| RU6 | **`scope` and `kind` are derived from `graph_id` and `project_id`, never stored.** No `graph_id` is `install`; a `graph_id` alone is `graph`; a `project_id` is `project`. `kind` is `working` on a project rule and `invariant` otherwise. Storing either word would be a column that can disagree with the two that decide it. A project rule always carries its Graph's id (that is its cascade). |
| RU9 | **A rule says what it was offered, not only what cited it.** [RU7](#decisions) put the pair on the record and nothing ever read the first half: `task_runs.rules_offered` has been written since the statement migration and no response carried it, so *never cited* could not be told from *never offered* — which is the one distinction the evidence loop needs. The citations read now carries `offered` beside `total`, counted from the record on read like every other number here, and the surface draws **offered · cited · never cited**. Until a Graph has offers, the two derived tiles are **absent**: an absent tile says *we do not know*, and `0` would say *it was never offered*. |
| RU10 | **A citation count per version is counted by the engine; the surface adds nothing up.** The read returns a bounded, newest-first window of citing steps and a total over every version. Counting the per-version column off that window would be a total taken from a page wearing the label of a total over the record — the same mistake [usage](usage.md) names — and it would shrink every time somebody narrowed the window. So each version comes back with its own count beside its statement. Per-version *offers* are deliberately not sent: an offer is written against whatever version was current, so the split is a fact nothing on the surface asks for. |
