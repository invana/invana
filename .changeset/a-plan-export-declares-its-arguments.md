---
"invana": patch
---

A plan's YAML export carries the arguments it declares, as a top-level `args` beside its `steps`, and
a step with no arguments reads `args: {}` rather than the string `"{}"`.
