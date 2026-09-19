---
"invana": minor
---

A load says what it is doing while it does it (load-data.md LD17).

`invana datasets import` printed nothing until it was finished. On the airways demo that
is 61,394 records and one `MERGE` each, so air-routes spent minutes in total silence —
indistinguishable from a hang, and the only advice the README could offer was to go and
read the next section while you waited.

The run already keeps a journal: `register → validate → write → stitch → done` lands in
`job.logs` and the API reads it back. It is now also readable *live*. `import_dataset`
takes an `on_progress` callback and calls it at every stage transition and every 500
records written, carrying the same `stage` and `message` that the journal stores — one
account of the load, whether you read it as it happens or afterwards.

```
  register  Importing 'air-routes': 3749 node + 57645 edge record(s)
  validate  Validated 61394 record(s) — 0 reported
  write     24500/61394  39%
```

The counter goes to **stderr** and rewrites one line, so `stdout` still carries only the
summary a pipe parses. Redirected to a file it degrades to one line per stage rather than
ten thousand carriage returns, and a callback that raises is suppressed: a display must
never fail a load.
