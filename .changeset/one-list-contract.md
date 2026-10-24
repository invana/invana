---
"invana": minor
"studio": minor
---

Every Agents list is searched, filtered, sorted and paged by the engine, the same way (docs/for-developers/modules/platform/features/list-contract.md).

**One contract.** Agents, skills, task plans, runs, LLM providers and models, plugins, the catalogue, approvals, schedules and members take `q`, named filters (`?status=failed&status=stopped`), `sort`, `cursor` and `limit`, and answer `{items, total, unfiltered_total, next_cursor, applied}`. An unknown filter or value is a 422 naming what the list takes. The old `include_ephemeral`, `include_retired`, `candidates` and `interactive` booleans are filters now (`ephemeral=shown`, `status=retired`, `candidates=true`, `interactive=true`); every `*ListResponse` shape is gone.

**Studio: filters live in the URL.** A list's search box and controls write `?q=` and `?f.<field>=`, so a reload or a shared link opens the same rows. The Runs and Agents lists show the applied filters as chips above the rows — × on each, *Clear all*, *set by the assistant* when a link carries `?via=assistant` — and count *N of M match* from the engine. Section and detail pages head with the page form of `RecordHeader`.
