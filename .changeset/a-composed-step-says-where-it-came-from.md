---
"invana": patch
---

The Flow tab says what a skill composed, and whether the library has moved on (SK34).

`tasks.source_plan_key` has been on the wire since a skill could inline a library plan, and the
**Flow** tab ignored it: five steps from `nl-single@2` drew as five unrelated ones. They are now
**marked where they sit** — a dashed chip in the band each belongs to, because clustering them into
one place would undo the drawing the layer strip exists to make — and a **Composed** block under the
strip names each plan once: how many rows it wrote, and what this skill tuned it to
(`read_only: no`, in the editor's own words rather than `false`).

The block is also where *a newer version exists* is said. `GET …/skills/{id}/plan` now returns each
composition's `latest_version` beside the version it inlined, so a skill that inlined `@2` while the
library has published `@3` says `v3 exists` — and stops there. Nothing re-inlines: the copy is what
makes a published skill do tomorrow what it did today, so swapping it is an edit somebody makes on
purpose.

**`Publish vN` was not publishing.** The Playbook tab's publish button called `PATCH …/draft`, which
writes the draft's prose and nothing else — so it saved the text, left `published_at` null, and the
skill stayed a draft. Nothing in Studio called `POST …/versions` at all, which means **no skill
written in Studio could ever be published**. The button now calls it.

Found by opening the Flow tab of a skill that inlines a plan.
