---
"invana": minor
"studio": minor
---

Backend-owned action messages — server-driven success toasts (RFC-028).

Mutating endpoints are the source of truth for their success copy. The engine's modeller routes now return a standard `ActionResponse` envelope (`{ message, data }`); deletes return `200` with a message instead of `204 No Content`. Studio's axios client toasts the envelope's `message` centrally and unwraps `data` for callers, so the modeller's ~20 hardcoded `toast.success("…")` literals are gone — the wording now lives on the server. Client-orchestrated gestures that fan out over generic endpoints (property add/remove/edit, edge reverse, canvas erase) suppress the per-request toast and show a single summary. Errors already worked this way (`detail` → `ApiError.message`) and are unchanged.
