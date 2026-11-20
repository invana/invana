# CP-09 · Tasks

What the designer, the coder and QA do to deliver [CP-09](story.md). The story governs; each role adds and edits only
its own rows (`.claude/skills/product-spec/format.md` › *Tasks*).

| ID | Owner | Title | Description | Story | Criteria | Boards | Depends on | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CP-09-T2 | designer | Workers, group and worker states on settings.workers | Groups, All workers, Group and Worker states, both lenses; join keys move to their own tab. Page *Settings · Operations*, both lenses | [CP-09](story.md) | CP-09.1–CP-09.15 | settings.workers | — | done | canvas page Settings · Operations › settings.workers (platform-design-2 P07) |
| CP-09-T3 | designer | Drain, Revoke and the lease refusal end to end on settings.workers | Worker and Group · Drain → Draining → Drained or Could not drain (Cancel · Try again); Join keys · Revoke → Revoked; Worker · Refused outside its lease, Admin and Read only; `flow.drain_worker` paths in `flows.json` (its board is P10's) (platform-design-3 P04) | [CP-09](story.md) | CP-09.7 · CP-09.8 · CP-09.10 · CP-09.11 · CP-09.16 · CP-09.18 | settings.workers | — | done | canvas page Settings › settings.workers, v56 (platform-design-3 P04); `flows.json` flow.drain_worker 7/7 paths pass |
| CP-09-T1 | qa | Pass 1 · spec check | Story id, title and feature match the folder; criteria agree with the feature file and the P07 Done-when; spec check and links green. Specs only, no build | [CP-09](story.md) | CP-09.* | — | — | done | `.agent-reports/qa/specs-planes-P07-qa.md` |
