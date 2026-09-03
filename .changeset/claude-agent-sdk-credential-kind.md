---
"invana": minor
"studio": minor
---

Claude Agent SDK provider: per-row credential kind (RFC-056).

An `llm_providers` row of kind `claude_agent_sdk` can now store either a Claude API key or a `claude setup-token` subscription token — Studio's Settings → LLMs form gets a "Credential type" selector for this provider that switches the field between the two. Each row's credential is injected into its own subprocess call as `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` respectively, so multiple `claude_agent_sdk` providers (across graphs, or on the same graph) can each authenticate as a different Claude account — no shared, process-wide credential. Existing rows are unaffected (credential_kind defaults to the original API-key behavior).
