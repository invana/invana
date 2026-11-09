# What an answer is made of

An answer is a sequence of **emissions** — subgraph, table, metric, chart, prose — each of a declared
kind, each citing what produced it. Not a paragraph with numbers in it.

| | |
|---|---|
| Index | [3.3](../../../README.md#3--ask) · Slice **S9b** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [projections](projections.md) (how each is rendered) · [reasoning-trace](reasoning-trace.md) |

Product spec: [EX-F04 · The answer](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Studio |
|---|---|---|
| Thread | Emissions in order under the question | `explorer/components/emissions/EmissionList` |
| Emission | One card: the header over a body chosen by kind | `EmissionCard` |
| Emission header | The kind, the template in use, and the citation | `EmissionCard` — 24px, `kind · template@version · cite · N records` |
| Bodies | One per kind, plus the empty one | `TableBody · MetricBody · ChartBody · SubgraphBody · ProseBody · EmptyBody` |
| Canvas | Where subgraph emissions land | the reply's *Load to canvas* chip offers it; the canvas owns the paint |

The engine produces the emissions; Studio reads them. `GET …/task_runs/{id}/emissions` returns them in
order with their citation and the templates that would render the same records. The derived path
survives as the fallback for a reply with no run (AS12) — it names no template, because none
chose the rendering.

## Engine

| Thing | Shape |
|---|---|
| `emissions` | `run_id` · `seq` · `kind` · payload · `template_id?` · citation |
| Citation | query id plus record ids, resolvable to provenance |
| Routes | `GET …/task_runs/{id}/emissions` |
| Events | `emission.produced` |

## Decisions

| # | Decision |
|---|---|
| AS2 | The producing step declares the kind. |
| AS10 | An emission is a record, not page state. The `project` step writes it, and an answer survives a reload. |
| AS11 | The chosen template's **surface** is the emission's kind. Switching template re-renders the same records and the kind follows — which is how one result can be read as a table and then as a chart without either being a lie about what the step produced. |
| AS12 | A reply whose run was never recorded — an older row, or one whose run was pruned — still renders, by folding one emission out of the query result it carries. It names no template, because none chose the rendering (AS9). |
| AS15 | **Whether a subgraph is on the canvas is the reply's fact, not the record's.** The stored subgraph emission says what the step produced; the reply knows whether it is on the canvas (its click, or the thread's `load` turn). A new session's first result is painted onto the session's new canvas and logged as a `load` turn like a click, so it never offers what it already drew. Until then the reply carries the *Load to canvas* offer; drawn or not, there is no subgraph card ([AS8](#decisions)). A **table** whose translation wrote a `canvas_query` carries the same offer ([NL15](ask-in-natural-language.md#decisions)); it is answered once a later reply in the thread ran that twin. |
| AS18 | **The meta line's time is the run's `work_ms`, not the query's.** The engine stores it when the run settles — the run's steps summed, so it equals the rows under *How I got this* added up, without the time a person spent answering ([MS4](../../platform/features/metrics-are-stored.md#decisions)). The query's own time is the Execute row. Studio formats it and derives nothing. |

> ⚠ **A re-run that leaves the earlier answer ([EX-02.9](../../../../../specs/capabilities/explore/features/EX-F04-the-answer/stories/EX-02-watch-the-answer-arrive-on-the-board/story.md)) is half-built.** A re-run today writes a new run but re-points the
> reply at it, so the prior emissions are orphaned and a failed re-run leaves the
> reply looking empty. Making a re-run additive — and putting *as of* and the
> re-run affordance on the emission header — is the remaining work.

## Where the code lives

| | |
|---|---|
| Studio | `src/pages/graphs-detail/features/ask/answer-surface/` — `EmissionCard` · `EmissionBodies` · `emissions.ts` · `ResultBlock` · `ResultsTable` |
| Rendering inside a reply | `NotAnAnswer` (when-it-cannot-answer) and `TraceDialog` ([reasoning-trace](reasoning-trace.md)) sit here too — they are how a reply reads, not surfaces of their own |
| Not | `templates/`. **Template** is [projections](projections.md)' word for a versioned, person-authored projection template; these render an emission, they are not templates |
