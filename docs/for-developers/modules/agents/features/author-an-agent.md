# Author an agent

Every agent in the Graph, what it carries, and what it is doing right now. Authoring one is picking a
template, offering it skills, setting its standing limits, and — if anyone wants to — its thinking
and its voice.

| | |
|---|---|
| Index | [5.2](../../../README.md#5--agents) · Slice **S12c** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [envelope-and-budget](envelope-and-budget.md) · [lifecycle](lifecycle.md) · [bindings](../../skills/features/bindings.md) |

Product spec: [AG-F01 · Build an agent](../../../../../specs/products/agents/features/AG-F01-build-an-agent/feature.md) — AG-21 and AG-29; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape | Components |
|---|---|---|
| `Agents` drawer | One list; `+`, search and filter in the header. A row carries its kind, a shield and its guardrail, and its spend this month; the selected row's **quick look** sits under the list with **Open** ([AG36](#decisions)). No actions on a row ([AG37](#decisions)) | `Item` · `PropertyList` · `MetricTile` with `meter` |
| Agent page | `agent:<id>` in `mainSection`, opened by **Open** on the list, which stays beside it ([AG34](#decisions)). One page, five tabs ([AG23](#decisions)): **Overview** (who · focus · thinking · always in force · policy · skills) · **Skills & callables** · **Thinking** · **Soul** · **Activity** (meters with the limits that cap them). Pause and Retire in the header; a tab that edits puts Discard · Save there | `Tabs` · `SectionHeader` · `PropertyList` · **`CastTable`** · **`BoundChip`** |
| *Bounds nest* | `agent ∩ work ∩ guardrails` stated as three rows, so a refusal is predictable before it happens | `PropertyList` |
| *What this agent can do* | The two tables, skills above callables, on the *Skills & callables* tab | `SectionHeader` · `DataTable` · `BoundChip` |
| *Thinking* | The effort numbers and the default stance, together on the *Thinking* tab — the stance by name, with its assumptions one click away | `PropertyList` · `RichSelect` |
| Voice dials | A row of four controls above the soul editor, on the **Soul** tab; a change redraws the preview ([SO7](soul.md#decisions)) | `SegmentedControl` · `PropertyList` |
| Assignee picker | Staffed agents first, then the rest | `RichSelect` |

Components in **bold** do not exist yet and are built in `design-kit` first, with a story —
[building-studio/govern-and-agents-panels.md § 3](../../../building-studio/govern-and-agents-panels.md).

## Engine

Full schema: [building-engine/govern-and-agents-data-model.md](../../../building-engine/govern-and-agents-data-model.md).

| Thing | Shape |
|---|---|
| `agents` | `graph_id` · `name` · `description` · `kind` · `status` · `lifetime` · `parent_agent_id?` · `spawned_in_run_id?` · `instructions` · **`soul`** · **`soul_traits`** · `budget` · **`effort`** · **`stance_id`** · `policy` |
| `stance_id` | FK `stances` **`ON DELETE RESTRICT`**, nullable. Null = no default stance. Read at run open like the lens; the run records `task_runs.stance_id` · `stance_version` whichever way it was chosen |
| `soul_traits` | `JSON`, default `{}`. Keys `humour` · `formality` · `emoji` · `greeting`, each one of the values above; a missing key is its default. An unknown key or value is refused at write, naming it |
| Voice in the prompt | `render_traits(soul_traits)` then `soul or DEFAULT_VOICE`, prepended to the same steps as the soul ([soul § Engine](soul.md#engine)); `RunVars.soul` carries both |
| What it can do, over HTTP | `GET …/agents/{id}/skills-and-callables` → `{skills: [{skill_id, name, version, when_to_use, needs: [step_key], uses: [key@version], missing: [step_key], offered, applied, enough_to_read}], callables: [{step_key, bound, pinned, needed_by: [skill_id \| key@version]}], plans: [key@version]}` — one read for both tables ([AG30](#decisions)) |
| What it is using, over HTTP | `GET …/agents/{id}/meters` → `{tokens_this_month, max_tokens_month, max_tokens_run, running, queued, max_concurrent_runs, runs_this_month, sessions, spawned_this_month, depth, max_children, max_depth, max_fanout, max_tokens}` — `max_tokens` is `max_tokens_run` under its one-release name ([EB8](envelope-and-budget.md#decisions)); every number derived on read ([AG31](#decisions)) |
| Its sessions, over HTTP | `GET …/sessions?agent_id=` — the caller's own sessions bound to this agent; sessions stay private to whoever opened them |
| Effort | `agents.effort` JSON; `AgentRead.effort` as stored and `AgentRead.effective_effort` as a run reads it ([EB11](envelope-and-budget.md#decisions)) |
| **Dropped** | `llm_config_id` — an agent binds no provider ([PM1](providers-and-models.md)) |
| Its guardrail | a `lenses` row, `kind = guardrail`, `scope = agent:<id>` — Govern's table, Govern's routes ([GR5](../../govern/features/guardrails.md)). The agent holds no pointer to it |
| The cast | resolved per run from the effective lens — the work's world, then the guardrails' casts, then the shipped default. Resolution: [govern § 2](../../govern/spec.md) |
| Tokens this month | `SUM(tokens_in + tokens_out)` over the agent's root runs that started this **calendar month** and their steps, on `ix_task_runs_agent_started` — not a counter column. It reads as `AgentListResponse.tokens_this_month`, a `{agent_id: tokens}` sidecar: one grouped read for the whole list; an agent with no run is absent and reads `0` ([AG11](#decisions) · [EB15](envelope-and-budget.md#decisions)) |
| Default | one per Graph, enforced |
| Routes | `…/agents*` · `POST …/graphs/{id}/default-agent` |
| Over HTTP | `AgentRead.guardrail_id` + `guardrail_name`, read from `lenses` by scope, so the row draws its shield without a second fetch |
| In force | the agent's guardrail is a contributor to `freeze_lens` on every run it opens, beside the Graph's ([AG7](#decisions) · [GV6](../../govern/spec.md)) |
| Events | `agent.create` · `agent.update` (effort among its `changed`) · `agent.set_default` · `agent.soul_set` (the dials included) — one edit is one version, and a voice change and any other change in the same edit emit one of each ([AG28](#decisions)) |

## Decisions

| # | Decision |
|---|---|
| AG5 | **Work that names no world runs in *Everything*, never in a blank.** *Nothing set* and *nothing permitted* must never look alike ([GR6](../../govern/features/guardrails.md)), and the widest state is still inside the guardrails — the Graph's and the agent's own. |
| AG12 | **The word is *agents*, and *roster* is retired.** A drawer is named for the rows it holds, and the rows are agents — the same rule that makes `Projects` › `Projects` and `Skills` › `Skills` read straight ([G33](../../../building-studio/graph-detail-page.md)). *Roster* named the table an agent lands in, and a table's name is not what a person reads, so it is gone from the label, from the drawer id (`?section=agents`), from this file's own slug, and from the engine and Studio comments that carried it. An old `?section=roster` link still lands here: an unknown drawer falls to the first one, and this is the first one. Where *roster* meant the skills an agent carries, the word is **bindings** ([BN8](../../skills/features/bindings.md)) — one word was doing two jobs. |

| AG14 | **What an agent may run is a callable, and the word is *callable*.** The envelope's allowed set is callables from the catalogue ([terminology](../../../terminology.md)); *capability* stays the name of a feature file's section, so one word does not do two jobs. |
| AG23 | **The agent is one page with eleven tabs** — Overview · Runs · Instructions · Soul · Model · Flow · Access · Limits · Deploy · Evals · History — laid out in [the agent page](the-agent-page.md), which owns its tabs, head and builder. |
| AG26 | **An agent has no world column; its narrowing is its guardrail.** The migration gives each agent that carried a world an agent-scoped guardrail with that world's rules and cast, so nothing an agent could reach widens on the way. |
| AG27 | **The default stance ships after the stance itself.** Until stances are rows with an author and a version, the Thinking tab carries focus and effort only, and `agents.stance_id` is not added — a foreign key to a table that does not exist yet would be scaffolding. AG20 and AG21 stand; the stance lands with [act as](../../ask/features/act-as.md). |
| AG28 | **A voice edit is `agent.soul_set`; every other edit is `agent.update`; one edit is one version.** `soul` and `soul_traits` change how the agent speaks and nothing it may do, so the audit names them apart — the dials in full, the soul by its length, since the version holds the text. Saving a soul and an effort together moves the version once and emits both events. |
| AG29 | **Humour is switched off by the caller when it knows, and by a stated rule when it does not.** `render_traits(traits, went_wrong=True)` renders `humour: off` for a reply already known to be a refusal, an error or a pause. Understand decides *in the same call* whether it cannot answer, so there is no second call to switch the dial for; its prompt carries the rule as a sentence instead — *when you refuse, cannot answer, or report an error or a pause, use no humour* ([AG17](#decisions)). |
| AG30 | **What this agent can do is read, never stored.** A skill's `needs` are the distinct callables of its current version's plan in plan order — `uses` is already inlined into those rows, and is listed beside them as `key@version`; `missing` is the needs its envelope does not allow; offered and applied are **this agent's** runs of the current version, with the Graph-wide floor for *too few to read*. The read also carries the totals the Overview tab prints — `offered` and `applied` summed across the bound skills, and `prompt_chars` ([BN15](../../skills/features/bindings.md#decisions)) — so Studio sums nothing. A callable's `needed_by` is the same reading turned round, plus the base plans in the envelope's `templates`, each at its newest version. |
| AG31 | **The meters are derived on every read, and the sessions meter is a count.** Spend is the calendar month's priced runs, absent when none was priced ([AG11](#decisions)); running and queued are the agent's in-flight roots; runs are roots queued this month; spawned is agents it created this month, and depth is its own place in the lineage. `sessions` counts every session bound to the agent, whoever opened it — a number names no thread — while the list behind it stays each person's own. |
| AG32 | **Activity's sessions are a count and the reader's own list.** The tab draws `meters.sessions` — every session bound to the agent, whoever opened it — as one number, and under it only the reader's own sessions with the agent (`GET …/sessions?agent_id=`). Another member's sessions are neither listed nor counted per person: a session is private to whoever opened it, and a per-person count would say whose threads exist. |
| AG34 | **The agent's page is a page in `mainSection`, not a drill-in of the drawer.** It is the declared board `agent:<id>`, titled with the agent's name; **Open** on the Agents list opens it, and the list stays in `leftSection` with the agent selected, so moving from one agent to the next is a click and not a back-and-forth. Its envelope and lineage are canvases opened from it (*Draw it* · *Open lineage*), each a page of its own beside it. `?page=agent:<id>` survives a reload; an old `&agent=<id>` link opens the same page and drops the key. The page reads no trace and keeps no reports — it is a record being edited, not a reading being kept. |
| AG35 | **An ask a guardrail refuses before it runs is drawn as *This ask was not run*, from the refusal's own facts.** The send answers `422` with `error: cast_refused` and, beside the sentence, the world the ask was in, the role, the address that world cast, the rule's pattern and whose rule it is (AG6); the reply draws them in a `RefusalCard` naming the bound's side. Nothing is written — no run opened, so there is no step to retry and no row to reload — and the card is the reply's until the thread is reopened. Only the role the ask opens with (`decide`) is checked at the send; a role a later step casts is refused when that step resolves it. |
| AG36 | **Selecting a row gives a quick look under the list; Open gives the page.** The Agents drawer is its list — each row its name, its `kind`, a shield and the guardrail's name (or *Graph guardrails only*), and its spend this month against its cap — and the selected row's quick look below it: name · kind · *Graph default*, its description on one line, guardrail, a spend meter, runs at once against the ceiling, and skills bound with how many need attention. The quick look answers *which one is this, and is it healthy*; everything else is on the page, and **Open** is its only act. The list keeps at least five rows above it. Search sits in the drawer header beside `+`, and kind, status and *show ephemeral* are behind its filter button. |
| AG37 | **Pause and Retire live on the agent's page, in its header, and nowhere else.** A row carries no actions and the quick look carries only Open, so the acts that change what an agent may run are taken with the whole agent in view. A paused agent reads *Resume* there. The lineage is opened from the page's Activity tab. |
| AG38 | **The page is drawn as its boards** (`agents.agent.*`); each tab's cards and columns are the [agent page](the-agent-page.md)'s. |
| AG22 | **There is no persona section in `instructions`.** Instructions reach Understand and Translate and miss Plan and Verify, so a thinking style written there shapes the query and not the method, and nothing checks it did anything. Thinking is effort plus a stance; voice is the soul; focus is instructions. |
| AG39 | **The Agents list's counts are the engine's.** `GET …/agents` returns `persistent` and `ephemeral` beside `total`, split by `lifetime` over the rows it returned. The header count is `persistent` while spawned helpers are hidden and `total` once they are shown; the status bar's `N ephemeral hidden` is `ephemeral`. A kind or status filter narrows the rows below, not the header count — the funnel shows it is on. |

## Not building

| Not building | Because |
|---|---|
| Cross-Graph agents | the Graph is the reasoning boundary |
