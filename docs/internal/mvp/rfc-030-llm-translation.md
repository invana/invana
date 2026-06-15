# RFC-030: LLM translation service — natural-language → grounded query

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-15
**Related**:
- **RFC-032** (LLM runtime — provider client) — **owns `invana/llm/client.py`** (the provider-agnostic
  `complete_tool` call, structured-output strategy, and the credentials/dev-testing story). This RFC
  consumes that client and adds the `submit_query` translation intent on top. Where this document
  describes `client.py`, RFC-032 is the authority; the `translate.py` / `grounding.py` translation logic
  is owned here.
- **RFC-024** (Query Sessions) — wired NL to a `_NL_NOT_WIRED` placeholder and explicitly deferred real
  execution: *"NL stays unwired … Wiring NL → engine is a separate RFC"* (Decision 7). **This is that
  RFC.** The `mode: "nl"` branch of `send_message` is replaced; everything downstream (canvas paint,
  re-run, persistence) is unchanged.
- **MVP § 2.6** (LLM providers, shipped S4) — `LLMProvider` already stores per-graph encrypted keys +
  `is_default`. This RFC adds the first real *generation* call on top of that config; the only existing
  SDK use is the 1-token `ping`.
- **MVP § 6.2** (Grounded LLM call) — text-to-query is the first concrete instance of the platform's
  "explainability" pillar (LLM → query → record → dataset, traceable). This RFC pulls a thin slice of
  L6 forward (see *Scope & MVP impact*).
- **RFC-031** (Modeller generative sessions) — the second consumer of the translation core defined here;
  RFC-031 depends on this RFC and reuses its `invana/llm/` client.

---

## Problem / intent

The Explorer's Sessions panel already offers a **Natural Language** input mode with an LLM-provider
dropdown (`SessionComposer`), but the backend does nothing with it: a `mode: "nl"` message persists the
user prompt and an assistant message whose content is the literal *"Natural-language queries aren't
wired to the engine yet"* (`sessions/services.py` → `_NL_NOT_WIRED`). No query is generated, nothing is
executed, the canvas stays empty.

We have all the pieces except the connective tissue:

- **Credentials/config** — `LLMProvider` (encrypted key, `model_id`, `is_default`) per graph.
- **An execution primitive** — `execute_query(session, graph, manager, query, parameters)` runs any
  Cypher/Gremlin and returns the `QueryResponse` the canvas paints.
- **An ontology to ground against** — the active `GraphVersion` (node types, edge types, property keys)
  from the Modeller.

**Intent:** introduce a small **LLM runtime** (`invana/llm/`) that turns a natural-language prompt +
the graph's model into a *structured, validated* query, then runs it through the existing
`execute_query`. NL mode becomes **"translate, then run"** — the assistant reply carries the generated
query (always shown, for explainability) and the same `QueryResponse` a QL message produces. No new
routes, no new canvas path, no change to re-run.

This is deliberately the **foundation RFC**: it proves the translation core on the lowest-risk surface
(read-only queries, existing execution path) so RFC-031 can reuse it for the higher-surface Modeller
generation (model + data + commit).

---

## Decisions

1. **New `invana/llm/` runtime module, distinct from `invana/llm_providers/`.** `llm_providers/` stays
   the *config* home (CRUD, encryption, ping). The new `invana/llm/` is the *runtime*: `client.py` (a
   provider-agnostic call that dispatches by `LLMProvider.provider`, lazy-imports the SDK, decrypts the
   key) and `translate.py` (the NL→query intent). `client.py` generalizes the lazy-import/`to_thread`
   pattern already proven in `llm_providers/services.py::_dispatch_ping`.

2. **Structured output via forced tool-use — never prose parsing.** The model is given exactly one tool,
   `submit_query`, and `tool_choice` forces it. The tool's input schema is
   `{ query: str, language: "cypher"|"gremlin", read_only: bool, rationale: str }`. We read the
   validated tool input — we never regex a query out of free text. If the provider/model cannot tool-call
   (e.g. some local models), `client.py` falls back to a strict JSON-only system prompt + `json.loads`
   with the same schema validation. (Anthropic / OpenAI tool-calling is first-class; Ollama/local use
   the JSON fallback.)

