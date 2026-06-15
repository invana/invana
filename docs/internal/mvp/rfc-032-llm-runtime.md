# RFC-032: LLM runtime — provider-agnostic client + dev-without-keys

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-15
**Related**:
- **MVP § 2.6** (LLM providers, shipped S4) — `LLMProvider` already stores the per-graph **config**
  (provider kind, `model_id`, Fernet-encrypted `api_key`, `base_url`, `is_default`) and a credential
  `ping`. This RFC adds the **runtime** that *uses* that config to actually generate — the first real
  generation calls on the platform.
- **RFC-030** (LLM translation) and **RFC-031** (Modeller generative sessions) — the first two consumers.
  Both call this RFC's `complete_tool`; this RFC owns `invana/llm/client.py`, they own their intents.
- **MVP § 6.1 / 6.2** (agent loop · grounded LLM) — the later L6 consumers. This runtime is the shared
  substrate they will call too; building it once here avoids three ad-hoc SDK integrations.

---

## Problem / intent

Invana has LLM **configuration** (`llm_providers/`) but no LLM **runtime**. The only code that touches a
provider SDK is `llm_providers/services.py::_dispatch_ping` — a 1-token credential probe. Three features
now need to *actually call a model and get back a structured result*: Explorer NL→query (RFC-030),
Modeller model generation (RFC-031), and the L6 agent loop (§ 6.1/6.2). Without a shared runtime each
would grow its own SDK glue, its own structured-output handling, its own error mapping.

There is also a concrete, recurring operator question this RFC must answer head-on: **how do you develop
and test the LLM features without paying for / holding an API key?** Specifically — *can a Claude
Pro/Max (Claude Code) subscription be used?* The answer drives a real design decision (the default dev
provider), so it belongs in the RFC, not a wiki.

**Intent:** introduce `invana/llm/` — a small provider-agnostic client (`complete_tool`) that turns
*(provider config, system prompt, messages, a tool/output schema)* into a *validated structured object*,
dispatching to the right SDK/HTTP per `LLMProvider.provider`. Generalize the proven `_dispatch_ping`
pattern (lazy SDK import + `asyncio.to_thread`), and make **Ollama the documented keyless dev/test
path** so the whole feature line is buildable and CI-testable with zero paid API calls.

---

## Decisions

1. **New `invana/llm/` runtime module, owning the provider client.** `llm_providers/` stays *config*
   (CRUD, encryption, ping). `invana/llm/client.py` is the *runtime*: one `LLMClient.complete_tool(...)`
   that dispatches by `LLMProvider.provider`, lazy-imports the provider SDK/HTTP, decrypts the key **at
   call time only**, and runs blocking SDK calls in `asyncio.to_thread` — exactly the shape already
   proven by `_dispatch_ping`, which is refactored to call through this client (one lazy-import path).

2. **The credential answer — and the dev-without-keys path.** *(Decided.)*
   - **A Claude Pro/Max / Claude Code subscription is NOT usable as Invana's credential.** That
     subscription authenticates Anthropic's *first-party* tools (Claude Code, the Claude Agent SDK) over
     OAuth; it is not an API credential for a third-party server, and the `anthropic` SDK Invana uses
     expects an API key (`x-api-key`) or an API-scoped token. There is **no supported path** to point the
     runtime at a consumer subscription, and the runtime will not attempt one.
   - **Production:** an Anthropic **API key** (pay-as-you-go, console.anthropic.com — separate from any
     subscription), stored as the `anthropic` `LLMProvider.api_key` (already Fernet-encrypted).
   - **Local dev + CI + any no-key environment: Ollama** (and the generic `local`/OpenAI-compatible
     kind). `LLMProvider` already makes `api_key` nullable for `ollama`/`local` and carries `base_url`
     (default `http://localhost:11434`). **Ollama is the platform's documented default dev provider** —
     keyless, local, free.

