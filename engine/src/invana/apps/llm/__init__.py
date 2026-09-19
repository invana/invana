"""LLM runtime — the provider-agnostic client every LLM feature calls
(docs/for-developers/modules/agents/features/providers-and-models.md).

Distinct from ``invana.apps.llm_providers`` (config/CRUD): this package is the
*runtime* that uses that config to generate. Dev/test with no API key runs
against local Ollama; production uses an Anthropic API key. A machine with the
Claude Code CLI installed and logged in can also use the ``claude_agent_sdk``
kind with no key (docs/for-developers/modules/agents/features/providers-and-models.md).
"""

from __future__ import annotations

from invana.apps.llm.client import complete_tool
from invana.apps.llm.errors import LLMError, QueryNotReadOnlyError
from invana.apps.llm.schemas import TokenUsage, ToolResult

__all__ = ["LLMError", "QueryNotReadOnlyError", "TokenUsage", "ToolResult", "complete_tool"]
