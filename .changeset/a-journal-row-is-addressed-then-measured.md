---
"invana": minor
"studio": minor
---

A journal row is addressed first, then measured (docs/for-developers/modules/operate/features/see-what-ran.md SR45).

**The run's short id is on the row.** Line one of a `Runs` row opens with the last eight characters of the run's id, monospace, quoted the way a commit is, then what the run was about — `a3f91c0d  Import news-tv`. A run is the noun every other surface names, so a list nobody can quote from forced a drill-in just to copy one id.

**Line two is what the run spent**, not which step it is on: `1.4s · 8.2k tokens · 5/7 tasks · 2 mins ago`. Elapsed runs on the run's own clock — `started_at → finished_at`, ticking while it is live, so a run that sat in the queue for a minute does not claim to have taken one. `5/7` is a position, never a percentage: a plan can replan, and a count that goes backwards is worse than no count. *Which* step it is on is what the drill-in answers. Each fact is absent when nobody recorded it rather than reading as zero — a load spends no tokens and draws none.

**`GET …/runs` carries those facts itself.** Items gain `started_at`, `tokens_in` and `tokens_out`, the last two summed over the run's tasks in the pass that already counts them — so a fifty-row journal is one request, not fifty traces.
