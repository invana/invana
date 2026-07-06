---
"studio": patch
---

Create a session's canvas as soon as the session starts.

When a query started a brand-new session, its canvas (tab + record) was only
created after the first query returned — so the canvas area sat on a blank
"Untitled canvas" while the query ran. Studio now opens the canvas the instant
the session is created, named after the session, and paints the result onto it
once it lands. Canvas creation is idempotent per session, so the two triggers
(session created, result returned) still produce exactly one canvas.
