# Pin a model version

An agent, a skill version and an eval set's judge each name the exact model version they think with —
the provider's own version name — and every run records the version it called, so a provider release
changes nothing until a person moves the pin, and any run can be re-run on the versions it used.

| | |
|---|---|
| Index | [5.9](../../../README.md#5--agents) · Slice **B02** (P-17) |
| Module | [Agents](../spec.md) |
| API / CLI / Studio | 🟡 / 🟡 / 🟡 |
| Related | [providers-and-models](providers-and-models.md) · [author-an-agent](author-an-agent.md) · [evals](../../skills/features/evals.md) · [change-log](../../operate/features/change-log.md) · products: [agents.md](../../../../products/agents.md) AG-14 · [shell.md](../../../../products/shell.md) SH-18 |

Product spec: [AG-F01 · Build an agent](../../../../../specs/products/agents/features/AG-F01-build-an-agent/feature.md) — AG-29; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Settings › LLM providers | A page of its own: models by version name, each row naming the agents, skill versions and eval judges pinned to it (`GET …/llm/pins`), and a notice for a pinned version the Graph no longer offers ([5.10](fleet-performance.md)) |
| Agent page › Thinking | *Model version*: none, or an exact version; moving it is its own act with a why, gated (C03) |
| Skill page › Instructions | The draft's model version, published with the next version (C03) |
| Run page | *Re-run…* on the header of a settled root ask → the re-run dialog: *Ran with* (model version · agent version · world), *The same versions — reproduce it* · *Current versions — compare*, Cancel · Re-run. A re-run's page carries *Compare with the original* (SH-18, C09) |
| CLI | `invana llms list` · `models <endpoint>` print the addresses a pin takes; `invana agents pin <agent> --model <address>` passes the eval gate on the new pin first |

## Engine

| Column | On | Is |
|---|---|---|
| `model_pin` | `agents` | String255, nullable — `llm/<provider name>/<model_id>`; null = the cast decides |
| `model_pin` | `skill_versions` | String255, nullable — frozen at publish like the prose |
| `model_version` | `task_runs` | String255, nullable — the `model_id` the run called |
| `rerun_of_run_id` | `task_runs` | FK `task_runs`, nullable — the root run this one re-ran |

| Route | Does |
|---|---|
| `PATCH …/agents/{id}` `{model_pin, why}` | Moves the pin — a new agent version; `details.diff.model_pin` |
| `PATCH …/skills/{id}/draft` `{model_pin}` | Sets the draft's pin; it publishes with the version |
| `POST …/runs/{run_id}/rerun` `{versions: same \| current}` | Opens a new root run for a settled ask; `same` re-uses `model_version`, the world and the lens snapshot; `current` freezes today's |

| Resolution at open | Order |
|---|---|
| The model a step calls | a person's pick for this one ask → the skill version's pin → the agent's pin → the cast. Each must be a model the Graph offers and the lens allows |

## Decisions

| # | Decision |
|---|---|
| PV16 | **Model versions are listed in Settings › LLM providers**; an agent pins one in the Agent Builder ([5.16](install-wide-agents-and-skills.md) WD14) |
| PV1 | **A pin is an address, the same string a cast holds** — `llm/<provider name>/<model_id>`. One shape for *which model*, resolved by one function, so a pin and a cast cannot disagree about what a name means. |
| PV5 | **The run records the version it called**, on `task_runs.model_version`, beside `params.llm_model_id`. The row id says which endpoint; the string is what history keeps when the row is gone. |
| PV7 | **Re-run is a new root run**, linked by `rerun_of_run_id`; it never touches the original. `same` replays the recorded versions and refuses, naming it, when one is gone; `current` reads today's pins and cast. |
| PV8 | **A person's pick for one ask is innermost.** The composer's model pick names the model for that ask only; it outranks the pins, and it is lens-checked like them. It moves no pin and mints no version. |
| PV9 | **The skill pin is the plan's.** A run whose plan was drawn from a skill version calls that version's pin; a run on a generated plan reads the agent's. |
| PV10 | **Re-run takes a settled ask.** An `nl` or `ql` root that is no longer queued, running or waiting. It opens as a run of its own, in no session, so the original reply is never rewritten; every task an ask runs reads its session as optional, and a model call's audit event points at the run when there is no session. `same` pins the recorded `model_version` and copies the frozen lens; the plan is drawn afresh. Replaying plan revision 0 and the offered skill versions waits for the run page that shows them (SH-18). |

| PV12 | **Re-run is the run page's act, and only where the engine takes it.** *Re-run…* is on the header of a root `nl` or `ql` run that has settled; a step, an import or a live run has none. It opens a dialog whose *Re-run on* is a segmented control — *The same versions — reproduce it* · *Current versions — compare* — the control the Share dialog uses for its one choice; the request is `POST …/runs/{id}/rerun {versions}`, and a 409 is shown in the dialog in the engine's own words (`version_not_offered` names the version). |
| PV13 | ***Ran with* shows what the run recorded, nothing else**: the model version (or *not recorded*; a `ql` run *calls no model*), the agent and its version, the world as frozen. The skill version and dataset versions are not on the run record, so they are not drawn; *current* names no versions ahead of time, because they are resolved when the run opens. |
| PV14 | ***The same versions* is disabled, with its reason, on an `nl` run that recorded none** — the refusal the engine would give, said before the click. |
| PV15 | **A re-run opens its own page; a re-run on current versions opens the comparison when it finishes.** The browser that asked holds the pair in memory and opens `compare:<re-run>:<original>` once the new run settles on its page. A reload loses only the automatic opening: a re-run's page always carries *Compare with the original*. The comparison's trail is *Graph › Activity › Runs › run:<a> · run:<b>*. |
