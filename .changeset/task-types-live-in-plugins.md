---
"invana": patch
---

Every task type now lives in a plugin, and each Task records the version of the task type it uses.

- The catalogue's 28 task types moved into seven core plugins under `invana/plugins/core/` — one folder per task type, a `manifest.toml` beside its `run.py`. Keys, arguments, outputs and behaviour are unchanged; `invana.runtime.catalogue` still exports `CATALOGUE` and `TASKS`.
- The library's packaged flows (`nl-single@2`, `model-import@1`, `stitch-apply@1`, …) ship as `flows/<key>.toml` in the plugin they belong to.
- The registry is built once at start-up and frozen. A manifest that does not match its folder or its code stops the engine with the file named.
- `tasks.task_version` (migration `000000000068`) records the task type version when a plan's rows are written. Rows written before stay empty.
