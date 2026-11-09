# The agent page

An agent is built and read on one page, the way a skill is: **Overview · Runs · Instructions · Soul ·
Model · Flow · Access · Limits · Deploy · Evals · History**. A new agent is a draft on that page — the
builder — until *Create agent* makes it live; a live agent's Overview is its dashboard.

| | |
|---|---|
| Index | [5.13](../../../README.md#5--agents) · Slice **F04** |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🟡 / — / ✅ |
| Related | [author-an-agent](author-an-agent.md) · [envelope-and-budget](envelope-and-budget.md) · [delegation](delegation.md) · [lifecycle](lifecycle.md) · [soul](soul.md) · [pinned-model-versions](pinned-model-versions.md) · [the-skill-page](../../skills/features/the-skill-page.md) · the-agents-shell · products: agent-fabric.md AF-05 · AF-06 · AF-21 |

Product spec: [AG-F01 · Build an agent](../../../../../specs/capabilities/agents/features/AG-F01-build-an-agent/feature.md) — AG-21, AG-36 and AG-29; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Tab | `?tab=` | Body | Reads / writes |
|---|---|---|---|
| Overview | `overview` (default) | `AgentBuilder` on a draft · `AgentDashboard` on a live agent | `GET …/agents/{id}` · `…/agents/{id}/overview` · `…/skills-and-callables` · `…/meters` · `GET …/sessions?agent_id=` · `DELETE …/agents/{id}` (*Discard draft*) |
| Runs | `runs` | `AgentRunsTab` | `GET …/runs?f.agent_id=&limit=50&cursor=` |
| Instructions | `instructions` | `AgentInstructionsTab` | `PATCH/DELETE …/draft` · `POST …/publish` · `…/rollback` |
| Soul | `soul` | `AgentSoulTab` | `PATCH …/agents/{id}` · `POST …/soul/preview` |
| Model | `model` | `AgentModelTab` | `GET …/llm/providers` · `…/agents/{id}/overview` (versions run on) · `PATCH` `model_pin` · effort |
| Flow | `flow` | `AgentFlowTab` — `LayeredCanvas` + side cards | `…/skills-and-callables` · `…/lineage` · schedules |
| Access | `access` | `AgentAccessTab` | `GET …/iam/agents/{id}/effective` · `POST …/iam/policies/{name}/holders` · `policy.may_delegate` |
| Limits | `limits` | `AgentLimitsTab` | `PATCH` `budget` · `workflow_spec` ceilings · `effort` |
| Deploy | `deploy` | `AgentDeployTab` | `GET …/agents/concurrency` (pools) · schedules · `PATCH` `policy` |
| Evals | `evals` | `EvalSetPanel` (subject `agent`) | `…/evals/agent/{id}` |
| History | `history` | `AgentHistoryTab` | `GET …/agents/{id}/activity` |

| Board | Draws |
|---|---|
| `builder.agent.new` | the builder: a draft named, two skills, instructions, reach, limits; *Discard draft* · *Create agent* |
| `graph.settings.agent` · `.runs` | a live agent's dashboard; its Runs |
| `builder.agent.soul` · `.model` · `.flow` · `.access` · `.limits` · `.deploy` | those tabs |
| `builder.agent.retire` | the Retire dialog over Overview: open work and the schedules that start it, what happens to each, *Why* |

## Engine

| Shape | Fields |
|---|---|
| `AgentStatus` | `draft` · `active` · `paused` · `retired` |
| `POST …/agents` | `AgentCreate` + `model_pin`; writes `status = draft`, instructions as given, skills bound through the bind check |
| `POST …/agents/{id}/create` | body `why?` → `AgentRead` with `status = active`; `409` unless `draft`; runs `evals.gate(subject_kind="agent")` — `eval_required` · `eval_failed` · `eval_running` · `eval_warned` (needs `why`) |
| `GET …/agents/{id}/overview?window=30d` | `AgentOverview` — `agent_id` · `days` · `since` · `runs` · `runs_prior` · `served` · `served_rate` · `served_rate_prior` · `p95_ms` · `p95_prior_ms` · `tokens_this_month` · `max_tokens_month` · `spawned` · `daily[]` (date, runs, tokens) · `exits[]` (exit, runs, last_run_id, last_title) · `recent[]` (id, title, agents, tokens, duration_ms, exit, finished_at) · `models[]` (model_version, first_at, runs, served_rate, p95_ms) |
| An exit | the run's `outcome` when it has one (`answered` · `conversed` · `cannot_answer` · `failed` · `cancelled`), else its `status`. Exit-rule reasons (time limit, no progress, loop) join with F05 |
| `GET …/schedules?f.agent_id=` | the schedules that start this agent — Flow's and Deploy's triggers |
| `GET …/agents/{id}/pause` · `…/retire` | `LifecyclePreview` — `items[]` of `LifecycleItem` (`kind` `run` · `task` · `session` · `schedule`, `id`, `title`, `effect`, `note`); `effect` is `finishes` · `blocked` · `unchanged` · `refused` · `paused` |
| `POST …/agents/{id}/retire` | retires the agent and pauses every active schedule that starts it (`schedule.pause` event, `reason` naming the agent) |
| `DELETE …/agents/{id}` | `204`; `409` once the agent has a run or is seeded — retire it so its trace resolves |
| `GET …/fleet/overview` | `tiles.max_tokens_month` is Σ the live agents' `effective_budget.max_tokens_month` |
| Runs | `GET …/runs?f.agent_id=` — the agent's root runs |

A draft is never offered work: opening a run on it, assigning it a Todo, scheduling it or making it the
default is refused with `409` naming the state, as for `paused`.

## Decisions

| # | Decision |
|---|---|
| AP30 | **The agent page has two readings.** In the Agent Builder it is the definition — its build tabs, versions and the Graphs that run it. In a Graph it is *the agent in this Graph*, under Graph settings › Members — Overview · Runs · Access, with *Edit in Agent Builder* ([5.16](install-wide-agents-and-skills.md) C10) |
| AP1 | **The agent page has eleven tabs: Overview · Runs · Instructions · Soul · Model · Flow · Access · Limits · Deploy · Evals · History.** Thinking folds into Model (effort) and Limits (steps); Skills & callables folds into Overview (skills) and Access (functions); Activity becomes Runs and History |
| AP2 | **The open tab is `?tab=` beside `?page=`**, written on every switch, so a link, a board route or a reload opens the same tab. Opening another page drops it |
| AP5 | **A live agent's Overview is a dashboard of stored numbers** — served by `GET …/agents/{id}/overview`; Studio formats, never derives (CLAUDE.md rule 13) |
| AP6 | **Edits keep one buffer across tabs and Save sends only what moved** ([AG33](author-an-agent.md#decisions)); binding a skill, the instructions and the model pin stay their own writes |
| AP7 | **The head is `RecordHeader variant="page"`**: crumb `Agents`, the name, a state chip (`draft` · `authored · vN` · `paused` · `retired`), a meta line (model · runtime), and the acts — a draft: *Discard draft* · *Create agent*; live: *Make default* · *Pause* (or *Resume*) · *Retire*. *Run now* is not here — starting a run of an agent is the Runs phase's (agent-fabric › Runs) |
| AP12 | **A tab whose engine read is missing draws what exists and leaves the rest out**, never derived; the gaps are the build's hand-off |
| AP15 | **`draft` is a stored status value, not a schema change** — `agents.status` is a string column, so no migration. Seeded and spawned agents are written `active`; only `POST …/agents` writes `draft`. *Pause* and *Resume* refuse a draft with `409` (a resume would skip the gate); *Retire* takes one |
| AP16 | **Create's gate reads the agent as it is**: the candidate is its instructions with its `model_pin`, and with no eval set it passes `unchecked`. Success emits `agent.activate` carrying the gate's verdict and the `why` |
| AP17 | **The Overview's window is `days` UTC calendar days ending today** (`7d` · `30d` · `90d`), so `daily` has exactly `days` rows, zero-filled; the prior window is the same length before it. Counted over the agent's root runs, eval runs left out. `served` is a settled run that succeeded and `served_rate` is succeeded over settled (null when none settled) — Fleet's and Performance's *success*, so one agent shows one served rate on every page; `p95_ms` is queued-to-finished over settled runs, the same reading Agent Builder › Performance uses. `recent` is the ten newest runs whatever the window; a run's `agents` is the agent plus each distinct agent its steps delegated to. `models` groups the window's runs by every `model_version` their root or steps recorded; `first_at` is that version's first run by this agent, all time |
| AP18 | **Runs filters by *Started by* and *From*** (`f.started_by` · `f.origin` on `GET …/runs`, the agent fixed by the tab); *From* is the run's `triggered_by` — Todo · Schedule · Asked · Delegated. The filters live in the tab's own state, not `?f.`, so they never leak into the section lists beside the page |
| AP19 | **The Agents list's *Month budget* is `tokens_this_month` of `effective_budget.max_tokens_month`** — the ceiling a run reads, the agent's own or the Graph's default — so every row says *of N* |
| AP21 | **A live agent's Overview carries its Skills and the reader's Sessions** under the charts. Skills is the builder's card — the bound skills, *Add skill*, unbind per row. Sessions lists the reader's own sessions bound to the agent (`GET …/sessions?agent_id=&sort=updated&limit=20`), newest first, beside `meters.sessions`, the Graph-wide count that names no thread; others' sessions are never listed. Overview, not Runs, because a session is a conversation with the agent, not a run of it |
| AP23 | ***New agent* opens the Graph's `untitled` draft when there is one**, and creates it only otherwise — names are unique in a Graph, so a second `untitled` cannot exist. Renaming the draft frees the name for the next *New agent* |
| AP25 | **Runs pages on the engine's `next_cursor`, 50 a page**: *Show 50 more* asks for the next page until the last has none; the count beside the filters is the engine's `total` |
| AP27 | **Fleet's *Tokens this month* tile reads the same ceiling as the rows**: Σ the live agents' `effective_budget.max_tokens_month` (the agent's own, else the Graph's default; drafts and retired agents left out), and Fleet's table and console print *N of M* from `effective_budget` as the Agents list does (AP19) |

## Not building

| Item | Why |
|---|---|
| Assistant proposals marked on the builder | The assistant opens boards and drafts; a proposal marked on the builder needs a proposal record the engine does not keep |
| An event trigger and pool labels on Deploy | Workers (F06) |
| *Run now* in the head | A run starts from an ask, a Todo or a schedule; there is no run-an-agent endpoint, and a run with no ask has nothing to answer |
| *Estimate* on the builder and Limits | The engine stores no per-run estimate; a client-side guess would break CLAUDE.md rule 13 |
| Soul's *How it speaks* · *Caution* · *When unsure* | The agent stores four dials; these are not stored, so they are not drawn |
| Effort as low · medium · high | Effort is stored as max steps · replans · questions, and Limits shows those |
| Deploy's resource → pool mapping | Skill resources (`cpu` · `llm` · `gpu`) and pools (`llm` · `graphdb` · `heavy`) share only `llm`; pools are F06's |
| *Test on a sample* on the builder | Test runs are a skill's (the skill page's Tests) |
| Deploy's *At 02:00* forecast and capacity warning (*Add workers*) | Needs each pool's free capacity over time, which the engine does not store; workers and pools are F06's |
