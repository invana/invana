"""Thoughts, thinkings and the inline runtime (RFC-048 / RFC-055, S9b).

A session ask is recorded as a **Thought**; answering it opens a **Thinking**
that runs a workflow (``understand → validate → execute → project``) step by
step, writing one ``thinking_steps`` row per attempt and appending every
user-facing event to the append-only ``thought_stream`` that Studio tails over
SSE. The runtime is in-process (an ``asyncio`` task per thinking); the
broadcaster interface is the seam for an out-of-process executor later.
"""
