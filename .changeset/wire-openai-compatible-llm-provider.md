---
"invana": minor
---

Wire the `openai` and `local` LLM provider kinds for generation. `openai` uses
the official `openai` SDK; `local` reuses the same OpenAI-compatible call body
with a configured `base_url`, so any OpenAI-compatible server — LM Studio,
vLLM, LocalAI — can now back sessions, NL translation, and modeller proposals.
Structured output uses `response_format` with a JSON Schema (the
OpenAI-compatible analogue of Ollama's `format`). No API key is required for
keyless local servers. Previously these kinds saved fine but raised "not wired
for generation yet" at run time; only `anthropic` and `ollama` worked.
