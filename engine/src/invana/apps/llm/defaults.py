"""Advisory default model per provider.

``LLMModel.model_id`` is required (non-null) so the configured value almost
always wins; these are the fallback used only if a row's ``model_id`` is blank,
and the values a Graph is offered when it configures a provider of that kind. ``qwen3-coder:30b`` is the pinned
keyless dev model (local Ollama); ``claude-opus-4-8`` is the production default;
``claude-opus-5`` is the Claude Agent SDK default (docs/for-developers/modules/agents/features/providers-and-models.md).
"""

from __future__ import annotations

from invana.apps.llm_providers.models import LLMProviderKind

DEFAULT_MODEL_ID: dict[LLMProviderKind, str] = {
    LLMProviderKind.anthropic: "claude-opus-4-8",
    LLMProviderKind.ollama: "qwen3-coder:30b",
    LLMProviderKind.claude_agent_sdk: "claude-opus-5",
}
