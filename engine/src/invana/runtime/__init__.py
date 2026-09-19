"""Thoughts, runs and the inline runtime (docs/for-developers/modules/ask/spec.md ·
docs/for-developers/modules/ask/features/streaming-and-the-workflow.md, S9b).

A session ask is recorded as a **Thought**; answering it opens a **TaskRun**
that runs a workflow (``understand → validate → execute → project``) step by
step, writing one ``run_nodes`` row per attempt and appending every
user-facing event to the append-only ``task_stream`` that Studio tails over
SSE. The runtime is in-process (an ``asyncio`` task per run); the
broadcaster interface is the seam for an out-of-process executor later.
"""
