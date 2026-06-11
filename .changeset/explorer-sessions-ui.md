---
"studio": minor
---

Explorer: replace the Query Console with a Sessions UI.

The left panel is now "Sessions" (message icon). It opens to a list of past sessions — each a threaded ask/answer against the graph, with a status dot, node/relationship counts, and relative time. Asking a question (or clicking a session) drops into the session detail: user prompts on the right, assistant replies on the left with re-run/copy actions and result metadata. The query box is restyled as a chat-style composer pinned to the footer, keeping every capability of the old console (NL/QL toggle, CodeMirror query editor, attachments). This is a frontend-only redesign; the engine still speaks the single-shot `/query` endpoint and backend naming lands later.

The Sessions panel header gains a refresh control (refetches the list, plus the open thread, with a spinning indicator) and a collapse control that hides the panel to give the canvas full width — reopen it from the Explorer icon in the left rail. Panel hover/selection highlights also no longer flash full-saturation brand green: the `accent` design token is overridden to a translucent wash so ghost buttons, list rows, and menu selections read as a quiet modern highlight.
