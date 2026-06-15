"""Advisory default model per provider.

``LLMProvider.model_id`` is required (non-null) so the configured value almost
always wins; these are the fallback used only if a row's ``model_id`` is blank,
and the values the dev/test setup recommends. ``qwen3-coder:30b`` is the pinned
keyless dev model (local Ollama); ``claude-opus-4-8`` is the production default.
"""

from __future__ import annotations

from invana.llm_providers.models import LLMProviderKind

DEFAULT_MODEL_ID: dict[LLMProviderKind, str] = {
    LLMProviderKind.anthropic: "claude-opus-4-8",
    LLMProviderKind.ollama: "qwen3-coder:30b",
}
