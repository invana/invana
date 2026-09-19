---
"invana": minor
---

The catalogue declares itself — `bound` · `args` · `outputs` · `requires` (task-model-migration M1).

`when`, `until` and every `${steps.x.y}` binding used to resolve against an undocumented
surface: whatever a step happened to put in its `output` dict that day. The catalogue now
declares what it produces, and four readers read the same declaration — the planner (what
may I name, what must precede it), the validator, the lane roll-up, and every binding.

```yaml
execute_graph_query:
  bound:    graph_read
  requires: [validate_query]
  args:     {query: {type: str}, read_only: {type: bool, default: true}}
  outputs:  {rows: int, execution_time_ms: int, result_type: str}
```

**A binding to an output the entry never declared is now refused at plan time**, naming both
the step and the field, instead of arriving at step 6 as a `None`. So is a plan that names a
step key nothing can dispatch.

`DEFAULT_REQUIRE` is gone from `apps/agents/envelope.py`, and an envelope can no longer waive
a precondition with `require: []`. A step's preconditions belong to the step, so the planner
reads them **while drafting** rather than being refused and redrafting — a retry loop that
was paid for in tokens.

The set is closed and countable: fourteen entries, **one file per bound** — `pure` (none) ·
`graph_read` · `schema_write` · `llm` · `work_write` — and a test asserts the count, the four
declared fields, and that no entry spans two bounds. Two modules still reach past one app;
both are named in `SPANS_ALLOWED` with what closes them, rather than passing silently.

A fanned-out node's roll-up now follows the declared type: `int`/`float` summed over
succeeded lanes, `list` concatenated, everything else not exposed — bind it per lane. Lanes
that failed contribute nothing, so `written > 0` cannot be true for a load that wrote nothing.

Also fixes the workflow canvas drawing a fan-in step against only its nearest branch: on
`nl-compare`, *Project* summarises **both** readings of the graph and now has an edge from
each.
