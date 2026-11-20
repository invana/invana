# CP-38 · Tasks

What the designer, the coder and QA do to deliver [CP-38](story.md). The story governs; each role adds and edits only
its own rows (`.claude/skills/product-spec/format.md` › *Tasks*).

| ID | Owner | Title | Description | Story | Criteria | Boards | Depends on | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CP-38-T1 | designer | Set read + write through Sign in again, and back to read-only | Detail · Read-only → Sign in again · Set read + write → Detail · Read + write, Wrong password and Could not change mode; Set read-only → Detail · Read-only; `flow.set_database_mode` reframed. Both lenses (platform-design-3 P04b) | [CP-38](story.md) | CP-38.1–CP-38.10 | settings.databases · access.signin · flow.set_database_mode | — | done | canvas page Large modal · Settings › settings.databases, Sign-in & Home › access.signin and Flows › flow.set_database_mode, v57 (platform-design-3 P04b); `run.mjs --through P04b` 112/112 |
