---
"invana": minor
---

Instructions, evals, history and plugins in Invana Agents.

- **An agent's Instructions tab** reads its `instructions.md`. *Edit* writes a draft nothing runs on;
  *Publish* asks why and passes the eval gate; *Discard* drops the draft.
- **Evals:** each agent and skill keeps an eval set — add a case, accept a proposed one, or *Propose
  from the instructions*. *Run the evals* replays the set on the draft against live: questions,
  checks passed, answers changed, p95 and tokens per run. A publish the gate refuses says why, with
  *Run the evals* where it asks for a run.
- **History** on an agent and on a skill lists every change — when, by whom, what changed, why, and
  the runs, failures and tokens after it. *Restore* makes a new version from an earlier one, with a
  reason, through the same gate.
- **A skill's page** reads Instructions · Plan · Bindings · Usage · History. Plan shows what the last
  publish regenerated and which bound agents pick it up on their next run.
- **A plan's page** gains *Revisions in runs*: a run that replanned, its steps against the plan's.
- **Plugins** lists every plugin this install loaded — kind, version, task types, state — filtered by
  kind. A plugin opens as a page with its task types, skills and flows; an install Admin enables or
  disables a tool or MCP plugin there. A task type opens with its manifest and its runs in 30 days.
- **Model version** on an agent's Thinking pins an exact model, moved with a reason through the eval
  gate; each LLM model row names the agents pinned to it.
- Thinking no longer edits a *Focus*: the instructions are written on the Instructions tab.
