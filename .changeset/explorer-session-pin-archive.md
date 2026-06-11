---
"invana": minor
"studio": minor
---

Explorer sessions: pin, archive, sort, and filter.

Each session row gains hover actions to **pin** (floats it to the top of the list, shown with a filled pin even when not hovered) and **archive** (hides it from the default list). Both persist server-side: the `sessions` table grows `pinned` / `archived` boolean columns (migration `000000000017`), the `PATCH /sessions/{id}` endpoint accepts partial `{pinned, archived, title}` updates, and the list endpoint orders pinned-first and hides archived unless `include_archived=true`.

The panel header adds a **Sort & filter** menu: order the list by Created or Updated, reveal archived sessions, and — when LLM providers are configured — filter by provider. (Sessions don't yet record which provider produced them, so the LLM filter is wired ahead of natural-language queries landing.)
