# Share a model

A published model exports as one file, imports into another Graph, and upgrades in place. Files and
git are the registry.

| | |
|---|---|
| Index | [1.5](../../../README.md#1--connect-and-model) · Slice **S7** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [domain-models](domain-models.md) · [starter-models](starter-models.md) · [stitch-models](stitch-models.md) |

Product spec: [MO-F03 · Link and share models](../../../../../specs/products/model/features/MO-F03-link-and-share-models/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| CLI | `invana models export <name>` · `invana models import <file>` · `invana models upgrade <file>` |
| Studio | Import from a file; the diff before publish; the reason a draft cannot publish |

## Engine

| Thing | Shape |
|---|---|
| Artefact | one file per published version: package id, content hash, types, keys, constraints, and links when bundled |
| Identity | `package_id` + content hash — not the name, which is local |
| Routes | `…/models/{id}/export` · `POST …/models/import` · `POST …/models/{id}/upgrade` |
| Events | `model.exported · imported · upgraded` |

## Decisions

| # | Decision |
|---|---|
| SM5 | **A refusal is a sentence that names the next command, and the CLI is where it becomes one.** `ImportRefused` carries a code and the facts behind it, because a route returns them as a document Studio renders. A terminal has no renderer, so printing `model_name_taken: {'name': …, 'same_package': True}` hands a reader the engine's internals and leaves them to work out that the verb they wanted was `upgrade`. The CLI turns each code into what happened, what was written (nothing), and the command that does what they meant. A code with no sentence falls back to the raw pair rather than being swallowed — an unhandled refusal must stay visible, and it is the CLI that is incomplete, not the refusal. |
