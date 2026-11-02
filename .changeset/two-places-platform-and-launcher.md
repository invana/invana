---
"studio": minor
---

Two places in the shell: the launcher lists *Invana* — Home, Datasets, Agents (for install Admins),
Fleet and Settings — then *This Graph · name* while a Graph is open. Fleet (Pools · Workers ·
Capacity · Join tokens, Add workers, a pool's and a worker's page) moves to `/fleet`, and the plugin
registry and a plugin's page to Settings › Plugins at `/settings/plugins`, both off any Graph with
no Graph picker. A person's own settings move to `/profile`. Agents loses its Workers section and
its Functions › Plugins tab; nothing redirects from their old paths.

Activity is a Graph product at `/u/:user/:graph/activity`, listed under *This Graph*: its rail is
Runs · Approvals · Ledger │ Schedules · Events · Inbox · Rules · Channels, each a workbook tab, and a
run opens as a tab beside them. Every run page, the bell, the Inbox and ⌘K open a run there. Agents
loses its Runs, Approvals and Ledger sections and Home tiles; an old `?panel=runs`, `approvals`,
`ledger` or `events` link lands on its Activity path.
