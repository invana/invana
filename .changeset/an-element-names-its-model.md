---
"invana": patch
---

An element names the model it conforms to.

Every written node and edge carries provenance, and one of the four ids in it pointed at a `datasets`
row. Records are imported **into a model**, and the model is what holds them, so the stamp is
`_inv_model_id` — the namespace `_inv_record_id` lives in. Record ids are whatever the source chose,
so it takes a pair for the identity to mean anything, and the model is the right half of that pair:
an id is only ever promised unique within the thing it conforms to.

This is a remap, not a rename. A dataset id is not a model id, so each element is resolved through
the row that knows the pairing, before that row is deleted:

    invana datasets restamp --graph <username>/<slug>          # reports, writes nothing
    invana datasets restamp --graph <username>/<slug> --apply

The command now carries both provenance migrations in one idempotent pass, so an install arriving
from any earlier version gets whichever it needs. It must run **before** `datasets` and `import_jobs`
are dropped: those tables are the only mappings that exist, and a graph migrated in the wrong order
has elements nothing claims. The command reports that count rather than passing over it.

The fast path now names a model too. `invana loader` writes records without checking them against
anything and used to record that honestly by attaching them to a source with no model — which, with
the model as the container, leaves those records nowhere. `--model` says where the records go and is
required on every path; validation is the thing the fast path opts out of, and the run says which of
the two happened.
