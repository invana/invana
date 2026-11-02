# Pause, resume, retire

Pause, resume, retire. Nothing is deleted — a retired agent's row stays so its lineage, its traces and
its work still resolve.

| | |
|---|---|
| Index | [5.5](../../../README.md#5--agents) · Slice **S12c** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [author-an-agent](author-an-agent.md) · [lineage](lineage.md) · [delegation](delegation.md) |

Product spec: [AG-F01 · Build an agent](../../../../../specs/products/agents/features/AG-F01-build-an-agent/feature.md) — AG-29; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Components |
|---|---|---|
| Agent row | Status, and the actions on the row | `Item` · `StatusDot` |
| Agent panel | The action row in the content: `Save · Pause · Retire…` | `ButtonGroup` |
| Preview dialog | **What the act would do to its open work, item by item — never a count alone.** One dialog for both acts, titled by the act: each run in flight *finishes — never killed*; each open todo *blocked, with the agent named*; a todo **in review** *untouched* under a pause and *blocked* under a retire; each thread bound to the agent *refuses its next ask, naming the state*. The list is the same; the effects are what differ ([LC8 · LC9](#decisions)) | `AlertDialog` · `DataTable` |
| Pause, from the row or the footer | Opens the same dialog, never acting on the click. **Resume does not** — nothing it does needs previewing ([LC10](#decisions)) | `Button` · `AlertDialog` |

### The three states, stated

| State | Takes | In flight | Reversible |
|---|---|---|---|
| `running` | Todos, schedules, delegations | — | — |
| `paused` | nothing new | **finishes — never killed** | one click, and the reason is recorded |
| `retired` | nothing, ever | finishes | no. The row stays so every past run, trace and lineage edge resolves |

**A pause never kills work in flight.** Cancelling a run and pausing an agent are different acts with
different consequences, and a control that did both would be the wrong one to reach for at 3am.

**Retirement does not free the name.** A reused name makes two histories one.

## Engine

| Thing | Shape |
|---|---|
| `agents.status` | `active · paused · retired` |
| Assignment guard | a paused or retired agent cannot receive a new run — `require_available`, which is what makes a bound thread's next ask a 409 rather than a silent switch |
| Task effect | open tasks go `blocked` with the agent named. A pause leaves a task in **`review`** alone; a retire does not |
| In-flight runs | untouched by either act. A queued run still starts: pausing takes nothing **new**, and a run already queued is not new |
| `LifecyclePreview` | `{agent_id, act, items: [{kind, id, title, effect, note}]}` — one shape, two acts ([LC8](#decisions)). `kind` is `run · task · session`; `effect` is `finishes · blocked · unchanged · refused` ([LC9](#decisions)) |
| Routes | `POST …/agents/{id}/{pause,resume,retire}` · `GET …/agents/{id}/{pause,retire}` for the preview |
| Events | `agent.paused · resumed · retired` |

## Decisions

| # | Decision |
|---|---|
| LC8 | **One preview, two acts.** `GET …/agents/{id}/pause` and `GET …/agents/{id}/retire` return the same `LifecyclePreview`, carrying the act it was asked for. Two shapes would describe one list of work in two vocabularies, and the reader comparing *pause* with *retire* would be comparing the wording rather than the consequence. What differs between the acts is the `effect` on each item — which is exactly what [LC6](#decisions) says a count cannot carry. |
| LC9 | **The effects are a closed vocabulary**, because a sentence per row is a sentence nobody can compare: `finishes` (a run in flight, under either act — nothing kills a run), `blocked` (an open todo, with the agent named in `blocked_reason`), `unchanged` (a todo in **review** under a pause — the one item the two acts disagree about, and the one a count could never show), `refused` (a thread bound to this agent: its next ask is a 409 naming the state, never a silent switch to another mind). |