3. **One repair round-trip, then fail.** If the tool input fails schema validation, or the generated
   query fails a cheap static parse (balanced clauses, recognised keywords for the target language), the
   translator sends one corrective turn ("that query was invalid because … return a corrected
   `submit_query`"). A second failure surfaces an error assistant message — no silent retries, no
   unbounded loops.

4. **Grounding from the active `GraphVersion` — the explainability contract.** The prompt is assembled
   from the graph's **active model version**: node types, edge types (with source/target node types),
   and property keys, rendered as a compact schema block. This forbids hallucinated labels — the model
   can only reference types that exist. The **target query language** comes from the connector's declared
   capability (Cypher vs Gremlin), not from the model's choice. If the graph has **no active model**,
   fall back to a one-shot live-introspection summary (`Introspector`) so an unmodelled-but-connected
   graph still works; if that is also empty, the translator returns an actionable error rather than
   guessing.

5. **NL mode = translate → run, reusing `execute_query`.** The `mode: "nl"` branch of `send_message`
   stops returning `_NL_NOT_WIRED`. Instead it: (a) resolves the provider, (b) calls
   `translate.nl_to_query(...)`, (c) stamps the **generated query** onto the assistant message's
   `source_query` and `via = "<provider> · <model_id>"`, (d) executes it via `execute_query`, (e)
   returns the `QueryResponse`. Everything downstream — canvas paint, denormalized counts, the per-message
   **re-run** button (which re-runs the *stored generated query*, not a re-translation) — is unchanged.
   Re-run is deterministic: it never calls the LLM again.

6. **Provider resolution: explicit → graph default → 422.** `SendMessage` gains an optional
   `llm_provider_id`. If absent, use the graph's `is_default` provider. If neither resolves, return
   `422` with a backend-owned, actionable message (*"No LLM provider configured for this graph — add one
   in Settings → LLMs."*) that the composer already prompts toward. Per the backend-owns-toast rule, the
   frontend displays the returned message verbatim.

7. **Read-only by construction, write-guard as backstop.** The Explorer system prompt instructs the model
   to emit **read-only** queries and the `submit_query` tool carries a `read_only` flag the translator
   asserts. The hard guarantee remains the existing `execute_query` write-rejection on read-only
   connections — translation never widens what a connection may do.

8. **The generated query is always surfaced.** The assistant message stores it in `source_query` and the
   `via` label names the model that produced it; Studio renders a "view query" disclosure under the NL
   reply. This is the traceability the product promises — every NL answer is one click from the exact
   query that produced it.

9. **Synchronous execution (translate + run in one response).** Matches RFC-024 Decision 9. The
   request holds open for translation + execution; an SSE-streamed model (token streaming, intermediate
   "thinking") is **deferred** to a later RFC, likely alongside the L6 agent loop that needs streaming
   for longer runs.

10. **Events + token usage.** `execute_query` still emits `query.execute`. The translator additionally
    emits a new `llm.translate` event (`action=LLM_TRANSLATE`, `target=session`) with
    `{ provider, model_id, generated_query, language, latency_ms, input_tokens, output_tokens }` — the
    durable record of the NL→query mapping for audit/explainability. Token counts are also written to two
    **nullable** `SessionMessage` columns (`input_tokens`, `output_tokens`) — light, and forward-looking
    to the L6 `AgentRun` cost tracking.

11. **Failure is a normal error reply, not a 500.** A provider/network/translation failure records the
    assistant message with `status = "error"` and a backend-owned message; no canvas paint, no thread
    pollution. Config-level failures (no provider) raise before any message is written (nothing persists),
    matching the existing `send_message` "config failures bubble → rollback" contract.

---

## Design

### Module layout

```
src/invana/llm/
  __init__.py
  client.py      # OWNED BY RFC-032 — LLMClient.complete_tool(provider, *, system, messages,
                 #   tool_schema, encryption_key, tool_name) -> ToolResult{input: dict, usage}
                 #   provider-agnostic; lazy-imports SDK; runs the SDK call in a thread.
  translate.py   # THIS RFC — nl_to_query(session, *, graph, version, prompt, language, provider,
                 #   encryption_key) -> GeneratedQuery{query, language, read_only, rationale, usage}
  grounding.py   # THIS RFC — render_model_context(version) -> str  (compact schema block)
  schemas.py     # THIS RFC — SUBMIT_QUERY_TOOL (JSON schema), GeneratedQuery
```

`client.py` (RFC-032) is the only place that touches a provider SDK at runtime; `_dispatch_ping` in
`llm_providers/services.py` is refactored to call through it (one lazy-import path, not two).

### Data Model

No new tables. Two nullable, additive columns on `session_messages`:

```python
# invana/sessions/models.py  (additive)
class SessionMessage(Base):
    ...
    input_tokens  : int | None   # set on nl assistant rows; null elsewhere
    output_tokens : int | None
```

`SendMessage` gains one optional field:

```python
class SendMessage(BaseModel):
    content: str
    mode: Literal["ql", "nl"] = "ql"
    language: QueryLanguage | None = None
    parameters: dict | None = None
    llm_provider_id: str | None = None    # nl only; default = graph's is_default provider
```

### API Surface

**No new routes.** `POST /sessions/{id}/messages` (and the create-and-send `POST /sessions`) now
*execute* in `nl` mode:

```
POST /api/v1/u/{username}/{graphSlug}/sessions/{id}/messages
Request:  { content, mode: "nl", llm_provider_id?: string }
Response: { user_message, assistant_message, result: QueryResponse | null }
          # assistant_message.source_query = the generated query (shown in UI)
          # assistant_message.via          = "<provider> · <model_id>"
          # result null only on translation/execution error (detail in assistant_message)
```

Re-run (`POST .../messages/{mid}/run`) is unchanged — it re-executes the stored `source_query`, so an
NL answer re-runs its *generated* query without paying for the LLM again.

### Translation flow

```
nl send_message
  ├─ resolve provider (explicit id → graph default → 422)
  ├─ load active GraphVersion (or introspection fallback)
  ├─ grounding.render_model_context(version)                 # node/edge/property types
  ├─ client.complete_tool(provider, system=<grounded>, messages=[prompt], tool=SUBMIT_QUERY)
  │    └─ on schema/parse fail → one repair turn → else GeneratedQuery error
  ├─ stamp assistant_msg.source_query = generated.query, via = "<provider>·<model>"
  ├─ execute_query(... query=generated.query ...)            # existing path, write-guarded
  ├─ emit llm.translate event  + write input/output token counts
  └─ return QueryResponse  (canvas paints exactly as QL mode)
```

### Studio integration

The NL composer already exists; the changes are small:
- `sendMessage` sends `llm_provider_id` from the composer's provider dropdown.
- The assistant NL reply renders a collapsible **"view generated query"** block (reads `source_query`)
  and the `via` model label — the explainability surface.
- Error replies show the backend-owned message; the "no provider" 422 routes the user to Settings → LLMs
  (the composer already has this empty-state copy).
- No change to `useSessions` shape, the canvas paint, or re-run.

### Events

`events/actions.py`: add `LLM_TRANSLATE = "llm.translate"` (reuse `TARGET_SESSION`). Emitted from the
translator with the prompt→query mapping + latency + token usage. `query.execute` continues to fire from
`execute_query` with its existing `session_id`.

### Storage / migrations

One Alembic revision: add `input_tokens`, `output_tokens` (nullable Integer) to `session_messages`. No
backfill.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Parse a query out of free-text completion** | No tool-use dependency; works on any model | Brittle (fenced blocks, prose leakage); no schema guarantee; injection-prone | Rejected — forced tool-use + JSON-fallback (Decision 2) gives a validated object on every provider. |
| **Translate inside `execute_query`** | One entry point | Conflates a deterministic primitive with a non-deterministic LLM call; pollutes the QL path; harder to test | Rejected — translation is its own `invana/llm/` step that *produces* the query `execute_query` runs (Decision 5). |
| **Skip grounding; let the model freeform Cypher** | Less prompt assembly | Hallucinated labels/relationships; breaks the explainability pillar; wrong-but-plausible queries | Rejected — ground on the active `GraphVersion` (Decision 4). |
| **Stream tokens over SSE now** | Nicer perceived latency | New transport + reconnection + partial-state UX; premature before the L6 agent loop needs it | Deferred (Decision 9) — sync now, stream with agents later. |
| **A new `/translate` route returning a query for the FE to then run** | Separable; FE could preview-before-run | Two round-trips; a generated query escaping the session record; re-implements the run path | Rejected — one call (translate+run) keeps every run in the thread, mirroring RFC-024 Decision 2. |

---

## Security Considerations

- **Key handling**: the runtime decrypts `api_key_encrypted` via the existing Fernet path only at call
  time, in-process; keys are never logged and never returned. The `llm.translate` event records
  `model_id` and the generated query, **never** the key.
- **Prompt injection**: the user prompt is untrusted. The generated query is constrained to the
  `submit_query` schema and the **read-only execution guard** is the hard backstop — a prompt cannot
  smuggle a write past a read-only connection (Decision 7). Grounding restricts label space to the model.
- **Cross-graph isolation**: provider, model version, and connection are all resolved from the
  route-scoped `graph` — an `llm_provider_id` from another graph 404s (`get_or_404` graph check).
- **Cost/abuse**: one translation + at most one repair per message bounds LLM calls per send. A future
  per-graph rate limit is noted as out of scope here.
- **Data egress**: grounding sends the *schema* (type/property names), not graph data, to the provider.
  Sending row data to a third-party LLM is out of scope for Explorer NL (it only translates the question);
  RFC-031 addresses generated-data egress for the Modeller.

## Performance Considerations

- Added latency per NL message = one (occasionally two) LLM round-trips + the existing query execution.
  Acceptable under the sync model; the `running` assistant placeholder already covers the wait in the UI.
- Grounding context is bounded by model size (types, not data); large models get a truncated/most-relevant
  rendering (open: ranking heuristic, see below) to stay within context limits.
- Re-run never re-translates (Decision 5) — repainting a past NL answer costs exactly one query, same as
  QL.

## Open Questions

- [ ] **Grounding for very large models** — when a graph has hundreds of node/edge types, do we send all,
  or retrieve the most-relevant types for the prompt (embedding/keyword pre-filter)? MVP ships "send all,
  truncate by a size budget"; relevance retrieval is a fast-follow.
- [ ] **Few-shot examples** — seed the prompt with 1–2 canonical NL→Cypher pairs per language? Improves
  quality, costs tokens. Default: a small static set per language, revisit with telemetry.

## Implementation Plan

1. [ ] Add `invana/llm/` (`client.py`, `translate.py`, `grounding.py`, `schemas.py`); refactor
       `_dispatch_ping` to call `client.complete_tool`'s lazy-import path.
2. [ ] Migration: `session_messages.input_tokens` / `output_tokens` (nullable).
3. [ ] Add `llm_provider_id` to `SendMessage`; resolve provider (explicit → default → 422).
4. [ ] Replace the `nl` branch of `sessions/services.send_message`: translate → stamp `source_query` /
       `via` → `execute_query` → token counts; error path on failure.
5. [ ] `events/actions.py`: `LLM_TRANSLATE`; emit from the translator.
6. [ ] Studio: send `llm_provider_id`; render the "view generated query" disclosure + `via` label;
       wire the 422 empty-state.
7. [ ] Tests (few, real graph DB + a real provider key in CI secret, no mocks per rule 7): an NL prompt
       against a modelled graph produces a runnable query and paints the canvas; missing provider → 422;
       a deliberately impossible prompt → graceful error reply (no canvas); re-run of an NL answer
       re-executes the stored query without an LLM call.
8. [ ] Changeset (user-facing: NL queries now run) + add the `mvp.md` scope line below.

## Scope & MVP impact

Per `CLAUDE.md`, `mvp.md` is authoritative and new work must not be silently re-scoped. NL→query lives
in **Layer 6 (§ 6.2 Grounded LLM call)**, sequenced at **S9** — *after* S6–S8. This RFC pulls a **thin,
read-only slice** of it forward because its only hard dependency (S4 LLM providers) already shipped and
it unblocks RFC-031. **The scope line is now in place** — **`mvp.md` § 5.7 — Explorer natural-language
queries** carries the Backend / Frontend / Integrations triplet, cross-noting § 6.0 (the RFC-032 runtime
it consumes), § 6.2 (this is a forward slice of grounded LLM, not the full agent loop), and § 5.6
(extends the Sessions `nl` branch). This RFC is `Accepted` and implementation tracks against § 5.7. The
full grounded **agent loop** (planning, write-back, multi-step) remains in L6/S9 and is **not** in scope.

## References

- `engine/src/invana/llm_providers/services.py` — the lazy-import/`to_thread` ping pattern generalised
  by `invana/llm/client.py`.
- `engine/src/invana/sessions/services.py` — `send_message` (`_NL_NOT_WIRED` branch replaced).
- `engine/src/invana/graphs/query_service.py` — `execute_query`, the unchanged run primitive.
- `engine/src/invana/modeller/` — `GraphVersion` (grounding source) + `Introspector` (fallback).
- `docs/internal/mvp/rfc-024-query-sessions.md` — the sessions substrate (Decision 7 deferred this).
