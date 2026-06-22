# RFC-040: Explorer "context used" disclosure

**Status**: Proposed (ready to implement — small, scoped)
**Author**: Invana Team
**Date**: 2026-06-22
**Related**:
- **RFC-036** (NL conversation context) — engine-only; replays the last ~6 successful turns into the
  translation. This RFC adds the **Studio surface** to *see* that context. It is the UI companion to
  RFC-036 and belongs on the same context branch.

---

## Intent

The conversation-context feature (RFC-036) works, but the replayed history is invisible — there's no
way to see *what context the model was given* for a turn. Add a small **info-icon disclosure** on the
assistant reply: click it to see the prior turns that were sent, mirroring the existing "view query"
(`<>`) disclosure.

## UX

In the assistant message action row — `AssistantMessage` in
`studio/src/pages/graphs/explorer/components/SessionsPanel.tsx:738-770` (the `RotateCw` / `Code` /
`Copy` buttons) — add a fourth **`Info`** icon button (design-kit `Button variant="ghost" size="icon"`,
matching the others), wired to a `showContext` toggle exactly like the existing `showQuery` toggle
(`:756`, `:774-778`).

- **When shown:** only on **NL** replies (`message.mode === "nl"`) that actually had context — i.e.
  ≥1 prior turn was included. First-turn / no-context replies don't render the icon (nothing to show).
  QL replies never show it (no LLM, no context).
- **On click:** toggle a disclosure block below the meta line (same styling as the `showQuery` `<pre>`),
  titled *"Context sent to the model — N prior turn(s)"*, listing each included turn in order:
  - `You:` the prior user prompt
  - `Query:` the generated query (monospace), plus the rationale line if present.
- **Title/tooltip:** "View context" / "Hide context".

This is read-only — no editing of context from here.

## Data source

The assembled context is not persisted today (RFC-036 builds it in `send_message` and passes it
straight to the LLM). Recompute it on demand — **recommended: a tiny read-only engine endpoint**, so
the Studio reuses the engine's exact windowing rather than re-implementing them (avoids drift):

```
GET /api/v1/u/{username}/{graphSlug}/sessions/{session_id}/messages/{message_id}/context
  → 200 [{ prompt, query, rationale }, ...]   # one structured entry per prior turn
```

Returned **structured** (prompt / query / rationale) rather than raw `{role, content}` so the UI can
render hierarchy instead of one blob. `_context_turns(rows)` is the single source of truth;
`_assemble_history` derives the flat replay messages from it, so what's shown matches what was sent.

Implementation reuses existing pieces, no new logic:
- load the assistant message → `before_seq = message.seq - 1` (its user turn's seq);
- `SessionStore.list_recent_messages(before_seq=…, limit=_HISTORY_TURNS*2)` + `_context_turns(...)`
  — the same window `send_message` uses, so the result is identical to what was sent.
- gated by `require_graph_member` like the other session routes; returns `[]` for a first turn.

Studio: fetch lazily on first icon click (TanStack Query keyed by message id), render the list. While
fetching, the disclosure shows a one-line "Loading context…".

**Alternative (no engine change):** derive the window client-side from the already-loaded session
messages by mirroring the `_assemble_history` rules. Simpler to ship but duplicates engine logic and
can drift — only worth it if we want to avoid the endpoint entirely.

## Notes / non-goals

- **Recompute, not literal bytes.** Sessions are append-only, so recomputed == sent. Exact-byte
  fidelity (persisting the assembled context per message) is deferred — not worth the storage for a
  debug view.
- No migration; no result-payload change (RFC-024 unchanged).
- Changeset required (user-facing Studio change).
- Tests: one Studio component test (icon shows for an nl message with context, hidden for a first
  turn; disclosure renders the turns) and, if the endpoint is taken, one focused engine test
  (app-state DB only — no graph DB).

## Scope

Small. Lives on the RFC-036 context branch (it completes that feature's UX). Files:
- `studio/.../SessionsPanel.tsx` — the icon + `showContext` toggle + disclosure (+ the fetch hook).
- `engine/.../sessions/{routes,services}.py` — the `…/context` endpoint (if the recommended option is
  taken); reuses `list_recent_messages` + `_assemble_history`.
- changeset.
