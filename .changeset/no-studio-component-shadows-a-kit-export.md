---
"invana": patch
---

No Studio component shadows a kit export (DS1 · DS17 · design-kit-coverage.md §6c).

Studio carried its own `Eyebrow` and `ClampedText` — mirrors written against `@invana/ui@^0.0.24`,
each with a comment saying to delete it on the next release. The pin is `^0.0.30` now and both
components ship in the kit, so both files are gone and the import is `@invana/ui`.

A sweep for the rest found nine more: `CannotAnswerCard`, `DiagnosisCard`, `EmissionCard` and its
`EmissionHeader` and `TemplatePicker`, a `Breadcrumb` in the app header, a `Card`/`CardHeader`/
`CardFooter` trio in the stitch panel, a `Spinner`, two `EmptyState`s, two filter rows, and the
work canvas' `Legend`/`LegendItem`. Every one is now the kit's component with Studio's data mapped
onto its slots, under a name of its own — `RunCannotAnswer`, `RunDiagnosis`, `AnswerEmission` —
because Govern and Agents already import the kit's `CannotAnswerCard` directly and two components
with one name is the drift this sweep exists to stop. That mapping is the rule the kit states as DS6: a kit component takes a kind, a label and
children, never a domain object, and the mapping is Studio's half.

Two readings change as a result. A diagnosis' evidence was behind an `Evidence ▾` toggle and is
now always shown, in the kit card's *what was tried* box — the card is built from evidence, so
hiding it was Studio disagreeing with the component it was copying. The events filter row on the
platform events page and the graph's activity section was a two-row block and is now the kit's
30px `FilterBar`, carrying the visible count as its summary.

What stayed is what the kit cannot own: `PolicyFlag`'s agent-policy tri-state, `BindRefusalCard`'s
two halves, the layer palette (the kit ships no hues on purpose), and the four `src/ui/`
compositions that sit *over* kit components rather than copying them.

One new kit gap: `TemplateOption.kind` is typed `EmissionKind`, but a projection template's
`surface` is the wider vocabulary that kind is drawn from — `markdown`, `confirm`, `choice` — and
the picker only ever prints it. Studio casts until the slot widens.
