---
"studio": patch
---

Fix the Setup wizard's "Set up" / "Edit" links (Intent, Connection, Skills,
Datasets) opening the page's empty-state instead of the section form. The rows
linked to the graph root with a `?settings=` query (`/u/:u/:s?settings=intent`),
but the root redirects to `/explorer` and drops the query string — bouncing the
user to the "Explorer isn't ready yet" banner. The wizard now switches the
docked Settings panel in place via `useSettingsPanel().setSection`, the same
mechanism the rail nav and setup banner already use.
