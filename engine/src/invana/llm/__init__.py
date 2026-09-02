"""LLM runtime — the provider-agnostic client every LLM feature calls (RFC-032).

Distinct from ``invana.llm_providers`` (config/CRUD): this package is the
*runtime* that uses that config to generate. Dev/test with no API key runs
against local Ollama; production uses an Anthropic API key. A machine with the
Claude Code CLI installed and logged in can also use the ``claude_agent_sdk``
kind with no key (RFC-053).
"""

from __future__ import annotations

from invana.llm.client import complete_tool
from invana.llm.errors import LLMError
from invana.llm.schemas import TokenUsage, ToolResult

__all__ = ["LLMError", "TokenUsage", "ToolResult", "complete_tool"]
