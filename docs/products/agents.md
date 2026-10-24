# Invana Agents — build, tune, watch

The agents that do the legwork, and the instructions they run on. Prototype page: *Invana Agents › Build, tune, watch*.

| | |
|---|---|
| For | builders |
| Scope | One Graph |
| Rail | Overview · Agents · Skills │ Library · Plugins · LLMs · Performance │ Settings (bottom) |
| Core rule | People write `instructions.md`; Flows are generated from it, never drawn |
| Moved out | Schedules → Shell · Projects → the Projects product |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| AG-F1 | Overview — broke, waiting, slower, changed recently | In Studio (C10, [5.10](../for-developers/modules/agents/features/fleet-performance.md)) | AG-01 |
| AG-F2 | Agents and their lineage | In Studio | AG-02 |
| AG-F3 | Agent page and activity | In Studio | AG-03 |
| AG-F4 | Agent instructions.md | In Studio (C03) | AG-04 |
| AG-F5 | Tune — soul, thinking, skills and callables, envelope | In Studio | AG-05 |
| AG-F6 | Agent history with effect after | In Studio (C03) · compare two versions is C04 | AG-06 |
| AG-F7 | Pause or retire with impact | In Studio | AG-07 |
| AG-F8 | Skill instructions.md beside its generated plan; drafts, eval set replayed before publish, regenerate on publish, one-click rollback | In Studio (C03) | AG-08 |
| AG-F9 | Skill history — why, plan change, performance after; restore | In Studio (C03) | AG-09 |
| AG-F10 | Skill usage | In Studio | AG-10 |
| AG-F11 | Library › Plans — generated, read-only; revisions in runs | In Studio (plans · revisions in runs, C03) | AG-11 |
| AG-F12 | Library › Templates — chosen by code from the result’s shape, ranked by the classified intent | In Studio · New (intent ranking — engine ✅ B13) | AG-12 |
| AG-F13 | Plugins — the registry of every plugin (core, tool, simulator, MCP) with its task types, manifests, versions, skills and flows; Admin enables | In Studio (C03) · engine registry API ✅ B06b ([13.12](../for-developers/modules/platform/features/tool-plugins.md)) · MCP plugins ✅ B07 ([13.13](../for-developers/modules/platform/features/mcp-plugins.md)) | AG-13 |
| AG-F14 | LLM endpoints and model versions — agents pin an exact version name | In Studio (endpoints · pinning, C03 · its own page, C10) | AG-14 |
| AG-F15 | Performance with degradation alerts | In Studio (C10, [5.10](../for-developers/modules/agents/features/fleet-performance.md)) · alert notifications not built | AG-15 |
| AG-F16 | Concurrency pools | In Studio | AG-16 |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| AG-01 | builder | what broke, waits, slowed down or changed | I tend agents before users notice | `agents.overview` · `agents.overview.dark` |
| AG-02 | builder | every agent and who made it, what it uses, what it ran | I know my fleet | `agents.agents` · `agents.agents.lineage` |
| AG-03 | builder | one page per agent with its activity | I see what it did and how many tokens it used | `agents.agent` · `agents.agent.activity` |
| AG-04 | builder | to write an agent’s instructions.md | its behaviour is plain text I own | `agents.agent.instructions` |
| AG-05 | builder | to tune soul, thinking, skills and envelope | it behaves the way the job needs | `agents.agent.soul` · `agents.agent.thinking` · `agents.agent.skills` · `agents.agent.envelope` |
| AG-06 | builder | an agent’s history with performance before and after | tuning is measured, not guessed | `agents.agent.history` |
| AG-07 | builder | to pause or retire an agent and see what it affects | nothing breaks by surprise | `agents.agent.pause` |
| AG-08 | builder | to write a skill’s instructions and see the plan generated from them | I never hand-draw a pipeline | `agents.skills` · `agents.skills.detail` · `agents.skills.instructions.edit` · `agents.skills.evals` · `agents.skills.plan.regenerated` |
| AG-09 | builder | a skill’s history: why each version, its plan change, its speed after | I can roll back with evidence | `agents.skills.history` |
| AG-10 | builder | how often a skill is offered and applied, by agent and outcome | I know if it earns its place | `agents.skills.usage` |
| AG-11 | builder | every generated plan, its source, and how runs replanned it | I see how agents read instructions at runtime | `agents.library` · `agents.library.plan` · `agents.library.plan.overview` · `agents.library.plan.revisions` |
| AG-12 | builder | the answer templates and the shapes each accepts | I know how answers will render | `agents.library.templates` |
| AG-13 | builder | one registry of every plugin and its task types, skills and flows — versions, manifests, who may call them | I see everything agents can run, and enable it deliberately | `agents.plugins` · `agents.plugins.plugin` · `agents.plugins.task` |
| AG-14 | builder | the LLM models agents think with, each pinned to an exact version name | an upgrade never changes an agent by surprise | `agents.llms` |
| AG-15 | builder | speed, success and tokens per agent and skill, and an alert when they degrade | regressions are caught the day they ship | `agents.performance` |
| AG-16 | builder | how much may run at once, pool by pool | one job never starves the rest | `agents.settings` |

