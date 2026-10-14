---
"invana": minor
---

Agents gains its Overview, Performance and LLMs pages, and every budget in Agents and the assistant is in tokens (fleet-performance.md).

- **Overview** — `/agents` now lands here: runs today, failed, waiting on a person, p95 run time, tokens
  this month against the agents' month budgets, and success rate; what needs attention, each with the
  one link that answers it; runs a day for 30 days; and the agent and skill versions changed recently,
  with what ran after.
- **Performance** — speed, success and tokens per agent, skill, plan and model over 7, 30 or 90 days,
  against the window before; an agent is marked **degraded** when its last three runs are each past 1.5×
  its 7-day p95, naming the change that came before.
- **LLMs** — its own page: every model version the Graph offers, who pins it (agents, skill versions,
  eval judges) and whether it is still offered. An endpoint opens in a sheet over the page. The Agents
  panel no longer carries an LLMs section.
- **Tokens, never currency** — an agent's list row, quick look and limits read its run and month token
  budgets, and the assistant's session settings cap a run in tokens.
- Engine: `GET …/agents/overview`, `GET …/agents/performance?window=7d|30d|90d` and `GET …/llm/pins`,
  computed at read from the runs.
