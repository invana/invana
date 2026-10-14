---
"invana": minor
---

A skill publishes only the plan drawn from the words it publishes.

- A draw records the digest of the text it read (`skill_versions.drawn_digest`). `POST …/skills/{id}/versions` is refused with 409 when the draft's text has changed since — draw again, then publish.
- A draft opened over a published version carries that version's plan, so a pin-only or why-only publish needs no draw. A rollback is drawn by the same rule.
- `PATCH …/skills/{id}` with new prose writes the draft and publishes nothing. A rename still applies at once.
- The draft read says `drawn`: whether the plan was drawn from the draft's text as it reads now.
