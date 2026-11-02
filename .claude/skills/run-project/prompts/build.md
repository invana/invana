Build phase {{ID}} of project `{{PROJECT}}` ({{FILE}}). You are running unattended; nobody will answer questions.

1. Read {{FILE}}: the header, "Rules for every session", the entry for {{ID}}, and the log row and hand-off notes of every phase {{ID}} needs. Read CLAUDE.md, `.claude/team/TEAM.md` and everything the entry lists under "Read".
2. For each story the entry names under "Stories": read its `story.md` — the source of truth — and its `task.md`. Add your role's tasks before your first act if they are not there, work the open ones, and mark each `done` with its evidence (`.claude/skills/product-spec/format.md` › *Tasks*). Edit only rows your role owns.
3. Do only this phase: what its "Done when" says, in the order of its "Steps". Write only what your role writes (`.claude/team/TEAM.md` §1 *Edit rights*: docs for the product-manager, code and every test for the coder) plus this phase's Log row and hand-off note. Anything else — outside the phase, or a file your role does not write — is raised with the `recommend` skill (`--raised-in "phase {{PROJECT}}/{{ID}}"`) — never fixed on the way.
4. Read `.claude/skills/run-project/prompts/team.md` and work as its lead: the contract alone first, then split surfaces across up to 2 sub-agents with no file in two parts, when the phase is big enough.
5. Run the gates the project lists for {{ID}} yourself before you finish — the runner re-runs them and does not trust your word.
6. A decision the docs settle: follow them. One they do not settle but CLAUDE.md and the specs support: pick it and record it where it governs if your role writes that file; otherwise follow it, make it a recommendation and name it in the hand-off note. One only Ravi can make: set {{ID}}'s log row to `blocked` with the question in its Notes, and stop.
7. When done, leave {{ID}}'s status as it is — the runner marks `done` after its own gates and QA — and add a hand-off note row for {{ID}}: what a later phase must know that the code does not say.

{{COMMIT}}
