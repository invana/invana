---
"studio": patch
---

Upgrade the design-kit family to `0.0.23` (`@invana/ui`, `@invana/forms`,
`@invana/styling`, `@invana/themes`).

No API moved. `0.0.23` carries one fix: `AppLayoutV2` namespaces its panel and
group ids per instance, so two shells on a page no longer share persisted panel
sizes. Studio builds its own panel group today (`GraphDetail`), so nothing here
changes yet — the bump is what unblocks it from driving the shell's regions
instead.

`tsc -b` reports the same 29 errors before and after: this upgrade introduces
none, and the pre-existing set is untouched.
