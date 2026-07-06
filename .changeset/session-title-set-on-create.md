---
"studio": patch
---

Fix blank session titles when navigating away mid-send.

A session's title was only derived from its first message when the send-message
request finished processing. Because Studio creates the session in a separate,
already-committed call (with an empty title) and then sends the first message,
navigating away before the send completed left the session with a permanently
blank title in the Sessions rail.

Studio now seeds the title from the first message at session-create time (capped
to match the engine's 64-char rule), so it's persisted atomically with the
session and survives an abort. The Sessions panel list and thread header also
fall back to "New session" for any already-blank titles, matching the Canvases
panel's "Untitled canvas" pattern.
