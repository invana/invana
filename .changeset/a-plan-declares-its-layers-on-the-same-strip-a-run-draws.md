---
"invana": patch
---

A plan declares its layers on the same strip a run draws.

**The plan detail's *Layers it declares* band is now `LayerStrip`.** It was five chips over a
summary line — a list of bands with no order in it. It is now the same gantt the run dashboard
draws, read in the other tense: `scale="seq"` here and `scale="elapsed"` there, one component, one
axis (LB31). A plan has no clock, so its axis is its own order and a node's `depth` **is** that
order — two steps at the same depth wait on the same thing, not on each other, so they share a
slot. A step is a bar on the row of the catalogue entry it spends, and those rows come from the
plan's own nodes rather than a second list beside them. A band the plan never engages is **muted,
not dropped**: *this plan leaves the graph alone* is what a person opening a plan they did not
write is checking for.

The bands arrive **shut**. A 420px drawer cannot hold a column of mono addresses beside a track,
and shut is not less information — the tasks drop onto their band's own line, so five lines carry
the whole plan and opening one is a click. Repetition brackets and gate seams are deliberately not
passed: the plan read carries no loop bound and no gate position, and drawing either would be a
guess.

**The run's strip becomes a gantt too.** `RunLayersPanel` takes each touch's window from the step
it belongs to on the trace, and falls back to the ledger's `seq` order for the whole strip when any
touch cannot be placed — half a wall clock is a lie about both halves. A refusal is an instant at
the leading edge of the step it was refused in, because a third party is refused *before dispatch*
and has no span to draw.

**Studio moves to design-kit 0.0.30**, which is what carries the two kit changes below. The
`INVANA_DESIGN_KIT` hatch now covers all seven packages rather than four, and moves Tailwind's
`@source` scan with it — redirecting some packages and fetching the rest was the one state that
silently misrendered, because a local `@invana/ui` built against the new ladder beside a published
`@invana/styling` puts every kit component one step too large and nothing fails.

**The type ladder is three rungs.** `text-meta` is gone from `@invana/styling`; Studio follows with
the kit's own 1:1 rename — `text-sm → text-base`, `text-meta → text-sm`, `text-xs → text-sm` —
across 88 files, so not a pixel moved and `text-xs` becomes a rung that was never available before.

**A layer's colour is Studio's now** (DS19). The kit ships no hues, so `src/ui/layerPalette.ts`
states the map once — `llm` keeps the slot `BoundChip` gives the `llm` bound, and the `agent` spine
stays neutral because it is never governed — and every call site passes it as a prop rather than
inheriting it from a provider.
