---
"studio": patch
---

The left panel is `?panel=`, and the breadcrumb reads the URL back.

`?settings=` named the param after the group that used to fill it. Most of its values are not
settings sections — Model, Datasets, Templates and the four work surfaces are the page's own
panels — so every other value read like a mistake. The param is named for the **region** it drives
instead, which leaves one param per axis of the page:

| Param | Names |
|---|---|
| `?panel=` | the open section of `leftSection` |
| `?page=` | what fills `mainSection` (not shipped yet) |
| `?ai=` | the assistant drawer, on the right |

`?settings=` is still **read**, so a bookmark keeps working; it is never written. A write sets
`?panel=` and drops `?settings=` in the same step, so the two can never disagree about which panel
is open.

**The breadcrumb names the open panel**: `admin › air-routes-graph › model`. The panel crumb is the
`?panel` value verbatim — lowercase, exactly as it appears in the address bar — because the two
crumbs before it are identifiers too, the username and the slug. The trail is a literal reading of
the URL rather than three registers of prose. With no panel open it is `admin › air-routes-graph`;
with a canvas open on top of a panel, the canvas follows the panel.
