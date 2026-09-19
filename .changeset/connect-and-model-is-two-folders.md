---
"studio": minor
---

Connect and model is two folders — a model on its own, and what happens between two (docs/for-developers/building-studio/code-shape.md §4.1d).

**`model/` and `stitch/`.** The line between them is subject, not shape: `model/` is a model authored on its own — its types, its draft, its versions and the file it travels in (1.2 · 1.3 · 1.4 · 1.5 · 1.7); `stitch/` is what happens *between* two published models (1.6), which is a different subject with its own page kind.

**A sub-folder may name a screen that spans several features.** Four sub-folders named after four feature files would split one screen four ways and put its assembler in whichever one won — `ModelPanel` draws all five of `model/`'s features in one file. §4.1b gains that as the rule, alongside the existing one-sub-folder-per-feature.

**`LinksSection`, not `StitchPanel`.** `ModelLinksSection` lifts out of `ModelPanel` (1,269 → 1,125 lines) into `stitch/LinksSection.tsx`. It is a section *inside* the Model panel, not the occupant of a region, so it is a Section — a Panel name would claim a region it does not have. Not every feature folder ends in a `*Panel`.

**`types.ts`, never `utils.ts`.** `ModelSelection`, `SelectedItem` and `ModelEditCtx` were declared in the three files that happened to use them first; they collect in `model/types.ts`. `editing.ts` becomes `propertyTypes.ts`, named for what it holds.

**The module gains an `index.ts` border.** `GraphDetailPage` imported four symbols from three deep paths; it now imports them from one. `CompatibilityBanner` stays at the module root — it answers to graph-connectors' `capabilities.md` and belongs to neither feature.

No behaviour changes: file moves, one function lifted intact, and import paths. `check-types`, `lint` and `build` are green.
