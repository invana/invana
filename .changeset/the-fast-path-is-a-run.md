---
"invana": patch
---

The fast path is a run.

`invana loader --graph <ref>` wrote its journal into `import_jobs` — a row shaped like an import
that had never been one. It now walks a plan like everything else: `bulk-load@1`, one step,
`bulk_write`. It retries, cancels, streams and leaves a trace exactly as `invana records import`
does, and the **kind** is what says this one validated nothing and stamped no provenance.

`bulk_write` is the twenty-second catalogue entry and it declares **no `requires`**. That is the
whole reason it exists rather than reusing `write_graph`: `write_graph` requires `validate_records`
because everything it writes was checked against a published version, and a bulk plan naming it
would have claimed a validation it never ran. The validator was right to refuse that; the fix is an
entry that states what actually happens, not a relaxed version of somebody else's.

Two things behave differently:

- **A load that wrote nothing fails, with its reasons.** The folder was named, so something was
  expected.
- **A connection described on the command line is no longer journaled.** Replaying such a run would
  need the credentials, and credentials never ride a run's `params` — so `--uri` / `--username` /
  `--password` / `--connector` keep the direct path and say so on the way out. `--graph` on its own
  is the run.

`invana datasets` is now **`invana records`** — `import`, `check`, `restamp`. The group names the
object because the verb was already spoken for: `invana models import` brings a *model* in, and has
since share-a-model. Records are their own noun, so they get their own group rather than a second
meaning for one command.
