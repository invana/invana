# RFC-036: NL conversation context — multi-turn query refinement

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-22
**Related**:
- **RFC-030** (LLM translation) — owns `translate.nl_to_query`, which today translates each ask in
  isolation (`messages=[prompt]`). This RFC relaxes that to replay prior turns. `nl_to_query` already
  carries an (unused) `history` parameter; this RFC wires it.
- **RFC-032** (LLM runtime) — `complete_tool(messages=…)` already accepts a multi-message history; no
  change. The runtime is provider-agnostic (anthropic / openai / ollama), which constrains the design
  (see Decision 3).
- **RFC-024** (Query Sessions) — the conversation is already persisted in `session_messages`
  (metadata-only, Decision 3 there). This RFC reads that history back; it does **not** persist result
  payloads. Sessions remain private-to-creator, hard-delete.

---

## Problem / intent

A user asks *"show me 10 longest airports"* (NL mode); the engine translates it to a read-only query and
runs it. They follow up with *"only show 5"*. Today the second ask is translated **in isolation** —
`nl_to_query` sends only the current prompt plus the graph schema, so the model has no idea what "5"
refers to and either guesses wrong or fails. The model isn't broken; it is **stateless by design**.

We want follow-up NL asks within a session to **refine the previous query** rather than translate from
scratch.

## Why not a provider-side session?

The Messages API we call (Anthropic, and likewise OpenAI/Ollama on this path) is **stateless** — there is
no thread/session id that makes the model remember prior turns; the standard way to give it "memory" is to
**resend the relevant prior turns in the `messages` array** on every call. (This mirrors how Claude Code
works: it keeps the transcript locally and replays it each turn; `/clear` wipes the *local* transcript,
not a server session.)

Genuinely stateful options exist — Anthropic **Managed Agents** (server-managed sessions + hosted
containers) and OpenAI **Responses/Assistants threads** — but each is **provider-specific** and would
(a) break our provider-agnostic runtime, and (b) move conversation retention to a vendor, conflicting with
RFC-024 (sessions private-to-creator, hard-delete, we own the data). **Prompt caching** is not memory — it
only makes resending the prefix cheaper. The **memory tool** is client-implemented storage for
cross-session facts, not turn-to-turn query refinement. So replaying our own persisted history is the
correct and only provider-neutral design — and the data already lives in our DB.

## Design decisions

- **D1 — Replay a bounded window of prior turns.** On an NL ask, `send_message` loads the last
  `_HISTORY_TURNS = 6` turns from the session (via a new `SessionStore.list_recent_messages`, windowed by
  `seq < user_seq`) and passes them as `history=` to `nl_to_query`. The window keeps the prompt small;
  this is read-only translation, so the risk of a stale follow-up is low (and the read-only guards in
  RFC-030 / `execute_query` are the backstop).

- **D2 — Context shape: user prompt + generated query + rationale.** Each contributing turn is replayed as
  a `{role: user, content: prompt}` / `{role: assistant, content: query (+ rationale)}` pair. The
  generated query is what makes "only show 5" actionable; the one-line rationale adds intent. This
  requires persisting the rationale (see D5) — previously it lived only in the `llm.translate` audit
  event.

- **D3 — Plain-text history, not tool_use/tool_result replay.** Forced tool use is an *output* mechanism
  for the *current* turn only. For history we only need "user asked X → query was Y (because Z)", which a
  plain assistant text message conveys. tool_use/tool_result blocks are provider-specific (Anthropic
  content blocks vs OpenAI `tool_calls`/`tool` role vs Ollama `format` JSON with no tool-result concept);
  plain user/assistant text serializes identically across every provider `complete_tool` dispatches to.
  The current turn still emits via the `submit_query` forced tool.

- **D4 — Include all successful turns, nl + ql.** A turn contributes only when its assistant reply is
  `status == ok` and has a `source_query`. Both `nl` and `ql` turns qualify, so a follow-up can refine a
  query the user typed by hand as readily as one the model generated. `mode` is not consulted. Error and
  still-running turns are excluded, and the orphaned user prompt is dropped so the message list stays a
  clean user/assistant alternation (which the strictest provider, Anthropic, requires).

- **D5 — Persist `rationale` on the assistant message.** New nullable `session_messages.rationale`
  (Text). Set in the `nl` branch alongside `llm_time_ms` so it survives even if the generated query later
  fails to execute. Null on QL, on rerun (no translation), and on existing rows. Surfaced in the
  starlette-admin `SessionMessageView` per the engine rule for new columns.

- **D6 — Re-run is unchanged.** `rerun_message` re-executes the stored `source_query` and never calls the
  LLM (RFC-030 D5), so it neither reads nor writes conversation context.

## Edge cases

- **First message:** `before_seq = 1` → empty window → behavior identical to pre-RFC.
- **Error / running turns:** excluded; their orphaned user prompt is dropped.
- **ql turns:** included when successful; `rationale` is simply `None` for them.
- **Re-run:** mutates a row in place, adds none, so `seq` ordering stays intact for later sends.

## Scope / non-goals

- Engine-only; no Studio or connector change.
- No result-payload persistence (RFC-024 D3 unchanged) — only the generated query + rationale are
  replayed, never rows/nodes/edges.
- No provider-side sessions, no prompt caching, no cross-session memory (all out of scope; see above).
- Window size is a constant, not yet user-configurable.

## Files

- `engine/src/invana/sessions/models.py` — `SessionMessage.rationale` column.
- `engine/src/invana/modeller/migrations/versions/00000000001d_session_message_rationale.py` — migration.
- `engine/src/invana/sessions/store.py` — `list_recent_messages`.
- `engine/src/invana/sessions/services.py` — `_HISTORY_TURNS`, `_assemble_history`, wire `history=`,
  persist `rationale`.
- `engine/src/invana/server/admin/views.py` — `rationale` field.
- No change to `llm/translate.py` or `llm/client.py` — already history-ready.
