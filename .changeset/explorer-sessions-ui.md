---
"studio": minor
---

Explorer: replace the Query Console with a Sessions UI.

The left panel is now "Sessions" (message icon). It opens to a list of past sessions — each a threaded ask/answer against the graph, with a status dot, node/relationship counts, and relative time. Asking a question (or clicking a session) drops into the session detail: user prompts on the right, assistant replies on the left with re-run/copy actions and result metadata. The query box is restyled as a chat-style composer pinned to the footer, keeping every capability of the old console (NL/QL toggle, CodeMirror query editor, attachments). This is a frontend-only redesign; the engine still speaks the single-shot `/query` endpoint and backend naming lands later.
