---
"studio": patch
---

Explorer: default new sessions to Natural Language mode, and submit on Enter.

The session composer now opens in NL mode instead of Query Language, so asking a question is the first-class path. Reopening an existing session still restores its last-used mode (RFC-030), and the NL/QL toggle is unchanged.

Pressing Enter now submits the query in both the NL prompt box and the QL editor; Shift+Enter inserts a newline. (Previously NL submitted on Cmd/Ctrl+Enter and Enter inserted a newline.)
