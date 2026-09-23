---
"invana": minor
---

An agent works in a world, and an endpoint is read where agents are
(govern-and-agents-panels.md § 6 step 10 · AG7 · PM6 · PM17 · EB7).

**The third bound was a column nobody could read, write or run inside.** `agents.lens_id` has
existed since migration `49`, `ON DELETE RESTRICT` and all, and the agent row draws it as one of the
three bounds an agent carries — but `AgentRead` never carried it, `AgentUpdate` never took it, and
`freeze_lens` composed the Graph's guardrails and the asker's picked world and **not the agent's
own**. So the bound narrowed nothing: a world set on an agent would have held only on the runs
somebody remembered to pick it for. Three changes make it a bound:

- `AgentRead.lens_id` and **`lens_name`** — the name rides with the id because the row draws a
  chip, and a list that resolves four ids to four names draws none of them (AG8).
- `AgentCreate.lens_id` · `AgentUpdate.lens_id`, read by **set-ness**: omitted keeps what is set,
  and `null` is *Everything, inside the guardrails* — a bound somebody chose, never a side effect
  of editing a description (AG9). It moves on its own event, `agent.lens_set`, because widening an
  agent is the line of the audit somebody comes looking for. A guardrail is refused as an agent's
  bound: it is already in force on every run this agent opens (AG10).
- `freeze_lens` composes the agent's world on every run it opens, beside the guardrails and for the
  same reason. A child inherits its parent's `lens_id` (DG9), so the narrowing travels down the tree
  with no second mechanism.

**Agents is a stacked panel — Agents over the LLMs.** A provider is what an agent's cast
resolves against, so the endpoints are read one drawer below the agents that read them, not in a
tab of Graph settings (PM6 · G29). `?panel=agents&drawer=agents|llms`, with `&agent=` and
`&provider=` as the drill-ins; `?panel=llms` is aliased onto the panel, so every bookmark and the
setup step land where the providers now live. `AgentsPanel.tsx` and `LLMsPanel.tsx` are deleted.

**An endpoint is a group and its models are the rows under it** (PM9). The old list drew one row
per provider because one row *was* one model; the address has two segments now, so the list has two
levels and `llm/anthropic-prod/claude-opus-5` is visible without opening anything. Each model says
who casts it — or *named by nothing — safe to remove* — and removing one a world casts is refused
where the click was, naming the worlds (PM11). Nothing here is a default: `is_default` and its star
are gone, and the lens `cast` answers *which model when nobody said* (PM4).

**A model is ranked when it is offered** (PM17). `cost_rank` and `power_rank` were seeded by the
backfill and left `{}` for anything added after, so a model offered today sat at the middle of an
ordering every older row was seeded into from its published rate. They are derived at add now, from
the same rates, in `LLMEndpointManager` — `shipped_cast` is the ranks' only reader, so what a rank
means belongs beside it. A Graph on a negotiated rate states its own and they are never derived
over. A subscription endpoint ranks at the middle, every model of it: a `claude setup-token` call
is not metered per token, so there is no rate to read.

**The agent panel reads its three bounds together.** *Bindings → LLM* is *Bounds → Works in*, with
the world's cast resolved beneath it; and the budget's five inputs are the ten-row ceilings table
that says **which of them anything enforces** (EB7) — `max_concurrent_runs` refuses at admission, a
spend ceiling is drawn against rather than stopped on, and `max_fanout` is declared and unread until
something dispatches a `map_over`. The Graph's pools list busy or quiet beside the ceiling that
causes the contention (C8).

**The agents list states what it has spent.** `AgentListResponse.spend_this_month` is a
`{agent_id: usd}` sidecar — one grouped read over the calendar month on
`ix_task_runs_agent_started`, never a counter column — and the row draws it against
`max_cost_usd_month`. An agent with no **priced** run is absent from that map rather than zero, and
the panel says *nothing priced this month* instead of a reassuring `$0.00`: a subscription endpoint
is not metered per token, so *nothing spent* and *nothing known* are different facts (OB4).
