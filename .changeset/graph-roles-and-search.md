---
"invana": minor
---

Graph roles, enforced on every Graph route, and a search filtered by access.

- A member of a Graph now holds Graph roles: `viewer` (ask and read) · `contributor` (projects, tasks) · `builder` (agents, skills, evals) · `modeller` (models, rules, guardrails) · `owner` (members and settings). `owner` implies the rest; every member reads everything.
- Every write to a Graph checks the role its area needs. A refusal is `403` with `error: "role_required"`, the area, the role and the usernames that hold it.
- `GET · POST …/members` and `PATCH · DELETE …/members/{member}` list, add, re-role and remove members. A Graph always has an owner: removing or demoting the last one is refused.
- `GET …/access` says which areas the caller may change and who to ask for the rest; `/auth/me` lists the caller's roles on each Graph.
- Editing a guardrail is the `modeller` role; the separate guardrail permission is gone.
- Existing Graphs keep their access: the creator becomes `owner`, every other member `contributor · builder · modeller`.
- `GET /api/v1/search?q=` matches names across every Graph you are in — Graphs, models, agents, skills, projects, worlds, guardrails — and the datasets you may read; exact, then prefix, then contains. `graph=<user>/<slug>` narrows to one.
- `invana members list · add · set-roles · remove` and `invana search` do the same from a terminal.
