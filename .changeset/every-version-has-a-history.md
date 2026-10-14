---
"invana": minor
---

The change log: every version of a skill, rule, plan, agent or model, with who made it, why, what changed and what ran on it after.

- `GET …/events?changes=true` narrows the Graph's events to the writes that mint a version.
- `GET …/history/{record_kind}/{record_id}` lists a record's versions, newest first. Each carries the author, the why, a one-line summary against the version before it, and the effect after: runs, failed runs and tokens.
- `GET …/history/{record_kind}/{record_id}/compare?a=&b=` compares any two versions in one shape: field changes with unified lines, the plan diff, or a model's schema diff.
- Publishing a skill, rewording a rule, editing an agent and promoting a plan each accept an optional `why`. An agent edit now records each changed field's before and after.
