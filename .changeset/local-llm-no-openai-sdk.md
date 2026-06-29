---
"invana": patch
---

Local OpenAI-compatible LLM providers no longer require the `openai` package.

The generation path (NL→query, modeller proposals) for the `openai`/`local`
provider kinds now calls `/chat/completions` directly over `httpx` — the same
transport the Ollama provider uses — instead of the `openai` SDK. A `local`
provider (LM Studio, vLLM, LocalAI, …) works with no extra install, matching the
ping/test path, which already probed `local` over plain HTTP. The `openai`
(and `anthropic`) SDKs stay fully optional: they're only needed when you
actually configure and test a first-party OpenAI/Anthropic provider.

Also declares `httpx` as a core engine dependency (it was only in the
`telemetry`/`dev` extras, but the LLM providers import it at module load, so the
engine couldn't import without it).
