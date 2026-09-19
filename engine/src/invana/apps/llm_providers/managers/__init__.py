"""LLM provider rules, as classes (migration-plan §6)."""

from invana.apps.llm_providers.managers.provider import LLMProviderManager, MalformedCredentialError

__all__ = ["LLMProviderManager", "MalformedCredentialError"]
