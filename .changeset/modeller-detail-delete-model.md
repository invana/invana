---
"studio": patch
---

Modeller: add a Delete action to the model detail view.

The model list already exposed Delete in its per-row menu, but once you opened a model there was no way to remove it. The detail panel's header now has a trash action (hidden for the read-only system/global model) that confirms, deletes the model and all its versions, then returns to the list — reusing the same `useDeleteModelMutation` as the list.