## Instructions → plan

| Step | What happens |
|---|---|
| Write | A person edits a skill’s or agent’s `instructions.md`, with a reason — it stays a draft |
| Evaluate | Saving a draft replays the eval set against live and draft: checks, changed answers, speed, tokens |
| Publish | The plan regenerates (r8 → r9); both diffs land in History |
| Pick up | Bound agents use the new version on their next run; running ones finish on the old |
| Run | A run may replan (orchestration §0.11); revisions belong to the run, never the base plan |
| Measure | History shows p95, tokens and changed answers after each version |
| Restore | One-click rollback makes a new version from the previous one; nothing is rewritten |

## CLI

| Command | Does | Status |
|---|---|---|
| `invana agents list` · `show` · `history` · `pause` · `retire` | agents and their changes | New |
| `invana agents push <agent> --instructions <file>` | upload instructions.md as a draft | New · P-11 P-15 |
| `invana skills list` · `show` · `push <skill> --instructions <file>` · `publish` · `rollback` · `history` | skills: draft, publish, roll back | New · P-11 P-15 |
| `invana evals run --skill\|--agent [--draft]` · `list` · `promote <run> --as passing\|failing` | eval sets; promote real asks into cases | New · P-15 |
| `invana plans list` · `show` | generated plans, read-only | New · P-11 |
| `invana llms list` · `models` | endpoints and model versions | New |
| `invana agents pin <agent> --model claude-opus-5-5` | pin a model version; evals run first | New · P-17 |
| `invana plugins list` · `show` · `enable` · `disable` · `mcp add <url>` | the plugin registry and task manifests | New · P-01 P-02 |
| `invana performance [--agent --skill] --since 7d` | speed, success, tokens; degradations | New |

## Decisions

