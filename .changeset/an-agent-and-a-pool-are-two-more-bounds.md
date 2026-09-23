---
"invana": patch
---

An agent has a ceiling of its own, and a crossing takes a slot in a pool (A2 · A5).

`runtime/contention.py` held one bound and now holds three, and the point is that they are **not
the same bound**. A refusal says which one it was, every time.

| Bound | Scope | At the ceiling |
|---|---|---|
| `GraphSlots` | runs at once, per Graph | the Graph's policy — queue with a position, or refuse |
| `AgentSlots` | runs at once, per **agent** | refuses, naming the agent's ceiling (CC11 · EB3) |
| `PoolSlots` | crossings at once, per pool | refuses, naming the pool — `llm` · `graphdb` (CC8) |

**An agent at its own ceiling is refused, never queued**, and checked *before* the Graph's — so it
is told about its own bound rather than waiting behind one it was never going to reach. `queue` and
`refuse` are a policy stated on the Graph about the Graph's ceiling; an agent has no such column,
and a second queue with its own precedence would make *why am I waiting* two answers instead of one.

**A pool slot is held across one crossing, not one run.** A run waiting five seconds on a model is
not also holding a database connection it is not using. It is taken *after* the lens has spoken, so
a call this world refuses does not first consume a slot somebody else could have used; given back
when the crossing closes; and swept when the run settles, because a crossing that raises between its
two halves would leak one. A full pool is a **bound**, never a query error — the question was fine
and the machine is busy, and *a query error* sends the reader to fix a query with nothing wrong
with it. `GET …/graphs/{id}/concurrency` now lists every configured pool with its size and what is
in it, busy or quiet.

**The budget carries all six ceilings, and the trace carries all of them.** `max_cost_usd` became
`max_cost_usd_month` — both names read for one release, so neither a row configured today nor a
reader that has not moved yet loses its number — and `max_cost_usd_run`, `max_fanout` and
`max_concurrent_runs` joined it. `GET …/runs/{id}/trace` sends the whole budget rather than the two
keys the first dashboard happened to need: a ceiling the wire does not carry is one no screen can
draw.

**Declared is not enforced, and the ceilings table now says which is which.** `max_concurrent_runs`
is enforced. `max_cost_usd_run` is declared and drawn against — stopping on a spend ceiling is a
budget approval, and the envelope is checked before dispatch, never during (EB2). `max_fanout` is
declared and unread until something dispatches a `map_over`. `heavy` stays a configured pool with no
call site, because graph algorithms are what it is for and nothing dispatches one.
