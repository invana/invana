---
"invana": patch
---

Pausing an agent previews what it would disturb, item by item, the way retiring does (LC8 · LC10).

Pause was one click on the agent row and one in the footer, and it blocks the same todos a retire
blocks — the confirm was only on the act that happened to be permanent. It now opens the same dialog.

One shape serves both acts: `GET …/agents/{id}/pause` and `GET …/agents/{id}/retire` return a
`LifecyclePreview` — the agent's open work item by item, each carrying the effect **that** act would
have on it, from a closed vocabulary: a run in flight `finishes` (neither act kills one, and a run
already queued still starts, because pausing takes nothing *new*), an open todo is `blocked` with the
agent named, a todo in **review** is `unchanged` under a pause and `blocked` under a retire, and a
thread bound to the agent `refused` — its next ask names the state rather than being answered by
another mind. The todo in review is the one row the two acts disagree about, which is exactly what
two counts could never say.

`RetirePreview` is replaced by `LifecyclePreview`; the retire dialog reads the same list instead of a
bare count of open task titles and a session tally. Resume keeps its single click — it takes nothing
away.
