---
"studio": minor
---

One module, one sub-folder per feature (docs/for-developers/building-studio/code-shape.md §4.1b).

**`features/ask/` gains the structure its docs already have.** The module folder keeps the docs module's name — Ask owns nine features, and the assistant is one of them — and the files inside group by the feature they implement rather than by the shape of the code: `assistant/` (3.10), `answer-surface/` (3.3, with when-it-cannot-answer and reasoning-trace rendering inside a reply), `projections/` (3.4).

**`projections/`, not `templates/`.** A **template** is already Ask's word for the versioned, person-authored projection template that decides what an answer looks like — `TemplatesPanel` renders exactly those. A folder reusing the word for `EmissionCard` and `ResultsTable` would put two unrelated things under one name in one module. Checking the module's vocabulary before coining a folder name is now the written rule.

No behaviour changes: this is file moves and import paths.

**The panel is titled `Ask Assistant`.** Its header said `Sessions`, which named the contents rather than the occupant — and stopped being true when the panel moved to the right side. `Ask` qualifies it because it is Ask's surface, and because *Assistant* alone is the product-wide noun for the thing rather than this panel's name. Inside it everything is still sessions: the list, `Search sessions`, `Refresh sessions`. The breadcrumb inside a thread reads `Ask Assistant › <session title>`, the first crumb still being the way back.
