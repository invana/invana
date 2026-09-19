---
"invana": minor
"studio": minor
---

Every reply now shows the tasks that produced it, live (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).

Sending a question no longer waits for the answer: the engine records the ask
and opens a *thinking* — a run of the workflow behind the reply (Understand →
Validate → Execute → Project, or Understand → Propose → Validate in the
Modeller) — and streams each step's start, progress, retry and finish to
Studio over SSE. In the session, the reply shows its plan the moment you send,
the step rows move as the run advances, the model's reasoning appears under
Understand, the proposed query is viewable before it runs, and a running step
is pinned above the composer. When the reply settles the list folds to
`✻ Thought for 2.4s · 4 of 4 steps` and stays reopenable; each step opens its
trace (inputs, outputs, attempt, tokens). A clarifying question pauses the
same run and resumes when you answer; `esc` or the stop button cancels it;
a failed step explains its cause with suggested next steps; the status bar's
Tasks view lists every step of every reply, newest first.

Engine: new `thoughts`, `thinkings`, `thinking_steps` and `thought_stream`
tables (migration 28), `thinking_id` on session messages, a `stopped` reply
status, `POST …/messages` and `…/run` now return 202 with a `thinking_id` and
`stream_url`, and new `GET /thinkings/{id}`, `GET /thinkings/{id}/stream`,
`POST /thinkings/{id}/resume` and `POST /thinkings/{id}/cancel` routes. Run
`invana migrate` (or `invana start`, which migrates) before using this build.
