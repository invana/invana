---
"studio": patch
---

Explorer: walk prompt history with ↑/↓ in the composer.

Shell-style history — ↑ recalls the previous prompt and keeps going further back through the session's prompts; ↓ walks toward newer ones, and stepping past the newest restores the draft you were typing. Works in both the NL textarea and the QL editor; navigation only triggers from the first/last line, so ↑/↓ keep their normal cursor movement inside a multi-line query. Editing a recalled prompt drops back to a live draft, and switching sessions or sending resets the walk.
