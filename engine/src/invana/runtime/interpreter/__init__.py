"""The interpreter — what happens next
(docs/for-developers/modules/platform/features/runtime.md §2).

The cursor, the control signals, suspend and resume. `TaskRuntime` is the
loop: it claims a slot, lands a plan, walks it step by step, and settles the
reply — or the failure, the question, or the cancellation.

It is **one class on purpose.** Splitting it across modules would need mixins,
which is a restructuring, not a move. What actually shrinks it is
[§21 step 4](../../../../../docs/for-developers/modules/platform/features/runtime.md):
`_loop` returning and honouring one signals enum instead of seven exception
types. That is a behaviour change and is deliberately not in this pass.
"""

from __future__ import annotations

from invana.runtime.interpreter.loop import TaskRuntime
from invana.runtime.interpreter.payloads import message_payload

__all__ = ["TaskRuntime", "message_payload"]
