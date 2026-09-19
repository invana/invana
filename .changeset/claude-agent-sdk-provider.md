---
"invana": minor
"studio": minor
---

New LLM provider kind: **Claude Agent SDK** (docs/for-developers/modules/agents/features/providers-and-models.md).

Point a graph at Claude through Anthropic's `claude-agent-sdk`, which drives the locally installed Claude Code CLI. The API key is optional: set one and it is used; leave it blank and the CLI's own login is used. The engine runs the SDK as a generation-only harness (no tools, no filesystem settings) with JSON-schema structured output, so every existing consumer (NL translation, modeller proposals) works unchanged. Requires `pip install claude-agent-sdk` and the Claude Code CLI on PATH; the package is optional, like `anthropic` and `openai`.

Studio's Settings → LLMs form offers the new provider with an optional API-key field and no Base URL.
