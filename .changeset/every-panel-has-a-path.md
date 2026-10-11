---
"invana": patch
---

Every panel on a Graph has its own address.

Opening a panel now changes the path rather than a `?panel=` parameter. The path is named for
the product that will hold it: `/u/admin/airways/agents/llms`, `/activity/runs/<run>`,
`/modeller/worlds/<world>`, `/projects/todos/<todo>`. Reloading or sharing that address opens
the same screen. Old `?panel=` and `?settings=` links still work and redirect to the new path,
keeping the rest of their query string. The breadcrumbs now follow the path: each level links
one level up, and a trail deeper than four levels folds its middle into `…`.
