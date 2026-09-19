---
"studio": patch
---

Studio takes the design-kit type ladder, and stops declaring one of its own.

`studio/src/index.css` now imports `@invana/styling` as source. That block is
where the kit's `@theme` lives — the two content sizes (`text-base` 1rem,
`text-meta` 0.923rem) as ratios of the root, with `lg` and up on Tailwind's
heading defaults (D7 · DS13). The precompiled `@invana/ui/styles.css` cannot
carry it: it ships plain `:root{--text-…}` custom properties and, since no kit
component writes `text-sm` any more, no `.text-sm` rule at all.

What was in the way was Studio's own six-rung `@theme` scale — `--text-xs`
through `--text-2xl`, labelled "VS Code web font scale". It was authored against
a 16px root and never re-checked when `html` went to 13px, so every rung
rendered ~19% under its own comment: `--text-base: 0.8125rem` was labelled 13px
and painted 10.6px. It also overrode the kit's tokens, so the import alone would
have changed nothing.

Measured before → after, at the 13px root: body 10.6 → 13px, `text-sm`
9.8 → 13px, `text-xs` 8.9 → 12px, `text-lg` 11.4 → 14.6px. Everything grows;
nothing in the Explorer, the settings form or the status bars clips.

The `@theme inline` colour map goes with it. It existed because Studio imported
only the theme files, whose `--color-*` sit inside `[data-theme]` selectors that
Tailwind 4 does not read as theme colours. The kit's `@theme` registers all of
them once it is compiled as source — verified by diffing the two builds: 617
bytes of duplication, and not one effective rule.