| Decision | Detail |
|---|---|
| Plans are generated or packaged | People never draw plans: a plan is `generated` from instructions or `packaged` in a plugin pack (today's built-in flows are packaged). User-authored plans are retired; Library has no “New plan” |
| Task types come from plugins | Each declared by a task manifest; the registry builds itself from them at start-up. Library › Catalogue is retired — the catalogue is Agents › Plugins. Worlds and guardrails decide who may call a task type |
| Mail send | Always asks for approval |
| Tool plugins | Detail in [plugins.md](plugins.md). Live **inside the engine**: `engine/src/invana/plugins/tools/<plugin>/` (`web`, `mail`, `science`, `simulators/genomic`). Each plugin's dependencies are an optional extra (`pip install invana[tools-web]`). Installed plugins register their methods as **catalogue entries**; an Admin enables them. Third-party plugin packages are not supported for now |
| A tool method declares | key and summary · layer (third party) · typed inputs and outputs · side effect (read · write · send — send always needs approval) · timeout and retry defaults · token use or compute class · named secrets it needs |
| Where tools run | In workers, never in the API process, once the distributed executor exists — isolation, egress rules, and only the secrets that worker needs |
| Executor | Invana's runtime stays the orchestrator (plan validation, replan, approvals, token budgets, lineage). Execution sits behind the runtime protocol: `inline` (asyncio) is the default; a distributed executor is chosen by a benchmark spike — procrastinate (Postgres) vs Dramatiq vs Prefect — on Invana's own workload (P-21) |
| Templates stay out of prompts | A template declares what it `accepts`; code matches it to the result shape. Many templates cost no tokens. If organisations author many, matching stays in code — never a longer prompt |
| Eval sets | Each skill and agent keeps fixed questions with expected traits (cites records, names the world, never guesses, stays under N tokens) |
| Eval checks | Rule checks wherever possible (cites records, names the world, says *cannot answer* when it should, guardrail holds, expected records present, tokens and latency under a limit). An LLM judge with a rubric, run on a different model, only for prose quality; judged scores are labelled and never mixed with hard checks |
| Eval gate | A failed hard check blocks publish. Slower, more tokens or lower judged scores warn with the numbers; publishing past a warning needs a stated reason, kept in History |
| Eval sources | A starter set written by the builder or drafted by the assistant from the instructions; real asks are promoted in one click — a good answer becomes a regression case, a bad one a failing case. Sensitive asks need a person to promote them |
| Drift evals | Evals re-run when the LLM, the Graph’s model version or a bound world changes, and nightly as a shared schedule. A drop in hard checks or a large speed or token shift raises a degradation alert naming the trigger |
| Eval budget | A separate monthly eval token budget per Graph, shown apart from production tokens. At the ceiling, scheduled evals pause and say so; publish-time evals still run, with a warning |
| Rollout | Draft → publish to every bound agent on its next run; no traffic splitting |
| Model versions | Models are listed by the provider’s exact version name (`claude-opus-5-5`, `claude-opus-5-6`). An agent, skill or judge **pins** a version; a provider releasing a new one changes nothing until a person moves it. Moving is a change with evals first, kept in History |
| Tokens, never currency | Budgets, limits and usage are in tokens. No dollar or other currency amounts anywhere, since what a token costs depends on each customer’s subscription |
| Degradation | An alert fires when p95 passes 1.5× its 7-day baseline for 3 runs; it names the change that preceded it |
| Rail → path | Overview `/agents/overview` · Agents `/agents/agents[/:agent]` · Skills `/agents/skills` · Library `/agents/library[/:plan]` and `/agents/library/templates[/:template]` · Plugins `/agents/plugins[/tasks/:entry]` · LLMs `/agents/llms[/:provider]` · Performance `/agents/performance` · Settings `/agents/settings`. The product has no crumb of its own, because the wordmark reads *Invana Agents* |
| Landing | The bare `/agents` lands on Overview, the first rail item |
| Agents and LLMs | The Agents panel is one section, the agents. LLMs is a page of its own (see *LLMs*) |
| Library | Plans over Templates. Templates sits under Library's path, so Library's rail item stays lit there |
| Plugins | The plugin registry over the task catalogue (see *Plugins registry*). The catalogue moved here from Library, because plugins bring the task types. An old `?panel=library&section=catalogue` link lands on `/agents/plugins/tasks` |
| Overview, Performance | Full-width pages over the engine's fleet reads (`…/agents/overview`, `…/agents/performance`), drawn as the boards are. Every act on them is a link to where the act lives — Activity › Runs, Approvals, the change log's compare, the agent's page. Detail: [5.10 › Decisions](../for-developers/modules/agents/features/fleet-performance.md#decisions) |
| Settings | The Graph's concurrency ceiling and its pools. These left the Modeller's Graph settings, which keeps Basic · Graph |
| Rules | Not listed under Skills. A Graph's rules are the Modeller's Rules |
| Plan page | It shows no cost in currency. Tokens per plan replace it once the engine reports them |
| Agent budgets | An agent's list row, quick look and Overview › Limits read its token budget (`up to 8k tokens a run`); with none set, the list row and quick look read *the Graph's run budget* and the meters read *no run budget*. Activity has no spend tile; its runs table shows tokens per run, and its meter reads tokens this month against the month budget. The Limits › Budget table lists `max_tokens_run` and `max_tokens_month`. The engine keeps both budgets in tokens ([EB8 · EB14 · EB15](../for-developers/modules/agents/features/envelope-and-budget.md#decisions)) |
| Session run cap | The assistant's session settings cap one run in tokens (`max_tokens_run`), held at the agent's own run budget, which the field names; empty is *the agent's budget*. A session made before tokens keeps its money cap stored, unread and undrawn |
| Main area | Each panel rail item has its own empty-main line — Plugins *Pick a task type…*, Settings *Settings have no canvas…*. Overview, Performance and LLMs are pages: they fill the main area and open no panel |
| LLMs | Its own page: the model versions the Graph offers — model · version name · endpoint · pinned by (agents, skills, eval judges) · status — under a notice naming any pinned version no longer offered. An endpoint's detail and *Add endpoint* open in a sheet over the page (`/agents/llms/<provider>`, `/agents/llms/new`) |
| Agent page tabs | Overview · Instructions · Skills & callables · Thinking · Soul · Activity · History, as drawn. Instructions leave the page's Save buffer: Thinking no longer edits a *Focus*, and Overview's *Instructions* card goes to the Instructions tab |
| Agent instructions | The Instructions tab reads the published `instructions.md` beside *What it shapes*. *Edit* writes the agent's draft (`PATCH …/draft`) — nothing runs on it. *Publish* takes a stated reason and goes through the eval gate; a gate refusal is drawn as a refusal card with *Run the evals* where the engine asks for one. *Discard* drops the draft. A restore is made from History |
| Agent history | The History tab is the change log of the agent (`history/agent/<id>`): when · by · what changed · why · after (runs, failed, tokens). A row that changed the instructions offers *Restore*, which asks for a reason and is gated like a publish. *Compare two versions* is the shared compare (SH-14, C04) and is not drawn here |
| Skill page tabs | Instructions · Plan · Bindings · Usage · History, as drawn — Playbook, Flow and Versions are renamed to the product's words |
| Skill instructions | The Instructions tab reads `instructions.md` beside the plan generated from it, read-only. *Edit instructions* opens the draft with a *Why* field and the model version it pins. *Save draft · run evals* saves the text, generates the plan (a draw — a question the planner asks is answered on the tab) and, once it is drawn, replays the eval set against live and draft. *Publish vN* sends the why; a warned run needs one, a failed hard check blocks it |
| Skill evals | The evals view is a mode of the Instructions tab, not a sixth tab: tiles (questions · checks passed · answers changed · p95 · tokens per run) over the case table, live against draft. The eval set is edited there: add a case (question · passing or failing · rule checks), delete one, *Propose from the instructions*. Promoting a real ask stays in the run's page (`evals/promote`), not built here |
| Plan regenerated | The Plan tab draws the current version's generated plan and, under it, the change log's compare of the last two versions: steps added, removed and changed, and which bound agents pick it up on their next run |
| Skill history | The History tab is the change log of the skill (`history/skill/<id>`): version · when · by · why · after (runs, failed, tokens), each row with its prose diff. *Restore vN* asks for a reason, is gated, and makes a new version; nothing is rewritten |
| Revisions in runs | A plan page gains *Revisions in runs*: pick one of the plan's runs that replanned, and read the base plan's steps against the steps that run ran — run, added by a replan, not run. A replan changes that run only. The engine keeps a run's revision count, not each revision's steps, so the tab draws what the run ran, not r1 · r2 · r3 |
| Plugins registry | The Plugins section lists `/plugins` — name · kind · version · task types · state — filtered by kind and searched by name. A row opens the plugin's page (`plugin:<name>` in `mainSection`); a task type on it opens the task type's page (`task_type:<key>`). Enable and Disable are an install Admin's and only on a switchable plugin. *Connect an MCP server* is not built in Studio — `invana plugins mcp add` does it |
| Task type versions | The task type page shows the manifest the registry loaded and its runs in 30 days. The registry keeps one version per key, so earlier versions are named by the runs that recorded them, not listed |
| Model pins | Thinking carries *Model version*: none (the world's cast decides) or an exact version name from the Graph's endpoints. Moving it is its own act with a reason, gated by evals; *Run the evals on this pin* opens the run the gate asks for. Each LLM endpoint's models name the agents pinned to them |

## Not building

| Item | Why |
|---|---|
| Hand-drawn plans | Plans come from instructions |
| Schedules here | Shared in the shell |
| Projects here | The Projects product owns them |
