---
"invana": patch
---

Small talk is conversed with, never refused (NL12). *How are you*, *thanks* and *what can you do?* get one or two lines in the agent's voice that point at something this graph could answer, instead of *cannot answer · outside this graph*.

Understand has a fourth outcome, `converse`. It runs no plan and no query, writes no emission and cites nothing. The reply is the assistant message itself, drawn under the Understand step as `small talk`. The run succeeds with outcome `conversed` — neither *answered* nor *cannot answer* (CA8). A converse with no reply is a model error, never an empty message (NL13).
