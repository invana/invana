# Projections

A **projection** is a declared mapping from a shape to a surface. It runs in both directions: how a
question is *put to a person*, and how records are *shown to a person*. Both are chosen from
templates, so neither the wording of a choice nor the markup of a table is authored by the model at
run time.

| | |
|---|---|
| Index | [3.4](../../../README.md#3--ask) · Slice **S9b → S9d** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [the-answer-surface](the-answer-surface.md) (the emission kinds) · [clarifying-questions](clarifying-questions.md) (when a step asks) · [the-library](../../workflows/features/the-library.md) (the same promote-what-served pattern) |

Product spec: [EX-F04 · The answer](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## 3. A template

| Field | Means |
|---|---|
| `name` · `kind` | `prompt` or `result` |
| `surface` | `choice · multi-choice · boolean · pick-from-graph · value · confirm · table · metric · chart · subgraph · markdown · html` |
| `accepts` | the shape it can render: required fields and their types |
| `spec` | the surface's own definition — columns and formats for a table, axes for a chart, the markup for html, the option source for a choice |
| `intent` | what it is for, in a reader's words — shown on the Templates page; ranking reads `surface`, never this text ([P13](#7-decisions)) |
| `version` · `status` | `draft · published`; published versions are read-only |

## 5. Surfaces

| Surface | Shape |
|---|---|
| Ask card in the thread | the question, then options as chips (`choice`), a pair of buttons (`boolean`), or a searchable list (`pick-from-graph`) |
| Answered card | the chosen option, who chose it, when — never re-editable in place; re-asking is a new question |
| Emission header | the template in use, with a switcher listing the others that accept this shape |
| Templates page | list per Graph; `+` in the header; a template's usage shows every emission that used it |
| *Author a template* | a modal: Name · Kind (`result` · `prompt`) · Surface (the kind's surfaces) · Accepts (one constraint per part, `result_type tabular · min_rows 1`, prefilled from the surface until edited) · Shape (`spec`, one `key: value` per line) · Intent; *Save as a draft* or *Publish* ([P15](#7-decisions)) |

## 6. Engine

| Thing | Shape |
|---|---|
| `projection_templates` | `graph_id` · `name` · `kind` · `surface` · `accepts` jsonb · `spec` jsonb · `intent` · `version` · `status` |
| `task_prompts` | `run_id` · `step_seq` · `template_id` · `answered_by_kind/id` · `value` jsonb · `answered_at` |
| `emissions.template_id` | which template rendered it; null means the kind's default |
| `select_template(templates, shape, kind=, prefer=)` | ranks eligible templates by `prefer` → `kind` → specificity → name ([P13](#7-decisions)); the switcher's offers call it with neither |
| Routes | `…/projection-templates*` · `…/task_runs/{id}/answers` · `…/emissions/{id}/render?template=` |
| `GET …/projection-templates` | `Page[TemplateRead]` on the [list contract](../../platform/features/list-contract.md): `q` · `kind` · `surface`; `unfiltered_total` counts this Graph's templates and the shipped ones, never another Graph's |
| `GET …/projection-templates/{id}` | one template, this Graph's own or a shipped one; another Graph's reads as 404 |
| Events | `projection_template.*` · `prompt.asked` · `prompt.answered` |

## 7. Decisions

| # | Decision |
|---|---|
| P13 | **Intent is the classifier's structured output, never the raw question.** Ranking is, in order: the asked-for visual (`prefer`), the intent `kind`, specificity, name. `prefer` is `graph · table · chart` or empty and maps to the surfaces `subgraph · table · chart`; `kind` ranks `aggregate_and_chart` toward `chart` then `metric`, and `exploration` toward `subgraph`; every other kind ranks nothing. Both only **rank eligible templates** — *as a chart* over a one-cell result still renders `single-value`, and the picker offers the chart disabled with its reason (P10). An ask with no intent (a QL ask, a scheduled firing) ranks by specificity alone. |
| P14 | **Templates never enter the prompt.** `prefer` is a fixed enum in the classifier's tool schema, so the schema is a constant and stays in the cacheable prefix however many templates a Graph authors. |
| P15 | **Authoring takes the whole template and may publish at once.** *Author a template* sends `kind`, `surface`, `accepts` and `spec` as the engine stores them; *Publish* is a create followed by the draft's publish, so a published template still passed through a draft row. `accepts` is the result-shape constraint the engine checks (P4) — never a list of intent kinds; intent ranking is `intent` and P13. |

## 9. Open

| # | Question |
|---|---|
| Q2 | Does a `pick-from-graph` option list refresh on re-ask, or freeze at first ask? |

Two of these are settled by what shipped. **Q1**: a switch is a write on the emission — it is the
emission's rendering, not a per-viewer preference, so everyone who opens that answer sees the template
the reader chose. **Q3**: templates are Graph-scoped, plus the ones shipped with the distribution;
portability is [1.5](../../connect-and-model/features/share-a-model.md)'s path, and nothing asks for
it here yet.

## Where the code lives

| | |
|---|---|
| Studio | `src/pages/graphs-detail/features/ask/projections/` — `TemplatesDrawer` (the section) over `TemplatesPanel` (the body). **Templates is Library's third drawer, not a `leftNav` item** (G38): a template is to an answer what a plan is to a run, so it sits beside `Plans` and `Catalogue`. The drawer owns the header — label, the `11 · 5 result` count, search, the `kind`/`surface` filter and the `+` that authors one; `&template=` drills into one, read end to end, inside the drawer |
| The word | A **template** here is the versioned, person-authored thing this feature describes. Nothing else in Studio may take the name — see code-shape.md §4.1b |
