---
"invana": patch
---

Each version in a plan's **Versions** band says what changed against the one before it —
`+await_reply · execute_graph_query changed`, or `the first version` — beside how it has fared.
`GET …/task-plans/{key}/diff?version=` returns the whole diff: steps added, removed, moved and
changed field by field, and the arguments the plan declares.
