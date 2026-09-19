"""LLM providers (graph-scoped) — MVP § 2.6.

Per-Graph LLM bindings: provider, model_id, Fernet-encrypted api_key,
optional base_url, guardrails JSON, and a default-flag. CRUD + ping live at
``/api/v1/u/{username}/{graphSlug}/llm/...``.
"""
