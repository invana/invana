---
"studio": patch
---

A clarified ask reads as one run, not two.

When a turn pauses to ask something and then resumes, the engine keeps one thinking across two replies — the question and the answered run — and records each step under the reply it ran in. Studio's live view is keyed by thinking, so while the run was still streaming it handed the *whole* step list to both replies: the same `Understand → Validate → Execute → Project` appeared under the question and under the answer, as if the user had asked twice.

Each reply now shows only the attempts that ran under it (matching what a reload already showed), the resumed reply is marked `↳ continued after your answer`, and the pinned live strip shows one row per run instead of one per reply.
