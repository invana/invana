---
"studio": minor
---

Make graph details editable from the Info panel.

The graph's **name**, **description**, **objectives**, and **success criteria** can now be edited from the Info settings section (previously only `instructions` was editable, and the rest had no UI at all despite the backend `PATCH` supporting them). The section also gains an **Archive / Unarchive** toggle to flip a graph's status without deleting it.

Wires existing `GraphUpdate` fields to the form via `useUpdateGraphMutation`; no backend change.
