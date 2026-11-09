# Requests

One inbox of what analysts and agents asked to be modelled or allowed — a guardrail refusal, an ask
the Graph could not answer, or an explicit *Ask for a change* — each resolved by *Decline*, *Allow in a
world* or *Model it*.

| | |
|---|---|
| Index | [14.3](../../../README.md#14--govern) · built in **M05** |
| Module | [Govern](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [guardrails](guardrails.md) (what files most of them) · [worlds](worlds.md) (where *Allow* lands) · [the-model-page](../../connect-and-model/features/the-model-page.md) (where *Model it* lands) |

Product spec: [MO-F05 · Views of the graph and what must always hold](../../../../../specs/capabilities/model/features/MO-F05-views-of-the-graph-and-what-must-always-hold/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Route | Shape | Components |
|---|---|---|---|
| Requests page | `/modeller/requests` | Head *Requests* · `N open` chip · *From Explorer's "Ask for a change" and from asks the Graph could not answer*; **Open** then **Done** (folded) groups; a row is the title over `who · from where · blocked by <guardrail> / the Graph could not answer "<ask>" / N asks it could not answer · when`, acts at the right; a done row reads its resolution with a `done` chip | `RecordHeader` · `Collapsible` · `Button` · `Badge` |
| Allow dialog | — | *Allow in a world*: pick a world · *Allow* | `Dialog` · `Select` |
| Rail badge | `leftNav` | the open count | `useNavBadges` |

---

## Engine

| Column | Shape |
|---|---|
| `requests.id` · `graph_id` | UUID · FK `graphs` cascade |
| `kind` | `guardrail` · `unanswered` · `change` |
| `title` · `detail` | the ask as asked · what the run said |
| `source` | `explorer` · `agent` · `schedule` · `api` |
| `asked_by_id` · `agent_id` · `run_id` · `session_id` | who asked, through what |
| `guardrail_id` · `blocked_by` | the guardrail (FK `lenses`, `SET NULL`) and its name frozen at filing |
| `asks` · `last_asked_at` | repeated asks of the same open request |
| `status` · `resolution` | `open` · `done` · `declined` · `allowed` · `modelled` |
| `resolution_note` · `world_id` · `model_id` · `resolved_by_id` · `resolved_at` | what resolving did |

| Route | Returns |
|---|---|
| `GET …/requests?status=&kind=` | `RequestPage` — `Page[RequestRead]` with `open` (the count the badge reads) |
| `POST …/requests` | `{title, detail?}` → a `change` request by the caller |
| `POST …/requests/{id}/resolve` | `{action: decline · allow · model, world_id?, model_id?, note?}` → `RequestRead` |
| CLI | `invana requests list` · `invana requests resolve <id> --decline · --allow <world> · --model [<model>]` |
| Events | `request.create` · `request.resolve` |

---

## Decisions

| # | Decision |
|---|---|
| RQ8 | **The run loop files, not the task.** `graph.read.query` raises *cannot answer* carrying the connector's refusal (code · type · property); the loop names the Graph guardrail that holds the property — the one whose access makes that refusal (*never* for an excluded property, *counts* for counts only), the most specific target first, so `Deal.price` outranks `*.price` — and files a `guardrail` request naming it, or an `unanswered` one when no guardrail holds it. The query service lets a lens refusal through unwrapped, so it never reads as a failed query. |
