Continue phase {{ID}} of project `{{PROJECT}}` ({{FILE}}). A previous session handed off because its context passed the limit; you are running unattended.

1. Read {{FILE}}: "Rules for every session", the entry for {{ID}}, and the newest hand-off note for {{ID}} — it says where to resume. Read CLAUDE.md.
2. Set {{ID}}'s log row back to `in progress`, then continue from the step the note names. Check `git status`, `git diff` and `git log` for what is done; do not redo it.
3. Same rules as the first session (`.claude/skills/run-project/prompts/build.md`): only this phase, work as the lead in `prompts/team.md`, run the gates, add a hand-off note when you finish — or hand off again if told to.

{{COMMIT}}
