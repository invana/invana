# CP-10 · Tasks

What the designer, the coder and QA do to deliver [CP-10](story.md). The story governs; each role adds and edits only
its own rows (`.claude/skills/product-spec/format.md` › *Tasks*).

| ID | Owner | Title | Description | Story | Criteria | Boards | Depends on | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CP-10-T2 | designer | Add workers: Docker and Python run steps, Join keys list on settings.workers | Run it for Docker (one line, env, Copy, Download .env) and Python (install, command, service), Region, Join keys and No join keys with Revoke. Page *Settings · Operations*, both lenses | [CP-10](story.md) | CP-10.5 · CP-10.16–CP-10.21 | settings.workers | — | done | canvas page Settings · Operations › settings.workers (platform-design-2 P07) |
| CP-10-T3 | designer | Add workers end to end on settings.workers and flow.add_workers | E2E-008 · 009 · 010: Where picked per platform, New group · Filled with Mint enabled, Join key its own step (Set · Expired · Used up), one Run it per platform with Back to Join key, Waiting to join with Cancel and the five join failures, Joined with Done and Add more, Join keys · Revoke → Revoked; `flow.add_workers` reframed, both lenses; `flows.json` paths (platform-design-3 P04) | [CP-10](story.md) | CP-10.1–CP-10.26 | settings.workers · flow.add_workers | — | done | canvas page Settings › settings.workers and Flows › flow.add_workers, v56 (platform-design-3 P04); `run.mjs --through P04` 58/58 |
| CP-10-T1 | qa | Pass 1 · spec check | Story id, title and feature match the folder; criteria agree with the feature file and the P07 Done-when; spec check and links green. Specs only, no build | [CP-10](story.md) | CP-10.* | — | — | done | `.agent-reports/qa/specs-planes-P07-qa.md` |
