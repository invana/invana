---
"invana": minor
---

A step records the skill **version** it was offered (skills-pass.md K2 · SK3 · US3).

`task_runs.skills_offered` and `.skills_applied` held bare skill ids, so *offered 40, applied
31* was a claim about every text the skill has ever had. Rewrite the prose and the count
carried on as though nothing changed — two different skills wearing one name.

Both columns now hold `skill_version_id`, and every historical entry is migrated to name the
v1 minted in the previous revision. An id that resolves to nothing — a skill hard-deleted
before this ran — is left exactly as it is: there is no version to point at, and inventing one
would be worse than a record that is honest about what it lost.

`GET …/skills/{id}/usage` answers per version:

```json
{
  "skill_id": "…",
  "current_version_id": "…",
  "versions": [
    {"version": 2, "offered": 12, "applied": 3, "gap": 9},
    {"version": 1, "offered": 40, "applied": 31, "gap": 9}
  ],
  "recent_steps": [{"skill_version_id": "…", "version": 2, "reported": false, "…": "…"}]
}
```

Publishing starts a fresh count and leaves the old one standing; nothing is summed across
versions. Each step row says which text it actually read, so a trace opened from the gap shows
the prose that was in that prompt rather than the prose that is there now.

**The counts are SQL over the whole Graph**, not over the recent window the step list pages
through. They were never computed at all before this: `GET …/skills/{id}/usage` called a
queryset method that does not exist and raised `AttributeError` on every request. That is
fixed here — the route works, and what it returns is counted rather than sampled.

Application stays self-reported, and the shape says so: `offered` is a fact written by prompt
assembly, `applied` is the model's own claim, and the gap between them is the number worth
reading.
