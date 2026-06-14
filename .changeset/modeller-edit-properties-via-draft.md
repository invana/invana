---
"studio": minor
---

Modeller: "Create draft to edit" from a read-only type's Details panel.

When viewing a node/edge type on a **published** model, the read-only Properties viewer now offers a **Create draft to edit** button. It drafts the model (based on the active version) and lands you directly on the same type's editable `PropertyEditor` — the selected type is re-resolved by name across the new draft version, so you don't lose your place. The system **global** (introspected) model stays fully read-only (no affordance — it's refreshed from the database, not hand-edited).
