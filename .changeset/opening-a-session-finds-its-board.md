---
"invana": patch
---

Reloading an Explorer session reopens its board instead of failing (boards.md CV17).

On a reload the session in the path was opened before the boards list had loaded, so Studio took
the session for one with no board and tried to create a second — which the engine refuses with a
`409`, leaving an empty canvas and a *"Failed to load this session's canvas"* toast. The same
happened for any session whose board sat past the first 100 in the list.

`GET …/boards` now takes `session_id`, and opening a session asks for that session's board
before creating one.