3. **Structured output is capability-tiered, never prose-parsed.** `complete_tool` always returns a
   schema-validated object. How it forces that depends on the provider:
   - **Anthropic** — official `anthropic` SDK, a single tool + `tool_choice` forcing it (the tool input
     *is* the structured result). Default model `claude-opus-4-8`.
   - **OpenAI** — official `openai` SDK, tool-calling / `response_format` json_schema.
   - **Ollama / local** — native HTTP (`POST {base_url}/api/chat`) with Ollama's **`format` =
     `<JSON Schema>`** structured-output parameter (tool-capable models may use `tools` instead). No key.
   - **Google / Azure** — deferred to a `base_url`/SDK probe with their JSON modes; **not required for
     MVP** (Ollama + Anthropic cover dev + prod). Listed so the dispatch has a home, not built now.
   On a schema/parse failure the client does **one** corrective round-trip, then raises (no unbounded
   retries) — the shared mechanism RFC-030 §2/§3 and RFC-031 rely on.

4. **One normalized error, backend-owned message.** Provider/network/timeout/credential failures are
   caught per-provider and re-raised as a single `LLMError` carrying a user-facing message (consumers
   surface it verbatim — backend owns the toast copy). Config-level failures (no provider resolved)
   raise before any model call so nothing partial persists.

5. **Per-call timeout + bounded retries.** The Anthropic/OpenAI SDKs auto-retry 429/5xx with backoff;
   the Ollama/local HTTP path gets an explicit timeout (local models can be slow — generous default,
   configurable). Every call is wall-clock bounded so a wedged provider can't hang a request.

6. **Default models per provider, overridable by config.** The runtime ships a sensible default
   `model_id` per provider kind (Anthropic → `claude-opus-4-8`; Ollama → a tool/JSON-capable local
   model such as `qwen2.5-coder` / `llama3.1`) used only when a provider row leaves `model_id` unset;
   the configured `model_id` always wins. `LLMProvider.guardrails` (token budget, allowed model
   families) is honored where set.

7. **Tests run against a real local Ollama — no mocks, no paid APIs.** Per repo rule 7 (real services,
   not mocks) *and* to keep CI keyless, the runtime's tests target a real Ollama at
   `INVANA_TEST_OLLAMA_URL` (default `http://localhost:11434`) with a small pinned tool/JSON-capable
   model; if unreachable the LLM tests **skip** (clearly), they do not fail and do not silently mock.
   Anthropic/OpenAI paths are exercised only when a key is present in the environment (optional CI
   secret), never required for the suite to pass.

8. **This is a library, not a route.** `invana/llm/` exposes no HTTP and emits no events of its own —
   consumers own their routes and their events (`llm.translate`, `model.generate`, future agent events).
   Keeps the runtime a pure, testable seam.

---

## Design

### Module layout

```
src/invana/llm/
  __init__.py
  client.py    # LLMClient.complete_tool(provider, *, system, messages, tool_schema,
               #   tool_name, encryption_key, timeout_s) -> ToolResult{input: dict, usage: TokenUsage}
               #   dispatch by provider.provider; lazy SDK import; to_thread for blocking calls;
               #   one repair round-trip; raises LLMError on failure.
  providers/   # per-provider call bodies (anthropic.py, openai.py, ollama.py) — the lazy-imported
               #   SDK/HTTP glue, mirroring llm_providers/services.py::_ping_* one level deeper.
  errors.py    # LLMError (normalized, user-facing message)
  defaults.py  # DEFAULT_MODEL_ID per LLMProviderKind
  schemas.py   # ToolResult, TokenUsage
```

`translate.py` / `grounding.py` (RFC-030) and the `propose_model` intent (RFC-031) live alongside but
are owned by those RFCs. `client.py` is the single place a provider SDK is touched at runtime.

### Core interface

```python
async def complete_tool(
    session,                       # for nothing DB-side; kept symmetric with other services
    *,
    provider: LLMProvider,         # resolved config (kind, model_id, key, base_url, guardrails)
    system: str,                   # grounded system prompt (assembled by the consumer)
    messages: list[dict],          # [{role, content}] — the user prompt (+ optional history)
    tool_schema: dict,             # JSON Schema for the forced tool / structured output
    tool_name: str,                # e.g. "submit_query" | "propose_model"
    encryption_key: str,           # Fernet key (settings.encryption_key) to decrypt api_key
    timeout_s: float = 60.0,
) -> ToolResult:                   # { input: dict (schema-valid), usage: {input_tokens, output_tokens} }
    ...
```

