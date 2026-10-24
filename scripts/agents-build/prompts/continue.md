Continue phase {{ID}} of docs/products/agents-build-sessions.md. A previous session handed off because its context grew past the limit; you are running unattended.

1. Read docs/products/agents-build-sessions.md: "Rules for every session", the entry for {{ID}}, and the newest hand-off note for {{ID}} — it says where to resume. Read CLAUDE.md.
2. Set {{ID}}'s row back to `in progress`, then continue from the step the note names. Check `git status` and `git diff` to see what is done; do not redo it.
3. Work as the lead in scripts/migration/prompts/team.md, splitting what is left across up to 3 sub-agents with no file in two parts when it is big enough. Same rules as the first session (scripts/agents-build/prompts/build.md): only this phase, docs before code, validate every named board live against the prototype, run the gates, commit each finished step as a `wip` commit (never push), add a hand-off note when you finish — or hand off again if told to.

Keep your plan in the todo list (TodoWrite) and update it as you go — the build dashboard shows it.

Never edit scripts/migration/baseline.json and never set your own row to `done`.
