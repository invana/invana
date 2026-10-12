---
"invana": minor
"studio": minor
---

Roll a skill back, and plans that ship with Invana are `packaged`.

- `POST …/skills/{id}/rollback` `{version, why}` restores an earlier version as the next one: its text and a copy of its plan. Nothing is rewritten. The new version records `restored_from_version`, and its publish event carries `restored_from`. The route is refused while a draft is open, and for the version that is already current.
- A plan that ships with Invana or a plugin pack now has `origin = packaged`. Existing `builtin` plans are renamed on migrate. The Library's plan count and badges read *packaged*.
- Copying a skill's plan into a draft now carries every step field, including `when`, `map_over`, retries, pools and the composed-from source.