### Per-provider dispatch (the matrix)

| Provider | Transport | Structured output | Key? | Default model |
|---|---|---|---|---|
| `anthropic` | `anthropic` SDK (official) | tool + `tool_choice` forces it | **yes** (API key) | `claude-opus-4-8` |
| `openai` | `openai` SDK (official) | tool-calling / `response_format` json_schema | yes | (configured) |
| `ollama` | HTTP `POST {base_url}/api/chat` | `format: <JSON Schema>` (or `tools` on tool models) | **no** | `qwen2.5-coder` (tool/JSON-capable) |
| `local` | OpenAI-compatible HTTP at `base_url` | `response_format` / `format` json_schema | no | (configured) |
| `google` / `azure` | deferred (`base_url`/SDK probe) | provider JSON mode | varies | — (post-MVP) |

Each row is one lazy-imported function — the runtime never hard-depends on every SDK at install time
(matches the existing ping dispatch). Anthropic uses the official SDK per project convention; Ollama/local
use their native HTTP JSON-schema mode (not an Anthropic-shaped shim).

### Credentials & environments (operator guide, normative)

| Environment | Provider | What you set | Notes |
|---|---|---|---|
| **Local dev / CI / demos** | `ollama` | `base_url` (default `http://localhost:11434`), `model_id` | **No key.** `ollama pull <tool-capable model>`. The default everywhere a key is absent. |
| **Self-host / air-gapped** | `local` | `base_url` of an OpenAI-compatible server | No Anthropic dependency. |
| **Production** | `anthropic` | `api_key` (Fernet-encrypted), `model_id=claude-opus-4-8` | API key from console.anthropic.com — **not** a Pro/Max subscription. |

**Explicitly unsupported:** using a Claude Pro/Max / Claude Code subscription as the credential — the
runtime has no code path for it and the config UI offers none (the `anthropic` provider takes an API key).

### Refactor: ping calls through the client

`llm_providers/services.py::_dispatch_ping` becomes a thin wrapper over `client`'s lazy-import layer, so
the credential probe and real generation share one SDK-resolution path (and one place to add a provider).

### Storage / migrations

**None.** This RFC adds no tables or columns — it consumes existing `LLMProvider` config. (Token-usage
columns on `session_messages` are introduced by RFC-030, not here.)

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Reverse-engineer the Claude Code/Pro subscription OAuth to avoid an API key** | "free" inference for the user | Unsupported, brittle, tied to first-party tooling, outside subscription terms; tokens short-lived, not for an always-on server | **Rejected** (Decision 2) — no supported third-party path; use an API key (prod) or Ollama (dev). |
| **Require an Anthropic API key to develop at all** | one provider to support first | Blocks contributors without a key; burns paid calls in CI; violates the keyless-dev goal | Rejected — Ollama is the keyless default (Decision 2); CI stays free (Decision 7). |
| **Per-consumer SDK glue (RFC-030 and RFC-031 each call SDKs directly)** | nothing shared to build | Three structured-output impls, three error maps, three retry policies to keep in sync | Rejected — one `complete_tool` (Decision 1). |
| **Return free text and parse a JSON block** | no tool-use dependency | brittle; no schema guarantee; varies by model | Rejected — schema-validated tool/JSON-mode output (Decision 3). |
| **An OpenAI-compatible shim for every provider incl. Anthropic** | one code path | loses Anthropic-native features; not the project convention (official SDK) | Rejected — official `anthropic` SDK for Anthropic; native HTTP for Ollama/local (Decision 3). |

---

## Security Considerations

- **Key handling**: `api_key_encrypted` is decrypted via the existing Fernet path **only at call time**,
  in-process, and never logged or returned. `LLMError` messages and any debug logging carry provider +
  `model_id`, never the key.
- **No subscription credential**: by refusing the Pro/Max path (Decision 2) the runtime never holds or
  forwards a consumer OAuth token — there is nothing new to leak.
