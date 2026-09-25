---
"invana": minor
---

Bounds come with the work: an agent binds no world, and a session carries the world and the spend per run for its asks (AG24 · AG26 · AS5).

- **`agents.lens_id` is gone.** Migration 054 turns each agent's world into a guardrail scoped `agent:<id>` with the same rules, cast and closed layers, so nothing an agent could reach widens. `AgentRead` answers `guardrail_id` and `guardrail_name` instead of `lens_id` and `lens_name`; `AgentCreate`/`AgentUpdate` no longer take a world, and the `agent.lens_set` event is retired. Deleting a world is no longer refused for an agent that carried it.
- **A session carries `lens_id` and `max_cost_usd_run`.** `PATCH …/sessions/{id}` sets them (null is *Everything* and *the agent's cap*); a guardrail is refused as a world, and a spend above the agent's `max_cost_usd_run` is clamped to it. `POST …/sessions` takes `lens_id` for the thread's first world. The summary answers `lens_name`, `lens_missing` (the world was deleted since) and `agent_max_cost_usd_run`.
- **An ask runs in the session's world unless it says otherwise.** Omitting `lens_id` on `SendMessage` uses the thread's world; sending `null` asks in *Everything* for that ask only. The run freezes the spend per run into `params.max_cost_usd_run`. Each reply carries `lens_id` and `lens_name` — the world its run was frozen with, named as it was then.
- **A refusal names the bound it came from** — *the agent's own guardrail 'Nothing leaves'*, *the Graph's guardrail*, or *the world* — carried on each rule of the frozen snapshot (AG6).
- **A delegated child opens inside its parent run's frozen lens** rather than copying a world onto the child agent (DG9).
