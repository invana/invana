---
"invana": patch
---

An import shows the models it wrote, and guardrails govern writes (GV35 · GV36 · LD24 · ST53 · SR68).

Imports and bulk loads now freeze the Graph's guardrails when they open, like every other run. Each
write step (`write_graph`, `stitch`, `commit_stitches`, `bulk_write`) checks the model version it writes
into before writing, and records a touch after: `graph_data/model/Deals@1.0.0`, with the nodes and
edges it wrote. A stitch touches the model on each side of it. The run dashboard's *What each step
engaged* and the drawer's *What it touched* now show this for every plan.

A guardrail that denies a model now refuses loading it too: the import ends in *cannot answer* naming
the rule, before anything is written. A stitch whose other side is refused is skipped, and the rest
are still solved.

A run's asked row shows only the prompt as typed; the drawer no longer derives a generated query.

`GET …/runs/{id}/trace` carries `governed`: `false` means the run froze no lens, so what it engaged
was never recorded.
