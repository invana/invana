---
"invana": patch
---

The airways walkthrough says `records`, because that is what the command is called.

`invana datasets` became `invana records` when the Dataset stopped being a container of its own —
the group names the object, because the verb was already spoken for: `invana models import` brings a
*model* in. The rename landed in the CLI and in the migration plan, and the demo README kept telling
readers to run the old name:

```
$ inv datasets import --graph … --name air-routes --model AirRoutes --path …
Error: No such command 'datasets'.
```

Twelve lines of the walkthrough, across steps 3, 6 and 7 and the *starting over* table. The README
was already inconsistent with itself — its own file-reference table said `invana records import` —
so the walkthrough disagreed with the table two screens below it.

Two feature files carried the old name in prose as well: `stitch-models.md` ST41, on what a pipeline
branches on, and `load-data.md`, on where the caveat sits in the CLI. Both now say `records`.

**Studio's Setup handed out the same stale command, to be copied and run.** *Bring data in* offered
`invana datasets import --graph {graph} --model <Model> <path>` — wrong twice over: the group, and
the arguments. `--name` was missing and `--path` was written as a positional, so even with the group
corrected it would have been refused for two required options. It is now the command's real
signature, and the setup spec's own mock says `records` with it.

`task-model-migration.md` is left alone. It describes `invana datasets restamp` as the tool that
shipped *for* the migration and then says it is deleted with the tables it read — a coherent account
of what happened, which renaming would turn into a claim about a command that never existed under
that name.
