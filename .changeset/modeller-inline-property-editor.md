---
"studio": minor
---

Modeller: edit properties inline instead of in modals.

On a draft, the Details panel's property editor is now fully inline — no dialogs. Each property row has an **Edit** (pencil) action that turns its Name / Data type / Cardinality cells into fields with **Save** / **Cancel** (Enter saves, Esc cancels). **Add property** reveals an inline new-property row at the bottom of the table instead of opening a modal: type a name, pick a data type + cardinality, and save — it reuses an existing property key of the same name or creates a new one, then maps it to the type. Removing a property stays a one-click action.
