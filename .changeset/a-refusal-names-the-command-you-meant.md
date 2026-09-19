---
"invana": patch
---

An import refusal names the command you meant.

Re-running the airways demo's step 4 printed this, and stopped there:

```
Error: model_name_taken: {'name': 'AirRoutes', 'model_id': 'd5b061e6-…',
                          'package_id': 'invana.dataset.air-routes', 'same_package': True}
```

Nothing was wrong. The three models were already imported, `models import` *creates* a model so it
refuses rather than re-importing, and the verb the reader wanted was `upgrade`. None of that is in
the message: it is the engine's internal pair — a code and the facts behind it — printed at a
person.

That pair exists for a reason. The HTTP route returns it as a document, and Studio renders it. A
terminal has no renderer, so the CLI now does that job itself: what happened, that **nothing was
written**, and the command that does what was meant, with the arguments already in it.

```
Error: 'AirRoutes' is already in this Graph, from the same package. Nothing was imported.
An import creates a model; bringing a newer version of one in is an upgrade:
  invana models upgrade --graph admin/airways --name AirRoutes --file …/air-routes/graph-model.json
```

The same for the two other refusals: a name taken by a *different* package says so — and says which
package is the one already here, not the one in the file — and points at `--as`; an upgrade against
a package that is not the same domain points back at `import --as`. The suggestion echoes how the
command was actually invoked, so a `--starter` refusal suggests `--starter` back.

A code with no sentence written for it still prints the raw pair. An unhandled refusal must stay
visible: it means the CLI is incomplete, not that the refusal can be guessed at.

The airways README gains what it was missing — step 4 is the one step in the walkthrough that is not
safe to re-run, and both of its troubleshooting tables now say so.
