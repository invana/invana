---
"invana": minor
---

The read surfaces a skill and a rule need (skills-pass.md K5 · US6).

Each artboard on the Skills and Rules pages now answers in one request instead of assembling
itself from several.

**The diff.** `GET …/skills/{id}/versions/{version}/diff` returns unified diff lines per field
against the version before it, so the version bar, the CLI and anything else agree about what
changed rather than each computing it. `v1` diffs against **nothing** — a first version did not
delete anything, which is not the same as being compared to empty text. The plan half of the
diff arrives when a version draws a plan.

**Usage, split two ways.** `GET …/skills/{id}/usage` now carries `by_agent` and `by_outcome`
alongside the per-version counts — which agents apply it and which never do, and whether it was
applied in runs that served or runs that did not. Both are for the **current** version: a
breakdown summed across versions is exactly the number counting per version exists to prevent. A
step carries no agent of its own, so the agent is read from the run that opened it.

**The engine never sends a percentage.** *Offered 3, applied 1* is three runs, not 33%. Every
bucket carries `enough_to_read`, false below a floor the engine owns, so the API, the CLI and
Studio all say *too few to read* at the same point instead of each picking a threshold.

**Rule citations.** `GET …/rules/{id}/citations` says where a rule was actually used, and every
row names the **version** it read — so rewording a rule, or deactivating it, leaves each past
citation reading exactly as it did. The rule list carries a `citations` count per row, gathered
in one query rather than one per row, because that is where the drawer draws it.
