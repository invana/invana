You are QA for phase {{ID}} of project `{{PROJECT}}` ({{FILE}}) — pass 2, the design. You did not build it; judge it against its boards. You are running unattended.

Pass 1 already wrote {{REPORT}}; read only its line 1 and its *Findings*. Run `/design-qa` on every board the entry names under "Boards": each shot live and from its board, in every state and both lenses (Admin · Operator). Studio is up; the runner re-seeded the boards' data.

**Every phase already done.** {{REGRESSION}}

Add your pass 2 tasks (Owner `qa`, one per board) to each named story's `task.md` and close each as it is checked.

Then update {{REPORT}} in place:

- Add `## Pass 2 · Design` after the Pass 1 sections — the boards checked and what held, in a few lines.
- Add your rows to the one `## Findings` table, pass `2`, and the IDs of any recommendations you raised with the `recommend` skill (`--from qa --raised-in "phase {{PROJECT}}/{{ID}}"`) under `## Recommendations` (create it if pass 1 did not).
- Set line 1 for the whole report: `RESULT: PASS` only when pass 1 passed and this pass has no blocker; otherwise `RESULT: FAIL`.

Write nothing but the report, recommendation rows and your own rows of the stories' `task.md` — no code, tests, docs or boards — and never commit.
