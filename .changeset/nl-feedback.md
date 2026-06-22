---
"invana": minor
"studio": minor
---

Explorer: 👍/👎 feedback on NL replies, with downvote-triggered refinement.

Each natural-language answer now has thumbs-up / thumbs-down controls in its action row. A downvote also kicks off a refinement — it sends a follow-up that asks what to change (with options), re-translating with that reply now in conversation context — so "not quite right" turns into a guided fix instead of a dead end. Votes persist (a new nullable `feedback` column on `session_messages`) and are the capture signal for the future learning loop (RFC-038/039). Clicking the active vote clears it.
