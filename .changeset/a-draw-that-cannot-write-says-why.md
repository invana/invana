---
"invana": patch
---

A draw that cannot write the plan says why, and the draft can tell a correction from a plan nobody has touched (SK29 · SK30 · SK31).

The first real run of **Draw this** found four things, all on the same path — the author presses
it, and what comes back is either nothing or the wrong story.

A playbook that says *read it, then run it* draws two steps the agent is allowed to run and
still does not hold together: `execute_graph_query` requires `validate_query`, which the
catalogue declares and the prose never named. That refusal used to **fail** the run, with a
message blaming the agent's envelope — grounds it had not checked — and the reasons went into a
failure payload no surface reads, leaving the draft silently undrawn. It now **settles** with its
reasons, exactly as a question does, and the draft serves them back: the step, and what it wanted.
The plan that was there is untouched, and the next draw that writes rows clears the refusal.

The plan a draft is born with — one *a person does this* node — was `authored`, so `authored`
meant both *somebody corrected this* and *nothing has drawn this yet*. The action read **Redraw**
before anything had been drawn and warned that it would discard a step nobody wrote. It is born
`generated`; only a hand-edit flips it, which is what the warning has always claimed.

Answering a question left the author on a dead end: the answer was recorded and the flow stayed
empty until they pressed the button again. The next draw now opens on the answer — unless the plan
has been hand-edited, where it stays an offer.

`GET …/skills/{id}/draft` also fills `drawing_run_id`, which was declared and never set, so a
reload during a draw lands back in *Drawing…* instead of on a button inviting a second one.
