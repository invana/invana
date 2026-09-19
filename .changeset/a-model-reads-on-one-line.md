---
"studio": patch
---

A model reads on one line, with `More` for the rest (docs/for-developers/modules/connect-and-model/features/model-editor.md, ME21).

The Model panel's column belongs to the type lists, so a model's own metadata could not take six rows of it — and it was reading nowhere, since `ModelFormDialog` is a surface you open to *write*. It now reads above the stack: the description, truncated to a single line, with `More` beside it. The version chips lose their own full-width row above the drawers and become the `Version` row's value instead. Expanding shows validation mode, origin, status, that version readout, created, updated and the YAML path when there is one — as a `PropertyList`, the same label/value grammar the inspector uses. Collapsed height is the same for every model, so switching between them never moves the drawers underneath.

Dates read relative (`3 days ago`) with the absolute timestamp on hover. There is no author row: a model records no creator.
