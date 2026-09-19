"""Per-provider call bodies for the LLM runtime.

Each module exposes one ``async def call(...) -> tuple[dict | None, TokenUsage]``
with the same keyword signature, lazy-importing its SDK/HTTP so the engine does
not hard-depend on every provider at install time (mirrors
``llm_providers/services.py::_ping_*`` one level deeper).
"""

from __future__ import annotations