- **`base_url` trust**: `ollama`/`local` `base_url` is operator-supplied config; the runtime performs no
  SSRF-style fetch beyond the configured endpoint. (Same trust model as the existing ping HTTP probe.)
- **Egress**: with `anthropic`/`openai`, the consumer's assembled prompt leaves to that provider — the
  consumers (RFC-030/031) define *what* is sent (schema/grounding, not graph rows). With `ollama`/`local`
  nothing leaves the operator's network — a deliberate benefit of the keyless default for sensitive data.
- **Cost/abuse**: one model call + at most one repair per `complete_tool` (Decision 3) bounds spend per
  request; per-graph rate limiting is a future concern, noted out of scope.

## Performance Considerations

- Blocking SDK calls run in `asyncio.to_thread` (Decision 1) so the event loop isn't stalled — same as
  the shipped ping path.
- Every call is wall-clock bounded (Decision 5); local Ollama models are slower than hosted APIs, hence
  a generous default timeout for `ollama`/`local`.
- The runtime holds no state and no connection pool of its own beyond what each SDK manages; provider
  clients are constructed per call (cheap relative to inference latency), matching the ping pattern.

## Open Questions

- [ ] **Default dev model pin** — which exact tool/JSON-capable Ollama model to recommend + pin in CI
  (`qwen2.5-coder` vs `llama3.1` vs `mistral-nemo`) for the best structured-output reliability on modest
  hardware. Resolve during S-impl by trying the RFC-030 `submit_query` schema against each.
- [ ] **Streaming** — `complete_tool` is request/response (sync), matching RFC-024/030/031. A streaming
  variant (`complete_stream`) for the L6 agent loop is deferred to that RFC.
- [ ] **Google/Azure** — wire their JSON modes when a consumer needs them; no-op until then.

## Implementation Plan

1. [ ] Add `invana/llm/` — `client.py` (`complete_tool` + dispatch), `providers/{anthropic,openai,ollama}.py`,
       `errors.py`, `defaults.py`, `schemas.py`.
2. [ ] Refactor `llm_providers/services.py::_dispatch_ping` to call the shared lazy-import layer.
3. [ ] Default-model table + `guardrails` honoring; per-call timeout + `LLMError` normalization.
4. [ ] Docs: a CONTRIBUTING / dev-setup note — *"LLM features: run Ollama locally (no key); set an
       Anthropic API key for production; a Claude Pro/Max subscription cannot be used."* + the
       `ollama pull` model recommendation.
5. [ ] Tests (repo rule 7 — real services, no mocks): against a real local Ollama, `complete_tool`
       returns a schema-valid object for a representative `submit_query`-shaped schema; a deliberately
       impossible schema triggers the single repair then a clean `LLMError`; LLM tests **skip** (not
       fail) when `INVANA_TEST_OLLAMA_URL` is unreachable; the Anthropic path runs only when a key is in
       the env.
6. [ ] Changeset (dev-facing: LLM runtime + keyless Ollama dev path) — `mvp.md § 6.0` scope line is in
       place; RFC-030/031 depend on this landing first.

## Scope & MVP impact

The runtime is **net-new but foundational** — it is the dependency under § 5.7 (RFC-030), § 4.1b
(RFC-031), and the later § 6.1/6.2 agent work. **The scope line is in place** — **`mvp.md` § 6.0 — LLM
runtime (provider client)** carries the triplet and names the keyless-Ollama dev path + the
no-subscription rule. Sequenced **first** in the LLM line (RFC-030 → RFC-031 build on it). The agent
loop and grounded multi-step generation remain in L6/S9 and are out of scope here.

## References

- `engine/src/invana/llm_providers/services.py` — `_dispatch_ping` / `_ping_*` (the pattern this RFC
  generalizes) and `LLMProviderKind` (anthropic / openai / google / azure / ollama / local).
- `engine/src/invana/llm_providers/models.py` — `LLMProvider` (nullable `api_key` for ollama/local +
  `base_url`), the config this runtime consumes.
- `engine/src/invana/graphs/encryption.py` — Fernet decrypt used at call time.
- `docs/internal/mvp/rfc-030-llm-translation.md` / `rfc-031-modeller-generative-sessions.md` — the first
  two consumers.
