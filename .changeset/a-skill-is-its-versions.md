---
"invana": minor
---

A skill is its versions (skills-pass.md K1 · SK2 · SK3 · SK19).

`skills` was flat: one row carried the name **and** the prose, and editing it overwrote the
text every past step had been offered. A trace is supposed to say what a step was given, not
what the skill says today — which is impossible against a row that changes underneath it.

The text moves. `skills` keeps `graph_id · name · current_version_id`; every word a person
wrote lives on an immutable `skill_versions` row:

```
GET    …/skills/{id}/versions              the published history, newest first
POST   …/skills/{id}/versions              publish the next version
GET    …/skills/{id}/versions/{version}    one version by number
```

**Editing is publishing.** A `PATCH` that changes `description`, `content` or `when_to_use`
mints `version + 1` and repoints the head; the previous version is untouched and still
resolves. A rename is not a publish — the name is the skill's identity, and no step was ever
offered it. Resending prose that has not changed is not a publish either: a new version
starts its own usage count, and an unchanged save must not reset one.

Publishing carries over what it does not send, so a one-line change to `when_to_use` does not
require resending the body.

`SkillRead` is unchanged for existing callers — `description`, `content` and `when_to_use`
read through the current version — and gains `version` and `current_version_id`, which is
what a caller needs to say *which* text it got.

**Existing skills become their own v1**, published at the skill's `created_at`, with no
author: nobody published them, and inventing one from the Graph's owner would be a fact the
migration does not have. `task_runs.skills_offered` and `.skills_applied` still hold bare
skill ids and are rewritten to name the version in the next slice, alongside the writers that
produce them — a column that holds version ids the running code does not yet write would be
worse than one that is honestly behind.
