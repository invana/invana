---
"invana": minor
"studio": minor
---

Events log — multi-select event-type filter with search.

The events filter is no longer a single category prefix. It now combines a `RichSelect` (multi/checkbox) category dropdown — each row toggles its whole group — with a searchable popover listing every individual event type, both multi-select and sharing one selection set, so multiple types can be selected at once. A derived status filter (Success / Failed / No status, inferred from `details.ok` and `*_failed` actions) and a free-text search bar sit above the list and filter the loaded events client-side (search covers action, actor, target, payload). The read API gains a repeatable `action` query param (exact-match `IN`, index-friendly) on both the per-graph and global endpoints; the existing `action_prefix` param is unchanged. Selection drives server-side filtering so keyset pagination ("Load older") stays correct. Applies to the docked graph events panel and the platform-wide events page.
