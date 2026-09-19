---
"invana": patch
---

`invana datasets import` could not import anything (load-data.md).

Every invocation died before it read a record:

```
sqlalchemy.exc.NoReferencedTableError: Foreign key associated with column
'thoughts.message_id' could not find table 'session_messages'
```

A dataset import opens a run trace, and a run trace is a `Thought` — whose `message_id`
points at `session_messages`. The server imports every model at startup, so its mapper
resolves that foreign key; a CLI process imports only the models it names, and this one
never named the sessions models. The first flush therefore failed, on every dataset, with
an error about a table nobody running `datasets import` had any reason to think about.

`invana loader` was unaffected and hid the bug: it journals through `record_bulk_load`,
which writes a `Dataset` and an `ImportJob` and no `Thought` at all.

The CLI now registers the sessions models. Confirmed against the engine's own
`examples/datasets/svc`, which failed identically before and imports after.
