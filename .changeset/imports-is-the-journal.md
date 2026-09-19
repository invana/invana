---
"invana": minor
"studio": minor
---

Datasets becomes Imports — an audit journal (docs/for-developers/modules/bring-data-in/features/inspect-what-landed.md).

**The panel lists runs, not datasets.** What a person wants after a load is *what happened*, so the surface is one list across every dataset in the Graph, newest first: status, dataset, `NewsArticles @ v3`, `12,480 of 12,487 written`, duration, when. A dataset is reached from the run that wrote it, not from a list of its own, and the node inspector's provenance jump lands there the same way. `?panel=datasets` still resolves, onto `imports`.

**A run names who ran it.** `import_jobs` carries `actor_id`, `actor_label` and `invocation`; `invana datasets import --user <username|email>` attributes the run to a person, and without it the run is labelled with the shell it ran from — `ravi@laptop (cli)` — rather than a user the command was never given. The command itself is recorded verbatim, so the journal reads back as a list of things people did.

**A run shows its log.** The lines the load wrote — `ts · level · stage · message` — render on the kit's `Terminal`, filterable by level, under the step card. The steps say what the run did; the log says what it saw, and an audit journal needs both.

**New routes.** `GET …/imports` is the journal — filterable by `status`, `dataset_id` and `since`, paged by keyset rather than offset because runs arrive while a person is reading — with `GET …/imports/{run_id}` and `GET …/imports/{run_id}/report` beside it. The dataset-scoped reads are unchanged.

**The panel was unreachable, not empty.** A page-owned panel has to be listed in `PAGE_OWNED_SECTIONS`; Datasets never was, so the rail lit its icon, the URL carried its key, and the shell handed the column to `SettingsPanel`, which draws nothing for a key it does not know. Imports and Templates are both registered now.

**`invana loader` is in the journal too, and says what it is.** The fast path takes `--graph <username>/<slug>` — which also supplies the connector class, URI and credentials, so a database Studio can already reach is not described twice, with each flag overriding one part — and records a run of kind `bulk`: the counts it wrote, the lines it printed, and who ran it — with no steps, no report and no provenance, because it produced none. Where the trace would be, the run says so. Without `--graph` nothing is recorded and the command prints that, rather than leaving a load that wrote fifty thousand nodes invisible to the person who has to account for them. Its summary also no longer crashes on a load that had errors — it read the loader's error strings as records.

**Live rows.** While any run is queued or running the journal repaints itself, so an import started in a terminal lands in Studio without a refresh.
