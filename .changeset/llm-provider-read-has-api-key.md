---
"invana": patch
---

Fix: saving an LLM provider returned 500 instead of the provider.

`LLMProviderRead` declares `has_api_key` — the boolean that stands in for the ciphertext,
which never leaves the engine — but `LLMProvider` had no such attribute, so every
`model_validate(provider)` raised `ValidationError: has_api_key Field required`. Create, get,
list, update and set-default all 500'd; the Studio LLMs panel could not save a provider.

The model now derives it from `api_key_encrypted`, the one place that knows whether a
credential is stored — the same expression the audit event already recorded.
