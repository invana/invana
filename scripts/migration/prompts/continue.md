Continue migration session {{ID}} from docs/products/migration-sessions.md. A previous session handed off because its context grew too large; you are running unattended.

1. Read docs/products/migration-sessions.md: "Rules for every session", the entry for {{ID}}, and the newest hand-off note for {{ID}} — it says where to resume.
2. Set {{ID}}'s log row back to `in progress`, then continue from the step the note names. Do not redo finished steps; check `git status` and `git diff` to see what is already done.
3. Work as the lead in scripts/migration/prompts/team.md: the contract is already on disk, so split what is left across up to 3 sub-agents with no file in two parts, when it is big enough to split. Same rules as the first session: only this entry, never commit or push, run its exit checks, add a hand-off note when you finish (or hand off again if told to).

Never edit `scripts/migration/baseline.json` and never set your own log row to `done` — both belong to the driver, which reverts them.
