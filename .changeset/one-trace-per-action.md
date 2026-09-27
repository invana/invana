---
"invana": patch
---

Studio traces each action from the click to its outcome.

- Asking the assistant is one trace, `ui.assistant.ask`, from the click to the run's terminal
  frame — the POST, the session it creates and the run's stream all sit inside it. Re-running a
  reply, loading a result to the canvas, stopping a run and promoting a plan are traced the same way.
- Every API call is a span: a child of the action it was made for, or a root of its own.
- Streams join their action's trace: Studio puts `traceparent` in the `EventSource` URL, and the
  engine reads it there when the header is absent.
- Studio has unit tests: `pnpm test` runs Vitest.
