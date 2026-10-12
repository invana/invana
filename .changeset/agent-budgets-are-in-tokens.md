---
"invana": minor
---

Agent and session budgets are in tokens, never currency (EB8 · EB14 · EB15).

- **An agent's budget is `max_tokens_month` and `max_tokens_run`** (defaults 5,000,000 and 200,000). `max_tokens` is read as `max_tokens_run` for one release and answered back under both names; where a row carries both, the smaller binds. The money ceilings `max_cost_usd`, `max_cost_usd_month` and `max_cost_usd_run` have no defaults any more: a row that stores them still answers them for one release, and they bound nothing.
- **The meters read tokens.** `GET …/agents` answers `tokens_this_month` (`{agent_id: tokens}`) in place of `spend_this_month`; `GET …/agents/{id}/meters` answers `tokens_this_month`, `max_tokens_month` and `max_tokens_run` in place of `spend_this_month`, `max_cost_usd_month` and `max_cost_usd_run`. Tokens are summed over the agent's root runs started this calendar month and their steps; eval runs are left out.
- **A session's per-run cap is `max_tokens_run`.** `PATCH …/sessions/{id}` takes it, clamped to the agent's `max_tokens_run`; the summary answers `max_tokens_run` and `agent_max_tokens_run`; a run freezes it into `params.max_tokens_run`, and its trace's `budget` reads that frozen number. Migration 077 adds `sessions.max_tokens_run`. `max_cost_usd_run` is still accepted and answered for one release, and bounds nothing.
