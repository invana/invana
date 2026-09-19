---
"studio": patch
---

Sessions panel rebuilt on the design-kit `ChatSession` components (docs/for-developers/modules/platform/features/design-system.md).

The open session now reads as a console transcript: your prompts are caret-
prefixed rows, each reply is an activity row whose gutter dot carries the
outcome (answer, clarifying question, stopped, failed), a running query shows a
progress line with a live elapsed counter, and "View query" / "View context"
open as collapsible disclosures under the reply. The composer is the
design-kit composer for natural language (with a matching card around the
query-language editor), a status line under it shows what the session holds
and the key bindings, and the query editor follows the active theme instead of
a fixed dark palette. No behaviour was removed: re-run, copy, context, votes,
clarification options, results, prompt history, attachments, pin/archive and
the modeller Commit bar all carry over.
