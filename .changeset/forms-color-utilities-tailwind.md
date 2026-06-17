---
"studio": patch
---

Fix `@invana/forms` controls (e.g. the connection form's read-only Switch) rendering visually frozen
— clicking toggled the value but the thumb never moved and the track never colored.

Studio's Tailwind 4 setup was missing two things `@invana/forms` relies on (it ships no precompiled
CSS, unlike `@invana/ui`): an `@source` directive so Tailwind scans the package's compiled classes,
and a `@theme inline` block registering the design-kit color tokens (`primary`, `input`, `foreground`,
…) so color utilities like `bg-primary`/`bg-input` actually generate. Without them the Switch's
`data-[state=checked]:translate-x-5` / `bg-primary` classes were never emitted. This fixes all
`@invana/forms` components in studio, not just the Switch — and also studio's own direct use of
design-kit color utilities (`text-muted-foreground`, `border-border`, …), which previously only
worked by free-riding on `@invana/ui`'s precompiled CSS.

Also cleans up the design-system CSS imports to use bare package specifiers
(`@invana/themes/styles.css`, `@invana/styling/themes/*.css`) instead of reaching into
`../node_modules/...` by relative path.
