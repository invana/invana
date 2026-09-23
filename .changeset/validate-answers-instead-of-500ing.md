---
"invana": patch
---

`POST …/govern/lenses/validate` answers instead of 500ing.

The route raised on **every** call, a clean draft included: it built `ValidationRead` from
`r.__dict__`, and `Refusal` and `Warning_` are `slots=True` dataclasses, which carry no
`__dict__` at all. So the two refusals W3 draws — *a world cannot widen a guardrail*, *only
declared axes are selectable* — were produced correctly and then thrown away one line
before the wire.

Both now arrive as JSON, worded exactly as the CLI words them:

| Draft | Answer |
|---|---|
| `allow third_party/api/clearbit.com/**` under a guardrail denying `third_party/**` | `widens_guardrail`, recourse `third_party/**` |
| `select.time` on a model that declares no time axis | `undeclared_axis`, naming the model **and** the axis, recourse `graph_data/model/AirRoutes@1.0.1` |

Forty-five tests missed it because every one of them stopped at the resolver, and a
resolver test cannot see a serialization fault. `tests/govern/test_routes.py` is the first
Govern test that goes through a view; it fails on the old code, including on the clean
draft.
